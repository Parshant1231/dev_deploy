import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

// Install js-yaml: npm install js-yaml @types/js-yaml
// in apps/backend

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface DevDeployConfig {
  build: {
    framework: 'nodejs' | 'react' | 'nextjs' | 'static' | 'docker';
    nodeVersion: number;
    installCommand: string;
    buildCommand: string;
    dockerfile?: string;
    buildContext: string;
  };
  run: {
    startCommand: string;
    port: number;
    healthCheckPath: string;
    healthCheckInterval: number;
  };
  resources: {
    cpu: 256 | 512 | 1024 | 2048;
    memory: 512 | 1024 | 2048 | 4096;
  };
  environments: {
    dev: { ttlHours: number };
    staging: { ttlHours: number };
    production: { ttlHours: number };
  };
}

// Raw shape of devdeploy.yml before normalization
interface RawConfig {
  build?: {
    framework?: string;
    node_version?: number;
    install_command?: string;
    build_command?: string;
    dockerfile?: string;
    build_context?: string;
  };
  run?: {
    start_command?: string;
    port?: number;
    health_check_path?: string;
    health_check_interval?: number;
  };
  resources?: {
    cpu?: number;
    memory?: number;
  };
  environments?: {
    dev?: { ttl_hours?: number };
    staging?: { ttl_hours?: number };
    production?: { ttl_hours?: number };
  };
}

// ─────────────────────────────────────────────
// FRAMEWORK AUTO-DETECTION
// ─────────────────────────────────────────────

export function detectFramework(
  repoPath: string
): DevDeployConfig['build']['framework'] {
  // If a Dockerfile exists, use it directly
  if (fs.existsSync(path.join(repoPath, 'Dockerfile'))) {
    return 'docker';
  }

  // Check for Next.js
  if (
    fs.existsSync(path.join(repoPath, 'next.config.js')) ||
    fs.existsSync(path.join(repoPath, 'next.config.ts'))
  ) {
    return 'nextjs';
  }

  // Check package.json for React
  const packageJsonPath = path.join(repoPath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };
      if (allDeps['react'] && !allDeps['next']) {
        return 'react';
      }
      return 'nodejs';
    } catch {
      return 'nodejs';
    }
  }

  // Static site — just HTML files
  if (fs.existsSync(path.join(repoPath, 'index.html'))) {
    return 'static';
  }

  return 'nodejs';
}

// ─────────────────────────────────────────────
// DEFAULT CONFIG PER FRAMEWORK
// ─────────────────────────────────────────────

function getFrameworkDefaults(
  framework: DevDeployConfig['build']['framework']
): Partial<DevDeployConfig> {
  const defaults: Record<string, Partial<DevDeployConfig>> = {
    nodejs: {
      build: {
        framework: 'nodejs',
        nodeVersion: 18,
        installCommand: 'npm ci',
        buildCommand: '',
        buildContext: '.',
      },
      run: {
        startCommand: 'node index.js',
        port: 3000,
        healthCheckPath: '/health',
        healthCheckInterval: 30,
      },
    },
    react: {
      build: {
        framework: 'react',
        nodeVersion: 18,
        installCommand: 'npm ci',
        buildCommand: 'npm run build',
        buildContext: '.',
      },
      run: {
        startCommand: 'nginx -g "daemon off;"',
        port: 80,
        healthCheckPath: '/',
        healthCheckInterval: 30,
      },
    },
    nextjs: {
      build: {
        framework: 'nextjs',
        nodeVersion: 18,
        installCommand: 'npm ci',
        buildCommand: 'npm run build',
        buildContext: '.',
      },
      run: {
        startCommand: 'node server.js',
        port: 3000,
        healthCheckPath: '/api/health',
        healthCheckInterval: 30,
      },
    },
    static: {
      build: {
        framework: 'static',
        nodeVersion: 18,
        installCommand: '',
        buildCommand: '',
        buildContext: '.',
      },
      run: {
        startCommand: 'nginx -g "daemon off;"',
        port: 80,
        healthCheckPath: '/',
        healthCheckInterval: 30,
      },
    },
    docker: {
      build: {
        framework: 'docker',
        nodeVersion: 18,
        installCommand: '',
        buildCommand: '',
        buildContext: '.',
      },
      run: {
        startCommand: '',
        port: 3000,
        healthCheckPath: '/health',
        healthCheckInterval: 30,
      },
    },
  };

  return defaults[framework] ?? defaults['nodejs'];
}

// ─────────────────────────────────────────────
// PARSE devdeploy.yml
// ─────────────────────────────────────────────

export function parseDevDeployConfig(repoPath: string): DevDeployConfig {
  const configPath = path.join(repoPath, 'devdeploy.yml');
  const configPathAlt = path.join(repoPath, 'devdeploy.yaml');

  let rawConfig: RawConfig = {};

  // Try to read and parse devdeploy.yml
  if (fs.existsSync(configPath)) {
    const content = fs.readFileSync(configPath, 'utf-8');
    rawConfig = yaml.load(content) as RawConfig;
    console.log('Found devdeploy.yml — using project configuration');
  } else if (fs.existsSync(configPathAlt)) {
    const content = fs.readFileSync(configPathAlt, 'utf-8');
    rawConfig = yaml.load(content) as RawConfig;
    console.log('Found devdeploy.yaml — using project configuration');
  } else {
    console.log('No devdeploy.yml found — using auto-detection');
  }

  // Auto-detect or use declared framework
  const framework = (rawConfig.build?.framework as DevDeployConfig['build']['framework'])
    ?? detectFramework(repoPath);

  const frameworkDefaults = getFrameworkDefaults(framework);

  // Merge: framework defaults ← devdeploy.yml values
  const config: DevDeployConfig = {
    build: {
      framework,
      nodeVersion: rawConfig.build?.node_version
        ?? frameworkDefaults.build?.nodeVersion
        ?? 18,
      installCommand: rawConfig.build?.install_command
        ?? frameworkDefaults.build?.installCommand
        ?? 'npm ci',
      buildCommand: rawConfig.build?.build_command
        ?? frameworkDefaults.build?.buildCommand
        ?? '',
      dockerfile: rawConfig.build?.dockerfile,
      buildContext: rawConfig.build?.build_context
        ?? frameworkDefaults.build?.buildContext
        ?? '.',
    },
    run: {
      startCommand: rawConfig.run?.start_command
        ?? frameworkDefaults.run?.startCommand
        ?? 'node index.js',
      port: rawConfig.run?.port
        ?? frameworkDefaults.run?.port
        ?? 3000,
      healthCheckPath: rawConfig.run?.health_check_path
        ?? frameworkDefaults.run?.healthCheckPath
        ?? '/health',
      healthCheckInterval: rawConfig.run?.health_check_interval
        ?? frameworkDefaults.run?.healthCheckInterval
        ?? 30,
    },
    resources: {
      cpu: (rawConfig.resources?.cpu ?? 256) as DevDeployConfig['resources']['cpu'],
      memory: (rawConfig.resources?.memory ?? 512) as DevDeployConfig['resources']['memory'],
    },
    environments: {
      dev: {
        ttlHours: rawConfig.environments?.dev?.ttl_hours ?? 24,
      },
      staging: {
        ttlHours: rawConfig.environments?.staging?.ttl_hours ?? 72,
      },
      production: {
        ttlHours: rawConfig.environments?.production?.ttl_hours ?? 0,
      },
    },
  };

  return config;
}

// ─────────────────────────────────────────────
// GENERATE DOCKERFILE FROM CONFIG
// Called when the user has no Dockerfile and
// framework is not 'docker'.
// ─────────────────────────────────────────────

export function generateDockerfile(config: DevDeployConfig): string {
  const { framework, nodeVersion, installCommand, buildCommand } = config.build;
  const { port, startCommand } = config.run;

  switch (framework) {
    case 'nodejs':
      return `
FROM node:${nodeVersion}-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN ${installCommand}
COPY . .
${buildCommand ? `RUN ${buildCommand}` : ''}
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs
EXPOSE ${port}
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \\
  CMD wget -qO- http://localhost:${port}${config.run.healthCheckPath} || exit 1
CMD ${JSON.stringify(startCommand.split(' '))}
`.trim();

    case 'react':
      return `
FROM node:${nodeVersion}-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN ${installCommand}
COPY . .
RUN ${buildCommand || 'npm run build'}

FROM nginx:alpine AS production
COPY --from=builder /app/build /usr/share/nginx/html
COPY --from=builder /app/dist /usr/share/nginx/html 2>/dev/null || true
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \\
  CMD wget -qO- http://localhost:80/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
`.trim();

    case 'nextjs':
      return `
FROM node:${nodeVersion}-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN ${installCommand}
COPY . .
ENV NEXT_TELEMETRY_DISABLED 1
RUN ${buildCommand || 'npm run build'}

FROM node:${nodeVersion}-alpine AS production
WORKDIR /app
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
COPY --from=builder --chown=nodejs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nodejs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nodejs:nodejs /app/public ./public 2>/dev/null || true
USER nodejs
EXPOSE ${port}
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \\
  CMD wget -qO- http://localhost:${port}/api/health || exit 1
CMD ["node", "server.js"]
`.trim();

    case 'static':
      return `
FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \\
  CMD wget -qO- http://localhost:80/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
`.trim();

    default:
      return `
FROM node:${nodeVersion}-alpine
WORKDIR /app
COPY package*.json ./
RUN ${installCommand}
COPY . .
EXPOSE ${port}
CMD ${JSON.stringify(startCommand.split(' '))}
`.trim();
  }
}