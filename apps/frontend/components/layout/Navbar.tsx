'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { Rocket, Settings, LogOut } from 'lucide-react';

export function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
            <Rocket className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold">DevDeploy</span>
        </Link>

        <div className="flex items-center gap-4">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600">
              {user?.email?.[0]?.toUpperCase()}
            </div>
          )}
          <Link href="/settings" className="text-gray-500 hover:text-gray-700">
            <Settings className="h-5 w-5" />
          </Link>
          <button onClick={logout} className="text-gray-500 hover:text-gray-700">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </nav>
  );
}