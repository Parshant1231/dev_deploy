import {
  CloudWatchClient,
  GetMetricDataCommand,
} from '@aws-sdk/client-cloudwatch';
import { config } from '../../config/env';
import { DeploymentsRepository } from '../deployments/deployments.repository';
import { ProjectsRepository } from '../projects/projects.repository';
import { AppError } from '../../shared/errors/AppError';

const cloudWatchClient = new CloudWatchClient({ region: config.awsRegion });

export interface PlatformMetricsSummary {
  totalDeployments: number;
  successfulDeployments: number;
  failedDeployments: number;
  successRate: number;
  averageBuildTimeSeconds: number | null;
}

export class MetricsService {
  private readonly deploymentsRepo = new DeploymentsRepository();
  private readonly projectsRepo = new ProjectsRepository();

  // ─────────────────────────────────────────────
  // PROJECT METRICS SUMMARY
  //
  // Computed directly from DynamoDB deployment records
  // rather than CloudWatch — this data is already
  // structured and queryable, no need for an
  // external metrics round trip for simple aggregates.
  // ─────────────────────────────────────────────

  async getProjectMetricsSummary(
    projectId: string,
    userId: string
  ): Promise<PlatformMetricsSummary> {
    const project = await this.projectsRepo.findById(projectId);
    if (!project) throw AppError.notFound('Project not found');
    if (project.userId !== userId) throw AppError.forbidden('Access denied');

    const deployments = await this.deploymentsRepo.findByProjectId(projectId, 100);

    const total = deployments.length;
    const successful = deployments.filter((d) => d.status === 'RUNNING').length;
    const failed = deployments.filter((d) => d.status === 'FAILED').length;

    const buildTimes = deployments
      .filter((d) => d.buildStartedAt && d.buildFinishedAt)
      .map((d) => {
        const start = new Date(d.buildStartedAt!).getTime();
        const end = new Date(d.buildFinishedAt!).getTime();
        return (end - start) / 1000;
      });

    const averageBuildTimeSeconds =
      buildTimes.length > 0
        ? buildTimes.reduce((sum, t) => sum + t, 0) / buildTimes.length
        : null;

    return {
      totalDeployments: total,
      successfulDeployments: successful,
      failedDeployments: failed,
      successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
      averageBuildTimeSeconds,
    };
  }

  // ─────────────────────────────────────────────
  // ECS RESOURCE METRICS
  //
  // Pulls real CPU/Memory data from CloudWatch for
  // a specific ECS service tied to a deployment's
  // environment. This is genuine infrastructure
  // telemetry, not derived from our own database.
  // ─────────────────────────────────────────────

  async getEcsResourceMetrics(
    serviceName: string,
    clusterName: string
  ): Promise<{
    cpuUtilization: number[];
    memoryUtilization: number[];
    timestamps: string[];
  }> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const result = await cloudWatchClient.send(
      new GetMetricDataCommand({
        StartTime: oneHourAgo,
        EndTime: now,
        MetricDataQueries: [
          {
            Id: 'cpu',
            MetricStat: {
              Metric: {
                Namespace: 'AWS/ECS',
                MetricName: 'CPUUtilization',
                Dimensions: [
                  { Name: 'ClusterName', Value: clusterName },
                  { Name: 'ServiceName', Value: serviceName },
                ],
              },
              Period: 300,
              Stat: 'Average',
            },
          },
          {
            Id: 'memory',
            MetricStat: {
              Metric: {
                Namespace: 'AWS/ECS',
                MetricName: 'MemoryUtilization',
                Dimensions: [
                  { Name: 'ClusterName', Value: clusterName },
                  { Name: 'ServiceName', Value: serviceName },
                ],
              },
              Period: 300,
              Stat: 'Average',
            },
          },
        ],
      })
    );

    const cpuResult = result.MetricDataResults?.find((r) => r.Id === 'cpu');
    const memResult = result.MetricDataResults?.find((r) => r.Id === 'memory');

    return {
      cpuUtilization: cpuResult?.Values ?? [],
      memoryUtilization: memResult?.Values ?? [],
      timestamps: (cpuResult?.Timestamps ?? []).map((t) => t.toISOString()),
    };
  }
}