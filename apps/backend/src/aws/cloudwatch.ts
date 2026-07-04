import {
  CloudWatchClient,
  PutMetricDataCommand,
  StandardUnit,
} from '@aws-sdk/client-cloudwatch';
import { config } from '../config/env';

export const cloudWatchClient = new CloudWatchClient({
  region: config.awsRegion,
});

const NAMESPACE = 'DevDeploy/Deployments';

// ─────────────────────────────────────────────
// PUBLISH CUSTOM METRIC
//
// CloudWatch custom metrics let you track
// application-specific numbers — not just
// infrastructure CPU/memory. This is how the
// platform tracks ITS OWN health, not just AWS's view.
//
// Every metric is dimensioned by environment,
// so dev/staging/production stay separate in dashboards.
// ─────────────────────────────────────────────

export async function publishMetric(
  metricName: string,
  value: number,
  unit: StandardUnit = StandardUnit.Count
): Promise<void> {
  try {
    await cloudWatchClient.send(
      new PutMetricDataCommand({
        Namespace: NAMESPACE,
        MetricData: [
          {
            MetricName: metricName,
            Value: value,
            Unit: unit,
            Timestamp: new Date(),
            Dimensions: [
              { Name: 'Environment', Value: config.nodeEnv },
            ],
          },
        ],
      })
    );
  } catch (error) {
    // Never let metric publishing break the application flow
    console.error(`Failed to publish metric ${metricName}:`, error);
  }
}

// Convenience functions for the specific metrics this platform tracks
export const metrics = {
  deploymentCreated: () => publishMetric('DeploymentCreated', 1),
  deploymentSucceeded: () => publishMetric('DeploymentRunning', 1),
  deploymentFailed: () => publishMetric('DeploymentFailed', 1),
  deploymentDuration: (seconds: number) =>
    publishMetric('DeploymentDurationSeconds', seconds, StandardUnit.Seconds),
};