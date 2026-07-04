'use client';

import useSWR from 'swr';
import { metricsApi } from '@/lib/api/metrics';
import { Card, CardBody } from '@/components/ui/Card';
import { TrendingUp, CheckCircle2, XCircle, Clock } from 'lucide-react';

export function MetricsPanel({ projectId }: { projectId: string }) {
  const { data: metrics } = useSWR(`metrics-summary/${projectId}`, () =>
    metricsApi.getProjectSummary(projectId)
  );

  if (!metrics) return null;

  const stats = [
    {
      label: 'Success Rate',
      value: `${metrics.successRate}%`,
      icon: TrendingUp,
      color: metrics.successRate >= 80 ? 'text-green-600' : 'text-amber-600',
    },
    {
      label: 'Successful',
      value: metrics.successfulDeployments,
      icon: CheckCircle2,
      color: 'text-green-600',
    },
    {
      label: 'Failed',
      value: metrics.failedDeployments,
      icon: XCircle,
      color: 'text-red-600',
    },
    {
      label: 'Avg Build Time',
      value: metrics.averageBuildTimeSeconds
        ? `${Math.round(metrics.averageBuildTimeSeconds)}s`
        : '—',
      icon: Clock,
      color: 'text-gray-600',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardBody className="text-center">
            <stat.icon className={`mx-auto mb-1.5 h-4 w-4 ${stat.color}`} />
            <p className="text-lg font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-500">{stat.label}</p>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}