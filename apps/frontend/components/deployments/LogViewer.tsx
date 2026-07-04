'use client';

import useSWR from 'swr';
import { logsApi } from '@/lib/api/logs';
import { Terminal, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

export function LogViewer({
  projectId,
  deploymentId,
  isActive,
}: {
  projectId: string;
  deploymentId: string;
  isActive: boolean;
}) {
  // Poll logs every 5 seconds while the deployment is still active.
  // Once terminal, fetch once and stop — logs won't change after that.
  const { data: logs, isLoading, mutate } = useSWR(
    `logs/${projectId}/${deploymentId}`,
    () => logsApi.getDeploymentLogs(projectId, deploymentId),
    {
      refreshInterval: isActive ? 5000 : 0,
    }
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-800 px-4 py-2.5">
        <span className="flex items-center gap-2 text-xs font-medium text-gray-400">
          <Terminal className="h-3.5 w-3.5" />
          Application Logs
        </span>
        <button
          onClick={() => mutate()}
          className="text-gray-500 hover:text-gray-300"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto p-4 font-mono text-xs">
        {isLoading && <p className="text-gray-500">Loading logs...</p>}

        {!isLoading && (!logs || logs.length === 0) && (
          <p className="text-gray-500">
            No logs available yet. Logs typically appear within 30 seconds of
            container startup.
          </p>
        )}

        {logs?.map((log, i) => (
          <div key={i} className="mb-1 flex gap-3 text-gray-300">
            <span className="shrink-0 text-gray-500">
              {format(new Date(parseInt(log.timestamp, 10) || Date.now()), 'HH:mm:ss')}
            </span>
            <span className="break-all">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}