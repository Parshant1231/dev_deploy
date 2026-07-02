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
        return isActive ? 3000 : 0; // Stop polling when terminal
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
      refreshInterval: 10000,
    }
  );

  return {
    deployments: data ?? [],
    error,
    isLoading,
    refresh: mutate,
  };
}