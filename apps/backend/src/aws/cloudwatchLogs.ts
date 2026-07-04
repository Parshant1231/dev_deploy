import {
  CloudWatchLogsClient,
  StartQueryCommand,
  GetQueryResultsCommand,
  QueryStatus,
} from '@aws-sdk/client-cloudwatch-logs';
import { config } from '../config/env';

export const cloudWatchLogsClient = new CloudWatchLogsClient({
  region: config.awsRegion,
});

// ─────────────────────────────────────────────
// QUERY LOGS
//
// CloudWatch Logs Insights queries are asynchronous:
//   1. Start the query → get a queryId
//   2. Poll GetQueryResults until status is Complete
//
// This wrapper handles the polling internally so
// the caller gets a simple async function that
// resolves with results.
// ─────────────────────────────────────────────

export interface LogEntry {
  timestamp: string;
  message: string;
}

export async function queryLogs(params: {
  logGroupName: string;
  streamPrefix?: string;
  startTime: number; // Unix seconds
  endTime: number;   // Unix seconds
  limit?: number;
}): Promise<LogEntry[]> {
  const { logGroupName, streamPrefix, startTime, endTime, limit = 200 } = params;

  // Build the Insights query.
  // If a stream prefix is given (e.g. a specific deployment's
  // container logs), filter to only that stream.
  const filterClause = streamPrefix
    ? `| filter @logStream like /^${streamPrefix}/`
    : '';

  const queryString = `
    fields @timestamp, @message
    ${filterClause}
    | sort @timestamp desc
    | limit ${limit}
  `;

  const startResult = await cloudWatchLogsClient.send(
    new StartQueryCommand({
      logGroupName,
      startTime,
      endTime,
      queryString,
      limit,
    })
  );

  const queryId = startResult.queryId;
  if (!queryId) throw new Error('Failed to start CloudWatch Logs Insights query');

  return pollQueryResults(queryId);
}

async function pollQueryResults(
  queryId: string,
  maxAttempts = 15,
  delayMs = 1000
): Promise<LogEntry[]> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await cloudWatchLogsClient.send(
      new GetQueryResultsCommand({ queryId })
    );

    if (result.status === QueryStatus.Complete) {
      return (result.results ?? []).map((row) => {
        const timestamp = row.find((f) => f.field === '@timestamp')?.value ?? '';
        const message = row.find((f) => f.field === '@message')?.value ?? '';
        return { timestamp, message };
      });
    }

    if (
      result.status === QueryStatus.Failed ||
      result.status === QueryStatus.Cancelled
    ) {
      throw new Error(`CloudWatch Logs query ${result.status}`);
    }

    // Still running — wait and retry
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error('CloudWatch Logs query timed out');
}