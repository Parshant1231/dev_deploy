'use client';

import useSWR from 'swr';
import { deploymentsApi } from '@/lib/api/deployments';
import { format } from 'date-fns';
import { CheckCircle2, XCircle, Circle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ACTIVE_STATUSES } from './DeploymentStatusBadge';
import { DeploymentStatus } from '@/types';

export function DeploymentTimeline({
  projectId,
  deploymentId,
  deploymentStatus,
}: {
  projectId: string;
  deploymentId: string;
  deploymentStatus?: DeploymentStatus;
}) {
  const isActive = !deploymentStatus || ACTIVE_STATUSES.includes(deploymentStatus);

  const { data: events } = useSWR(
    `timeline/${projectId}/${deploymentId}`,
    () => deploymentsApi.getTimeline(projectId, deploymentId),
    // Stop polling once deployment reaches a terminal state
    { refreshInterval: isActive ? 4000 : 0 }
  );

  if (!events || events.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        {isActive && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        <span>No events recorded yet.</span>
      </div>
    );
  }

  return (
    <ol className="relative space-y-0">
      {events.map((event, i) => {
        const isFailure = event.type.includes('FAILED');
        const isLast = i === events.length - 1;

        return (
          <li key={event.eventId} className="relative flex gap-3 pb-6">
            {!isLast && (
              <span className="absolute left-[9px] top-5 h-full w-px bg-gray-200" />
            )}
            <span className="relative z-10 mt-0.5">
              {isFailure ? (
                <XCircle className="h-5 w-5 text-red-500" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              )}
            </span>
            <div>
              <p className={cn('text-sm font-medium', isFailure ? 'text-red-700' : 'text-gray-900')}>
                {event.message}
              </p>
              <p className="text-xs text-gray-400">
                {format(new Date(event.createdAt), 'MMM d, HH:mm:ss')}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}