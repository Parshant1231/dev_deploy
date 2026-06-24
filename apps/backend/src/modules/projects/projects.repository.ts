import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { docClient } from '../../aws/dynamodb';
import { config } from '../../config/env';
import { Project } from '../../shared/types';

export class ProjectsRepository {
  private readonly tableName = config.tables.projects;

  async findById(projectId: string): Promise<Project | null> {
    const result = await docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { projectId },
      })
    );
    return (result.Item as Project) ?? null;
  }

  async findByUserId(userId: string): Promise<Project[]> {
    const result = await docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'userId-index',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
      })
    );
    return (result.Items as Project[]) ?? [];
  }

  async create(project: Project): Promise<Project> {
    await docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: project,
        ConditionExpression: 'attribute_not_exists(projectId)',
      })
    );
    return project;
  }

  async update(
    projectId: string,
    updates: Partial<Project>
  ): Promise<void> {
    const updateExpressions: string[] = [];
    const expressionAttributeValues: Record<string, unknown> = {};
    const expressionAttributeNames: Record<string, string> = {};

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && key !== 'projectId') {
        const attrName = `#${key}`;
        const attrValue = `:${key}`;
        updateExpressions.push(`${attrName} = ${attrValue}`);
        expressionAttributeNames[attrName] = key;
        expressionAttributeValues[attrValue] = value;
      }
    });

    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();

    await docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { projectId },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: 'attribute_exists(projectId)',
      })
    );
  }

  async delete(projectId: string): Promise<void> {
    await docClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { projectId },
      })
    );
  }
}