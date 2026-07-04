'use client';

import { useParams, useRouter } from 'next/navigation';
import { useDeploymentPolling } from '@/lib/hooks/useDeploymentPolling';
import { DeploymentStatusBadge } from '@/components/deployments/DeploymentStatusBadge';
import { DeploymentTimeline } from '@/components/deployments/DeploymentTimeline';
import { DeploymentActions } from '@/components/deployments/DeploymentActions';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { ExternalLink, GitCommit, Loader2, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { LogViewer } from '@/components/deployments/LogViewer';
import { MetricsPanel } from '@/components/projects/MetricsPanel';


export default function DeploymentDetailPage() {
  const { projectId, deploymentId } = useParams<{
    projectId: string;
    deploymentId: string;
  }>();
  
  const router = useRouter();

  const { deployment, refresh, isPolling } = useDeploymentPolling(
    projectId,
    deploymentId
  );

  if (!deployment) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div>
      {/* Back Button */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Project
        </button>
      </div>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">
              Deployment {deployment.deploymentId.slice(0, 12)}
            </h1>
            <DeploymentStatusBadge status={deployment.status} />
            {isPolling && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                Live
              </span>
            )}
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
            <GitCommit className="h-3.5 w-3.5" />
            {deployment.commitMessage} ({deployment.commitSha?.slice(0, 7)})
          </p>
        </div>

        {deployment.status === 'RUNNING' && deployment.albDnsName && (
          <a
            href={deployment.albDnsName.startsWith('http') ? deployment.albDnsName : `http://${deployment.albDnsName}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100"
          >
            Visit App
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {deployment.status === 'FAILED' && deployment.errorMessage && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong className="block">Error</strong>
          {deployment.errorMessage}
        </div>
      )}

      <div className="mb-6">
        <DeploymentActions
          projectId={projectId}
          deployment={deployment}
          onAction={() => refresh()}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Timeline</h2>
            </CardHeader>
            <CardBody>
              <DeploymentTimeline projectId={projectId} deploymentId={deploymentId} deploymentStatus={deployment.status} />
            </CardBody>
          </Card>
        </div>

        <div className="mt-6">
          <h2 className="mb-3 font-semibold">Logs</h2>
          <LogViewer
            projectId={projectId}
            deploymentId={deploymentId}
            isActive={isPolling}
          />
        </div>

        <div>
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Details</h2>
            </CardHeader>
            <CardBody className="space-y-3 text-sm">
              <DetailRow label="Environment" value={deployment.environment} />
              <DetailRow label="Branch" value={deployment.branch} />
              <DetailRow
                label="Created"
                value={format(new Date(deployment.createdAt), 'MMM d, HH:mm')}
              />
              {deployment.buildStartedAt && (
                <DetailRow
                  label="Build Started"
                  value={format(new Date(deployment.buildStartedAt), 'HH:mm:ss')}
                />
              )}
              {deployment.deployFinishedAt && (
                <DetailRow
                  label="Deploy Finished"
                  value={format(new Date(deployment.deployFinishedAt), 'HH:mm:ss')}
                />
              )}
              {deployment.imageUri && (
                <DetailRow label="Image" value={deployment.imageUri.split('/').pop() ?? ''} />
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-gray-50 pb-2 last:border-0 last:pb-0">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}