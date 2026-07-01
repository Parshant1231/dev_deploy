import {
  EventBridgeClient,
  PutEventsCommand,
  PutEventsRequestEntry,
} from '@aws-sdk/client-eventbridge';
import { config } from '../config/env';

export const eventBridgeClient = new EventBridgeClient({
  region: config.awsRegion,
});

// ─────────────────────────────────────────────
// EVENT TYPES
// Every event published to the bus has a type.
// Subscribers filter on event type.
// ─────────────────────────────────────────────

export type DeploymentEventType =
  | 'DeploymentCreated'
  | 'DeploymentBuildStarted'
  | 'DeploymentBuildCompleted'
  | 'DeploymentBuildFailed'
  | 'DeploymentPushStarted'
  | 'DeploymentPushCompleted'
  | 'DeploymentDeployStarted'
  | 'DeploymentRunning'
  | 'DeploymentFailed'
  | 'DeploymentCancelled'
  | 'DeploymentRetryScheduled'
  | 'EnvironmentIdle'
  | 'EnvironmentDestroyRequested'
  | 'EnvironmentDestroyed';

// ─────────────────────────────────────────────
// EVENT PAYLOAD
// Every event carries a consistent payload shape.
// This makes querying and debugging predictable.
// ─────────────────────────────────────────────

export interface DeploymentEventPayload {
  eventType: DeploymentEventType;
  deploymentId: string;
  projectId: string;
  userId: string;
  environment: string;
  status: string;
  previousStatus?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────
// PUBLISH FUNCTION
// Wraps the EventBridge PutEvents API.
// Handles batch publishing (EventBridge accepts up to 10 events per call).
// ─────────────────────────────────────────────

export async function publishDeploymentEvent(
  payload: DeploymentEventPayload
): Promise<void> {
  const entry: PutEventsRequestEntry = {
    EventBusName: config.eventBridgeBusName,
    Source: 'devdeploy.deployments',
    DetailType: payload.eventType,
    Detail: JSON.stringify(payload),
    Time: new Date(),
  };

  try {
    const result = await eventBridgeClient.send(
      new PutEventsCommand({ Entries: [entry] })
    );

    if (result.FailedEntryCount && result.FailedEntryCount > 0) {
      console.error('EventBridge publish failed:', result.Entries);
    }
  } catch (error) {
    // Event publishing failure must NOT break the deployment flow.
    // Log the error but do not throw — the deployment continues.
    // This is the "fire and forget" pattern for non-critical side effects.
    console.error('Failed to publish EventBridge event:', {
      eventType: payload.eventType,
      deploymentId: payload.deploymentId,
      error,
    });
  }
}

// Convenience function for publishing status change events
export async function publishStatusChange(params: {
  deploymentId: string;
  projectId: string;
  userId: string;
  environment: string;
  previousStatus: string;
  newStatus: string;
  eventType: DeploymentEventType;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await publishDeploymentEvent({
    eventType: params.eventType,
    deploymentId: params.deploymentId,
    projectId: params.projectId,
    userId: params.userId,
    environment: params.environment,
    status: params.newStatus,
    previousStatus: params.previousStatus,
    timestamp: new Date().toISOString(),
    metadata: params.metadata,
  });
}