'use client';

import { useState } from 'react';
import { Deployment } from '@/types';
import { deploymentsApi } from '@/lib/api/deployments';
import { Button } from '@/components/ui/Button';
import { RotateCcw, History, Ban } from 'lucide-react';

export function DeploymentActions({
  projectId,
  deployment,
  onAction,
}: {
  projectId: string;
  deployment: Deployment;
  onAction: () => void;
}) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: string, fn: () => Promise<unknown>) {
    setError(null);
    setLoadingAction(action);
    try {
      await fn();
      onAction();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoadingAction(null);
    }
  }

  const canCancel = ['PENDING', 'BUILDING'].includes(deployment.status);
  const canRetry = deployment.status === 'FAILED';
  const canRollback = deployment.status === 'RUNNING';

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {canCancel && (
          <Button
            variant="danger"
            size="sm"
            isLoading={loadingAction === 'cancel'}
            onClick={() =>
              run('cancel', () => deploymentsApi.cancel(projectId, deployment.deploymentId))
            }
          >
            <Ban className="h-3.5 w-3.5" />
            Cancel
          </Button>
        )}

        {canRetry && (
          <Button
            variant="secondary"
            size="sm"
            isLoading={loadingAction === 'retry'}
            onClick={() =>
              run('retry', () => deploymentsApi.retry(projectId, deployment.deploymentId))
            }
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Retry
          </Button>
        )}

        {canRollback && (
          <Button
            variant="secondary"
            size="sm"
            isLoading={loadingAction === 'rollback'}
            onClick={() =>
              run('rollback', () => deploymentsApi.rollback(projectId, deployment.deploymentId))
            }
          >
            <History className="h-3.5 w-3.5" />
            Rollback to this version
          </Button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}