'use client';

import useSWR from 'swr';
import { deploymentsApi } from '@/lib/api/deployments';
import { ACTIVE_STATUSES } from '@/components/deployments/DeploymentStatusBadge';

// ─────────────────────────────────────────────
// useDeploymentPolling
//
// Polls a single deployment every 3 seconds WHILE
// it is in an active state (PENDING/BUILDING/etc).
// Stops polling automatically once it reaches a
// terminal state (RUNNING, FAILED, CANCELLED, DESTROYED).
//
// This is the key pattern: SWR's refreshInterval
// can be a function of the current data, so we
// return 0 (no polling) once the deployment is done.
// ─────────────────────────────────────────────

export function useDeploymentPolling(projectId: string, deploymentId: string) {
  const { data, error, isLoading, mutate } = useSWR(
    deploymentId ? `deployment/${projectId}/${deploymentId}` : null,
    () => deploymentsApi.get(projectId, deploymentId),
    {
      refreshInterval: (latestData) => {
        if (!latestData) return 3000;
        const isActive = ACTIVE_STATUSES.includes(latestData.status);
        if (!isActive) return 0; // terminal state — stop polling

        // Safety timeout: if stuck in PENDING for more than 10 minutes,
        // stop polling (the workflow likely failed silently without updating status)
        if (latestData.status === 'PENDING') {
          const ageMs = Date.now() - new Date(latestData.createdAt).getTime();
          if (ageMs > 10 * 60 * 1000) return 0; // 10 minutes
        }

        return 3000;
      },
      revalidateOnFocus: true,
    }
  );

  return {
    deployment: data,
    error,
    isLoading,
    refresh: mutate,
    isPolling: data ? ACTIVE_STATUSES.includes(data.status) : false,
  };
}

// ─────────────────────────────────────────────
// useDeploymentsList
// Polls the list of deployments for a project.
// Slower interval (10s) since this is a list view,
// not a focused detail view.
// ─────────────────────────────────────────────

export function useDeploymentsList(projectId: string) {
  const { data, error, isLoading, mutate } = useSWR(
    projectId ? `deployments/${projectId}` : null,
    () => deploymentsApi.list(projectId),
    {
      // Only keep polling if at least one deployment is still active.
      // Once all are terminal (FAILED/RUNNING/CANCELLED), stop polling.
      refreshInterval: (latestData) => {
        if (!latestData || latestData.length === 0) return 0;
        const hasActive = latestData.some((d) =>
          ACTIVE_STATUSES.includes(d.status)
        );
        return hasActive ? 5000 : 0;
      },
    }
  );

  return {
    deployments: data ?? [],
    error,
    isLoading,
    refresh: mutate,
  };
}