import Link from 'next/link';
import { Deployment } from '@/types';
import { DeploymentStatusBadge } from './DeploymentStatusBadge';
import { formatDistanceToNow } from 'date-fns';
import { GitCommit } from 'lucide-react';

export function DeploymentRow({
  projectId,
  deployment,
}: {
  projectId: string;
  deployment: Deployment;
}) {
  return (
    <Link
      href={`/dashboard/projects/${projectId}/deployments/${deployment.deploymentId}`}
      className="flex items-center justify-between border-b border-gray-100 px-4 py-3 last:border-0 hover:bg-gray-50"
    >
      <div className="flex items-center gap-3">
        <GitCommit className="h-4 w-4 text-gray-400" />
        <div>
          <p className="text-sm font-medium text-gray-900">
            {deployment.commitMessage ?? 'No commit message'}
          </p>
          <p className="text-xs text-gray-500">
            {deployment.commitSha?.slice(0, 7)} · {deployment.environment} ·{' '}
            {formatDistanceToNow(new Date(deployment.createdAt))} ago
          </p>
        </div>
      </div>
      <DeploymentStatusBadge status={deployment.status} />
    </Link>
  );
}