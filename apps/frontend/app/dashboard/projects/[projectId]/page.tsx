'use client';

import useSWR from 'swr';
import { useParams, useRouter } from 'next/navigation';
import { projectsApi } from '@/lib/api/projects';
import { useDeploymentsList } from '@/lib/hooks/useDeploymentPolling';
import { environmentsApi } from '@/lib/api/environments';
import { DeploymentRow } from '@/components/deployments/DeploymentRow';
import { DeployButton } from '@/components/deployments/DeployButton';
import { MetricsPanel } from '@/components/projects/MetricsPanel';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Box, ArrowLeft, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.745 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: project } = useSWR(`project/${projectId}`, () =>
    projectsApi.get(projectId)
  );
  const { deployments, isLoading: deploymentsLoading } = useDeploymentsList(projectId);
  const { data: environments } = useSWR(`environments/${projectId}`, () =>
    environmentsApi.list(projectId)
  );

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    setDeleting(true);
    try {
      await projectsApi.delete(projectId);
      router.push('/dashboard');
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  if (!project) return null;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-start gap-3">
          {/* Back button */}
          <Link
            href="/dashboard"
            className="mt-1 flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
              {project.repoFullName && (
                <span className="flex items-center gap-1">
                  <GithubIcon className="h-3.5 w-3.5" />
                  {project.repoFullName} ({project.branch})
                </span>
              )}
              <span className="flex items-center gap-1">
                <Box className="h-3.5 w-3.5" />
                Port {project.port}
              </span>
            </div>
          </div>
        </div>

        {/* Right side — Deploy + Delete */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50
              ${confirmDelete
                ? 'border-red-500 bg-red-600 text-white'
                : 'border-gray-200 bg-white text-gray-500 hover:border-red-300 hover:text-red-500'
              }`}
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? 'Deleting…' : confirmDelete ? 'Confirm delete?' : 'Delete'}
          </button>
          <DeployButton projectId={projectId} />
        </div>
      </div>

      <div className="mb-6">
        <MetricsPanel projectId={projectId} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Deployments</h2>
            </CardHeader>
            <div>
              {deploymentsLoading && (
                <p className="p-4 text-sm text-gray-500">Loading deployments...</p>
              )}
              {!deploymentsLoading && deployments.length === 0 && (
                <p className="p-4 text-sm text-gray-500">
                  No deployments yet. Click Deploy to trigger your first one.
                </p>
              )}
              {deployments.map((deployment) => (
                <DeploymentRow
                  key={deployment.deploymentId}
                  projectId={projectId}
                  deployment={deployment}
                />
              ))}
            </div>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Environments</h2>
            </CardHeader>
            <CardBody className="space-y-3">
              {environments?.length === 0 && (
                <p className="text-sm text-gray-500">
                  Environments are created automatically on first deploy.
                </p>
              )}
              {environments?.map((env) => (
                <div
                  key={env.environmentId}
                  className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2"
                >
                  <span className="text-sm font-medium capitalize">{env.name}</span>
                  <span
                    className={`text-xs font-medium ${
                      env.status === 'RUNNING'
                        ? 'text-green-600'
                        : env.status === 'DESTROYED'
                        ? 'text-gray-400'
                        : 'text-amber-600'
                    }`}
                  >
                    {env.status}
                  </span>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}