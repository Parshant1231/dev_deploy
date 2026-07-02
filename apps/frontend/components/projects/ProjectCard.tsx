'use client';

import Link from 'next/link';
import { Project } from '@/types';
import { Card, CardBody } from '@/components/ui/Card';
import { formatDistanceToNow } from 'date-fns';
import { Box, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { projectsApi } from '@/lib/api/projects';
import { useSWRConfig } from 'swr';

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.745 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

const frameworkLabels: Record<Project['framework'], string> = {
  nodejs: 'Node.js',
  react: 'React',
  nextjs: 'Next.js',
  static: 'Static Site',
};

export function ProjectCard({ project }: { project: Project }) {
  const { mutate } = useSWRConfig();
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm) {
      setConfirm(true);
      // Auto-cancel confirm state after 3 seconds
      setTimeout(() => setConfirm(false), 3000);
      return;
    }

    setDeleting(true);
    try {
      await projectsApi.delete(project.projectId);
      // Refresh the projects list
      mutate('projects');
    } catch {
      setDeleting(false);
      setConfirm(false);
    }
  }

  return (
    <div className="relative group">
      <Link href={`/dashboard/projects/${project.projectId}`}>
        <Card className="transition-shadow hover:shadow-md">
          <CardBody>
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0 pr-2">
                <h3 className="font-semibold text-gray-900 truncate">{project.name}</h3>
                {project.description && (
                  <p className="mt-1 text-sm text-gray-500 truncate">{project.description}</p>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                {frameworkLabels[project.framework]}
              </span>
            </div>

            <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
              {project.repoFullName ? (
                <span className="flex items-center gap-1 truncate">
                  <GithubIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{project.repoFullName}</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-600">
                  <GithubIcon className="h-3.5 w-3.5 shrink-0" />
                  No repository linked
                </span>
              )}
              <span className="flex items-center gap-1 shrink-0">
                <Box className="h-3.5 w-3.5" />
                Port {project.port}
              </span>
            </div>

            <p className="mt-3 text-xs text-gray-400">
              Updated {formatDistanceToNow(new Date(project.updatedAt))} ago
            </p>
          </CardBody>
        </Card>
      </Link>

      {/* Delete button — shown on hover */}
      <button
        onClick={handleDelete}
        disabled={deleting}
        title={confirm ? 'Click again to confirm delete' : 'Delete project'}
        className={`
          absolute top-2 right-2 z-10
          flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium
          transition-all duration-150
          opacity-0 group-hover:opacity-100
          ${confirm
            ? 'bg-red-600 text-white opacity-100'
            : 'bg-white border border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500 shadow-sm'
          }
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
      >
        <Trash2 className="h-3.5 w-3.5" />
        {deleting ? 'Deleting…' : confirm ? 'Confirm?' : ''}
      </button>
    </div>
  );
}
