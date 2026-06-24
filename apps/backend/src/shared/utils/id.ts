import { v4 as uuidv4 } from 'uuid';

// Each entity type gets its own prefix for readability.
// "dep_abc123" is immediately recognizable as a deployment ID.
// This prevents passing the wrong ID type to the wrong function.

export const generateId = {
  user: (): string => `usr_${uuidv4().replace(/-/g, '').slice(0, 12)}`,
  project: (): string => `prj_${uuidv4().replace(/-/g, '').slice(0, 12)}`,
  deployment: (): string => `dep_${uuidv4().replace(/-/g, '').slice(0, 12)}`,
  environment: (): string => `env_${uuidv4().replace(/-/g, '').slice(0, 12)}`,
  event: (): string => `evt_${uuidv4().replace(/-/g, '').slice(0, 12)}`,
};