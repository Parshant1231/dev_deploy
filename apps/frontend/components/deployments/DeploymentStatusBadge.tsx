import { DeploymentStatus } from '@/types';
import { cn } from '@/lib/utils/cn';
import {
  Loader2, CheckCircle2, XCircle, Clock, Ban, Trash2, Upload, Rocket,
} from 'lucide-react';

// ─────────────────────────────────────────────
// Visual mapping for every deployment state.
// Color coding follows convention:
//   gray = waiting, blue = in progress,
//   green = success, red = failure, slate = terminal/inactive
// ─────────────────────────────────────────────

const statusConfig: Record<
  DeploymentStatus,
  { label: string; color: string; icon: typeof Clock; spin?: boolean }
> = {
  PENDING:       { label: 'Pending',         color: 'bg-gray-100 text-gray-700',     icon: Clock },
  BUILDING:      { label: 'Building',        color: 'bg-blue-100 text-blue-700',     icon: Loader2, spin: true },
  PUSHING_IMAGE: { label: 'Pushing Image',    color: 'bg-blue-100 text-blue-700',     icon: Upload, spin: true },
  DEPLOYING:     { label: 'Deploying',        color: 'bg-indigo-100 text-indigo-700', icon: Rocket, spin: true },
  RUNNING:       { label: 'Running',          color: 'bg-green-100 text-green-700',   icon: CheckCircle2 },
  FAILED:        { label: 'Failed',           color: 'bg-red-100 text-red-700',       icon: XCircle },
  CANCELLED:     { label: 'Cancelled',        color: 'bg-gray-100 text-gray-600',     icon: Ban },
  DESTROYED:     { label: 'Destroyed',        color: 'bg-slate-100 text-slate-600',   icon: Trash2 },
};

export function DeploymentStatusBadge({ status }: { status: DeploymentStatus }) {
  const cfg = statusConfig[status];
  const Icon = cfg.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        cfg.color
      )}
    >
      <Icon className={cn('h-3.5 w-3.5', cfg.spin && 'animate-spin')} />
      {cfg.label}
    </span>
  );
}

export const ACTIVE_STATUSES: DeploymentStatus[] = [
  'PENDING', 'BUILDING', 'PUSHING_IMAGE', 'DEPLOYING',
];