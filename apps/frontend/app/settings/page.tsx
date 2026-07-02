'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { authApi } from '@/lib/api/auth';
import { Button } from '@/components/ui/Button';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, CheckCircle2, LogOut,
  User, Zap, Unlink, ExternalLink,
} from 'lucide-react';

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.745 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

const GITHUB_CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
const GITHUB_REDIRECT_URI =
  process.env.NEXT_PUBLIC_GITHUB_REDIRECT_URI ??
  'http://localhost:3001/api/v1/auth/github/callback';

export default function SettingsPage() {
  const { user, refresh, logout } = useAuth();
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [patValue, setPatValue] = useState('');
  const [patLoading, setPatLoading] = useState(false);
  const [patError, setPatError] = useState<string | null>(null);

  // Ref ensures this runs exactly once on mount, even with Turbopack fast-refresh
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    // Read directly from window.location — avoids Next.js router stale state
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') !== 'true') return;

    handledRef.current = true;
    // Strip the query param immediately so the middleware doesn't re-process it
    window.history.replaceState({}, '', '/settings');

    // Short delay so the browser cookie from the JWT is fully readable by SWR
    setTimeout(async () => {
      await refresh();
      setSuccessMsg('GitHub connected successfully! You can now deploy repositories.');
    }, 300);
  // run once on mount only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleConnectGithub() {
    if (!user?.userId) return;
    const params = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID ?? '',
      redirect_uri: GITHUB_REDIRECT_URI,
      scope: 'repo workflow read:user',
      state: user.userId,
    });
    window.location.href = `https://github.com/login/oauth/authorize?${params}`;
  }

  async function handleDisconnect() {
    setIsDisconnecting(true);
    try {
      await authApi.disconnectGithub();
      await refresh();
      setSuccessMsg(null);
    } finally {
      setIsDisconnecting(false);
    }
  }

  async function handleConnectPat(e: React.FormEvent) {
    e.preventDefault();
    if (!patValue.trim()) return;
    setPatLoading(true);
    setPatError(null);
    try {
      await authApi.connectGithubPat(patValue.trim());
      await refresh();
      setPatValue('');
      setSuccessMsg('GitHub connected via Personal Access Token!');
    } catch (err) {
      setPatError(err instanceof Error ? err.message : 'Failed to connect PAT');
    } finally {
      setPatLoading(false);
    }
  }

  const initials = user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <div className="space-y-8">

      {/* ── Header ─────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="text-sm text-gray-500">Manage your account and integrations</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>

      {/* ── Success banner ─────────────────────── */}
      {successMsg && (
        <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800">{successMsg}</p>
            <Link
              href="/dashboard"
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:underline"
            >
              Go to Dashboard <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-green-400 hover:text-green-600 text-lg leading-none">×</button>
        </div>
      )}

      {/* ── Account card ───────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <User className="h-4 w-4 text-indigo-500" />
            Account
          </div>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-center gap-4">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-14 w-14 rounded-full border-2 border-white shadow" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-xl font-bold text-white shadow">
                {initials}
              </div>
            )}
            <div>
              <p className="font-semibold text-gray-900">{user?.email}</p>
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Active
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── GitHub Integration card ─────────────── */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-slate-50 px-6 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <GithubIcon className="h-4 w-4" />
            GitHub Integration
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {user?.githubLogin ? (
            <div className="space-y-4">
              {/* Connected row */}
              <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-900">
                    <GithubIcon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">@{user.githubLogin}</p>
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Connected
                    </p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  isLoading={isDisconnecting}
                  onClick={handleDisconnect}
                  className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                >
                  <Unlink className="h-3.5 w-3.5" />
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Not connected */}
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-5 py-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-900">
                  <GithubIcon className="h-6 w-6 text-white" />
                </div>
                <p className="text-sm font-medium text-gray-800">Connect your GitHub account</p>
                <p className="mt-1 text-xs text-gray-500">
                  Required to browse repos and trigger deployments via GitHub Actions
                </p>
                <Button className="mt-4 gap-2" onClick={handleConnectGithub}>
                  <GithubIcon className="h-4 w-4" />
                  Connect GitHub via OAuth
                </Button>
              </div>

              {/* PAT fallback */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-xs text-gray-400">or use a Personal Access Token</span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>
                <form onSubmit={handleConnectPat} className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={patValue}
                      onChange={(e) => setPatValue(e.target.value)}
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <Button type="submit" size="sm" isLoading={patLoading} disabled={!patValue.trim()}>
                      <Zap className="h-3.5 w-3.5" />
                      Connect
                    </Button>
                  </div>
                  {patError && <p className="text-xs text-red-600">{patError}</p>}
                  <p className="text-xs text-gray-400">
                    PAT needs scopes: <code className="rounded bg-gray-100 px-1">repo</code>{' '}
                    <code className="rounded bg-gray-100 px-1">workflow</code>{' '}
                    <code className="rounded bg-gray-100 px-1">read:user</code>{' — '}
                    <a
                      href="https://github.com/settings/tokens/new?scopes=repo,workflow,read:user"
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 hover:underline"
                    >
                      Create one here ↗
                    </a>
                  </p>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Quick nav ──────────────────────────── */}
      <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-6 py-4 shadow-sm">
        <p className="text-sm text-gray-500">Ready to deploy?</p>
        <Link href="/dashboard">
          <Button size="sm" className="gap-2">
            <Zap className="h-4 w-4" />
            Go to Dashboard
          </Button>
        </Link>
      </div>

    </div>
  );
}
