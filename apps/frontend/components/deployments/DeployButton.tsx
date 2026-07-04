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
      // commitSha is intentionally omitted here — the backend will resolve
      // the real SHA from the project's configured branch via the GitHub API.
      const deployment = await deploymentsApi.trigger(projectId, {
        environment: 'dev',
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