import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { config } from '../config/env';

export const eventBridgeClient = new EventBridgeClient({
  region: config.awsRegion,
});