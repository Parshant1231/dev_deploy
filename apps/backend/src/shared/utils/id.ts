// apps/backend/src/shared/utils/id.ts
import { randomUUID } from 'node:crypto';

// Each entity type gets its own prefix for readability.
// "dep_abc123" is immediately recognizable as a deployment ID.
// This prevents passing the wrong ID type to the wrong function.

export const generateId = {
  user: (): string => `usr_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
  project: (): string => `prj_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
  deployment: (): string => `dep_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
  environment: (): string => `env_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
  event: (): string => `evt_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
};