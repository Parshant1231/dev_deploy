# devdeploy.yml Specification

Place a `devdeploy.yml` file in the root of your repository
to configure how DevDeploy builds and deploys your application.

If no `devdeploy.yml` is found, DevDeploy uses auto-detection
based on the files present in your repository.

---

## Full Specification

```yaml
# devdeploy.yml

# ─────────────────────────────────────────────
# BUILD CONFIGURATION
# ─────────────────────────────────────────────
build:
  # Framework hint for Dockerfile generation
  # Options: nodejs | react | nextjs | static | docker
  # Default: auto-detected
  framework: nodejs

  # Node.js version (for generated Dockerfiles)
  # Default: 18
  node_version: 18

  # Command to install dependencies
  # Default: npm ci
  install_command: npm ci

  # Command to build the application
  # Default: npm run build (or empty for nodejs)
  build_command: npm run build

  # Path to Dockerfile if you want full control
  # If set, all other build options are ignored
  # Default: none (DevDeploy generates one)
  dockerfile: ./Dockerfile

  # Docker build context directory
  # Default: . (repository root)
  build_context: .

# ─────────────────────────────────────────────
# RUNTIME CONFIGURATION
# ─────────────────────────────────────────────
run:
  # Command to start the application
  # Default: npm start
  start_command: node dist/server.js

  # Port your application listens on
  # Default: 3000
  port: 3001

  # Path for ALB health checks
  # Must return HTTP 200
  # Default: /health
  health_check_path: /health

  # Health check timeout in seconds
  # Default: 30
  health_check_interval: 30

# ─────────────────────────────────────────────
# RESOURCE CONFIGURATION
# ─────────────────────────────────────────────
resources:
  # CPU units (256 = 0.25 vCPU, 512 = 0.5 vCPU, 1024 = 1 vCPU)
  # Default: 256
  cpu: 256

  # Memory in MB
  # Default: 512
  memory: 512

# ─────────────────────────────────────────────
# ENVIRONMENT CONFIGURATION
# ─────────────────────────────────────────────
environments:
  dev:
    # Auto-destroy after N hours of inactivity
    # Default: 24
    ttl_hours: 24

  staging:
    ttl_hours: 72

  production:
    # 0 means never auto-destroy
    ttl_hours: 0
```

---

## Auto-Detection Rules

If no `devdeploy.yml` is found:

| File Present | Detected Framework |
|---|---|
| `Dockerfile` | docker (use as-is) |
| `next.config.js` | nextjs |
| `package.json` + no framework | nodejs |
| `package.json` + react in deps | react |
| `index.html` (no package.json) | static |

---

## Minimal Examples

**Node.js API:**
```yaml
run:
  port: 3001
  start_command: node dist/server.js
```

**Next.js App:**
```yaml
build:
  framework: nextjs
  build_command: npm run build
run:
  port: 3000
  health_check_path: /api/health
```

**React SPA:**
```yaml
build:
  framework: react
  build_command: npm run build
```