'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { projectsApi } from '@/lib/api/projects';
import { RepoPicker } from '@/components/projects/RepoPicker';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { GithubRepository, Project } from '@/types';

const frameworks: { value: Project['framework']; label: string }[] = [
  { value: 'nodejs', label: 'Node.js' },
  { value: 'react', label: 'React' },
  { value: 'nextjs', label: 'Next.js' },
  { value: 'static', label: 'Static Site' },
];

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState<'repo' | 'configure'>('repo');
  const [selectedRepo, setSelectedRepo] = useState<GithubRepository | null>(null);
  const [name, setName] = useState('');
  const [framework, setFramework] = useState<Project['framework']>('nodejs');
  const [port, setPort] = useState(3000);
  const [branch, setBranch] = useState('main');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleRepoSelect(repo: GithubRepository) {
    setSelectedRepo(repo);
    setName(repo.full_name.split('/')[1]);
    setBranch(repo.default_branch);
    setStep('configure');
  }

  async function handleCreate() {
    if (!selectedRepo) return;
    setError(null);
    setIsSubmitting(true);

    try {
      const project = await projectsApi.create({
        name,
        framework,
        branch,
        port,
      });

      await projectsApi.linkRepo(project.projectId, {
        repoFullName: selectedRepo.full_name,
        repoUrl: selectedRepo.clone_url,
        branch,
      });

      router.push(`/dashboard/projects/${project.projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 text-2xl font-bold">New Project</h1>
      <p className="mb-6 text-sm text-gray-500">
        {step === 'repo'
          ? 'Select a GitHub repository to deploy'
          : 'Configure your deployment settings'}
      </p>

      <Card>
        <CardBody>
          {step === 'repo' && (
            <RepoPicker selected={selectedRepo} onSelect={handleRepoSelect} />
          )}

          {step === 'configure' && selectedRepo && (
            <div className="space-y-4">
              <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
                Repository: <span className="font-medium">{selectedRepo.full_name}</span>
              </div>

              <Input
                label="Project Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Framework
                </label>
                <select
                  value={framework}
                  onChange={(e) => setFramework(e.target.value as Project['framework'])}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {frameworks.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Branch"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
              />

              <Input
                label="Application Port"
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
              />

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="secondary" onClick={() => setStep('repo')}>
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleCreate}
                  isLoading={isSubmitting}
                  disabled={!name}
                >
                  Create Project
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}