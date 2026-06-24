import { EventsRepository } from './events.repository';
import { DeploymentEvent, EventType } from '../../shared/types';

// The EventsService is used internally by other services.
// When DeploymentsService updates a status, it also calls
// EventsService.record() to append to the audit log.
// This creates a complete, queryable timeline for every deployment.

export class EventsService {
  private readonly repo = new EventsRepository();

  async record(
    event: Omit<DeploymentEvent, 'eventId' | 'createdAt'>
  ): Promise<DeploymentEvent> {
    return this.repo.create(event);
  }

  async getDeploymentTimeline(deploymentId: string): Promise<DeploymentEvent[]> {
    return this.repo.findByDeploymentId(deploymentId);
  }
}