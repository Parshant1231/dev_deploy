import Link from 'next/link';
import { Rocket } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="text-center">
        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600">
          <Rocket className="h-8 w-8 text-white" />
        </div>
        <h1 className="mb-3 text-4xl font-bold tracking-tight">DevDeploy</h1>
        <p className="mb-8 max-w-md text-gray-600">
          Connect a GitHub repository. Deploy to AWS automatically.
          Built for developers who want infrastructure that just works.
        </p>
        <div className="flex justify-center gap-3">
          <Link
            href="/register"
            className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Get Started
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Sign In
          </Link>
        </div>
      </div>
    </main>
  );
}