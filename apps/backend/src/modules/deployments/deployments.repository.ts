import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { docClient } from '../../aws/dynamodb';
import { config } from '../../config/env';
import { Deployment, DeploymentStatus } from '../../shared/types';

export class DeploymentsRepository {
  private readonly tableName = config.tables.deployments;

  async findById(deploymentId: string, projectId: string): Promise<Deployment | null> {
    const result = await docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { deploymentId, projectId },
      })
    );
    return (result.Item as Deployment) ?? null;
  }

  async findByProjectId(
    projectId: string,
    limit = 20
  ): Promise<Deployment[]> {
    const result = await docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'projectId-createdAt-index',
        KeyConditionExpression: 'projectId = :projectId',
        ExpressionAttributeValues: { ':projectId': projectId },
        ScanIndexForward: false, // newest first
        Limit: limit,
      })
    );
    return (result.Items as Deployment[]) ?? [];
  }

  async findActiveByProjectAndEnvironment(
    projectId: string,
    environment: string
  ): Promise<Deployment | null> {
    const activeStatuses: DeploymentStatus[] = [
      'PENDING', 'BUILDING', 'PUSHING_IMAGE', 'DEPLOYING',
    ];

    const result = await docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'projectId-createdAt-index',
        KeyConditionExpression: 'projectId = :projectId',
        FilterExpression:
          '#env = :environment AND #status IN (:s1, :s2, :s3, :s4)',
        ExpressionAttributeNames: {
          '#env': 'environment',
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':projectId': projectId,
          ':environment': environment,
          ':s1': activeStatuses[0],
          ':s2': activeStatuses[1],
          ':s3': activeStatuses[2],
          ':s4': activeStatuses[3],
        },
        ScanIndexForward: false,
        Limit: 1,
      })
    );

    if (!result.Items || result.Items.length === 0) return null;
    return result.Items[0] as Deployment;
  }

  async create(deployment: Deployment): Promise<Deployment> {
    await docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: deployment,
        ConditionExpression: 'attribute_not_exists(deploymentId)',
      })
    );
    return deployment;
  }

  async updateStatus(
    deploymentId: string,
    projectId: string,
    status: DeploymentStatus,
    additionalUpdates?: Partial<Deployment>
  ): Promise<void> {
    const updates: Record<string, unknown> = {
      ':status': status,
      ':updatedAt': new Date().toISOString(),
    };

    let updateExpr = 'SET #status = :status, updatedAt = :updatedAt';

    if (additionalUpdates) {
      Object.entries(additionalUpdates).forEach(([key, value]) => {
        if (value !== undefined) {
          updates[`:${key}`] = value;
          updateExpr += `, ${key} = :${key}`;
        }
      });
    }

    await docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { deploymentId, projectId },
        UpdateExpression: updateExpr,
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: updates,
      })
    );
  }
}