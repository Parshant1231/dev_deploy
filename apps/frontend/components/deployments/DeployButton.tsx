'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deploymentsApi } from '@/lib/api/deployments';
import { Button } from '@/components/ui/Button';
import { Rocket } from 'lucide-react';

export function DeployButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [isDeploying, setIsDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDeploy() {
    setError(null);
    setIsDeploying(true);
    try {
      // In a real flow, commitSha comes from the latest commit on the branch.
      // For manual deploys without a webhook, we use a placeholder
      // that the pipeline resolves to HEAD of the configured branch.
      const deployment = await deploymentsApi.trigger(projectId, {
        environment: 'dev',
        commitSha: 'HEAD',
        commitMessage: 'Manual deployment',
      });
      router.push(`/dashboard/projects/${projectId}/deployments/${deployment.deploymentId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger deployment');
      setIsDeploying(false);
    }
  }

  return (
    <div>
      <Button onClick={handleDeploy} isLoading={isDeploying}>
        <Rocket className="h-4 w-4" />
        Deploy
      </Button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}