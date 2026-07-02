'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { authApi } from '@/lib/api/auth';
import { GithubRepository } from '@/types';
import { Search, Lock } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.745 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

interface RepoPickerProps {
  selected: GithubRepository | null;
  onSelect: (repo: GithubRepository) => void;
}

export function RepoPicker({ selected, onSelect }: RepoPickerProps) {
  const [search, setSearch] = useState('');
  const { data: repos, isLoading, error } = useSWR('github-repos', () =>
    authApi.listGithubRepos()
  );

  const filtered = (repos ?? []).filter((r) =>
    r.full_name.toLowerCase().includes(search.toLowerCase())
  );

  if (error) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Connect your GitHub account in Settings to select a repository.
      </div>
    );
  }

  return (
    <div>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search repositories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      )}

      <div className="max-h-64 space-y-1 overflow-y-auto">
        {filtered.map((repo) => (
          <button
            key={repo.id}
            type="button"
            onClick={() => onSelect(repo)}
            className={cn(
              'flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
              selected?.id === repo.id
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            )}
          >
            <span className="flex items-center gap-2">
              <GithubIcon className="h-4 w-4 text-gray-400" />
              {repo.full_name}
            </span>
            {repo.private && <Lock className="h-3.5 w-3.5 text-gray-400" />}
          </button>
        ))}
      </div>

      {!isLoading && filtered.length === 0 && (
        <p className="py-4 text-center text-sm text-gray-500">No repositories found</p>
      )}
    </div>
  );
}