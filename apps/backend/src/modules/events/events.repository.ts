import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../../aws/dynamodb';
import { config } from '../../config/env';
import { DeploymentEvent, EventType } from '../../shared/types';
import { generateId } from '../../shared/utils/id';

export class EventsRepository {
  private readonly tableName = config.tables.events;

  async create(
    event: Omit<DeploymentEvent, 'eventId' | 'createdAt'>
  ): Promise<DeploymentEvent> {
    const fullEvent: DeploymentEvent = {
      ...event,
      eventId: generateId.event(),
      createdAt: new Date().toISOString(),
    };

    await docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: fullEvent,
      })
    );

    return fullEvent;
  }

  async findByDeploymentId(deploymentId: string): Promise<DeploymentEvent[]> {
    const result = await docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'deploymentId-createdAt-index',
        KeyConditionExpression: 'deploymentId = :deploymentId',
        ExpressionAttributeValues: { ':deploymentId': deploymentId },
        ScanIndexForward: true, // oldest first for timeline display
      })
    );
    return (result.Items as DeploymentEvent[]) ?? [];
  }
}