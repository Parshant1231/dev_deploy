import { Navbar } from '@/components/layout/Navbar';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="mx-auto max-w-3xl px-4 py-10">{children}</div>
    </div>
  );
}
