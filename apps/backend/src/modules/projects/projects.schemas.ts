import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim().optional(),
  branch: z.string().min(1).default('main'),
  framework: z.enum(['nodejs', 'react', 'nextjs', 'static']),
  buildCommand: z.string().max(200).trim().optional(),
  startCommand: z.string().max(200).trim().optional(),
  port: z.number().int().min(1).max(65535).default(3000),
  envVars: z.record(z.string(), z.string()).optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

export const linkRepoSchema = z.object({
  repoFullName: z.string().min(1), // e.g. "username/repo-name"
  repoUrl: z.string().url(),
  branch: z.string().min(1).default('main'),
  appDirectory: z.string().optional(), // e.g. "apps/sample-app" for monorepos
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type LinkRepoInput = z.infer<typeof linkRepoSchema>;
