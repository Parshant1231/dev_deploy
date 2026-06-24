import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { docClient } from '../../aws/dynamodb';
import { config } from '../../config/env';
import { Environment, EnvironmentStatus } from '../../shared/types';

export class EnvironmentsRepository {
  private readonly tableName = config.tables.environments;

  async findByProjectId(projectId: string): Promise<Environment[]> {
    const result = await docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'projectId-index',
        KeyConditionExpression: 'projectId = :projectId',
        ExpressionAttributeValues: { ':projectId': projectId },
      })
    );
    return (result.Items as Environment[]) ?? [];
  }

  async findById(
    environmentId: string,
    projectId: string
  ): Promise<Environment | null> {
    const result = await docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { environmentId, projectId },
      })
    );
    return (result.Item as Environment) ?? null;
  }

  async create(environment: Environment): Promise<Environment> {
    await docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: environment,
        ConditionExpression: 'attribute_not_exists(environmentId)',
      })
    );
    return environment;
  }

  async updateStatus(
    environmentId: string,
    projectId: string,
    status: EnvironmentStatus,
    additionalUpdates?: Partial<Environment>
  ): Promise<void> {
    const now = new Date().toISOString();

    await docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { environmentId, projectId },
        UpdateExpression:
          'SET #status = :status, updatedAt = :updatedAt, ' +
          'lastActivityAt = :now',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': status,
          ':updatedAt': now,
          ':now': now,
          ...additionalUpdates,
        },
      })
    );
  }

  async updateTTL(
    environmentId: string,
    projectId: string,
    ttlHours: number
  ): Promise<void> {
    const ttl = Math.floor(Date.now() / 1000) + ttlHours * 3600;

    await docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { environmentId, projectId },
        UpdateExpression: 'SET ttl = :ttl, ttlHours = :ttlHours, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':ttl': ttl,
          ':ttlHours': ttlHours,
          ':updatedAt': new Date().toISOString(),
        },
      })
    );
  }
}