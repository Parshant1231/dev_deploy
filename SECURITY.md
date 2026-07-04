# Security Best Practices for DevDeploy

This document outlines the security architecture and best practices for DevDeploy.

---

## Table of Contents

1. [Overview](#overview)
2. [Secrets Management](#secrets-management)
3. [Authentication & Authorization](#authentication--authorization)
4. [Infrastructure Security](#infrastructure-security)
5. [Data Protection](#data-protection)
6. [API Security](#api-security)
7. [GitHub Integration](#github-integration)
8. [Incident Response](#incident-response)
9. [Compliance Checklist](#compliance-checklist)

---

## Overview

DevDeploy handles sensitive information including:

- User authentication credentials
- GitHub OAuth tokens
- AWS credentials
- JWT secrets
- Database encryption keys
- Private source code (via GitHub)

This guide ensures all sensitive data is protected with industry-standard practices.

---

## Secrets Management

### Local Development

**Never store secrets in code or commit to Git:**

```bash
# ❌ DON'T DO THIS
const JWT_SECRET = "my-super-secret-key-12345";  // In source code
export TOKEN = "ghp_abc123..."  # In shell history

# ✅ DO THIS INSTEAD
# 1. Store in .env file
cat > apps/backend/.env << 'EOF'
JWT_SECRET=your-secret-key-here
GITHUB_TOKEN=ghp_your-token
EOF

# 2. Add .env to .gitignore
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore

# 3. Load from environment in code
const secret = process.env.JWT_SECRET;
```

### AWS Production

**Use AWS Secrets Manager for all production secrets:**

```hcl
# infrastructure/terraform/modules/secrets/main.tf
resource "aws_secretsmanager_secret" "app_secrets" {
  name            = "devdeploy-dev-app-secrets"
  recovery_window = 7
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  secret_string = jsonencode({
    JWT_SECRET              = var.jwt_secret_value
    TOKEN_ENCRYPTION_KEY    = var.token_encryption_key
    GITHUB_CLIENT_SECRET    = var.github_client_secret
    DEVDEPLOY_GITHUB_TOKEN  = var.devdeploy_github_token
  })
}
```

**ECS automatically injects secrets:**

```hcl
# infrastructure/terraform/modules/compute/main.tf
container_definitions = jsonencode([{
  name    = "api"
  image   = var.ecr_repository_url
  
  secrets = [
    {
      name      = "JWT_SECRET"
      valueFrom = aws_secretsmanager_secret.jwt_secret.arn
    },
    {
      name      = "TOKEN_ENCRYPTION_KEY"
      valueFrom = aws_secretsmanager_secret.token_encryption_key.arn
    }
  ]
}])
```

### Secret Generation

**Generate cryptographically secure secrets:**

```bash
# Generate 64-character JWT secret
openssl rand -hex 64

# Generate 32-byte encryption key
openssl rand -hex 32

# Generate internal API key
openssl rand -hex 32

# Or use Python
python3 -c "import secrets; print(secrets.token_hex(32))"

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Secret Rotation

**Rotate secrets regularly:**

```bash
# Via AWS Secrets Manager console:
# 1. Go to Secrets Manager → Select secret
# 2. Click "Rotate secret immediately"
# 3. Create rotation Lambda function
# 4. Test rotation

# Via CLI:
aws secretsmanager rotate-secret \
  --secret-id devdeploy-dev-jwt-secret \
  --rotation-rules 'AutomaticallyAfterDays=30'
```

---

## Authentication & Authorization

### JWT Token Security

**Backend JWT validation:**

```typescript
// apps/backend/src/middleware/auth.middleware.ts
import jwt from 'jsonwebtoken';

export const validateJWT = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    // Don't leak JWT validation error details to prevent token analysis
    return res.status(401).json({ error: 'Invalid token' });
  }
};
```

**Frontend JWT handling:**

```typescript
// apps/frontend/lib/auth.ts
// Store JWT securely in httpOnly cookie (not localStorage)
// Use SameSite and Secure flags

// Get JWT from cookie
const token = getCookie('auth_token');

// Send with request
const response = await fetch('/api/v1/endpoint', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  credentials: 'include'  // Include cookies with cross-origin requests
});
```

### GitHub OAuth Security

**OAuth flow security:**

```typescript
// apps/backend/src/modules/auth/auth.controller.ts

// 1. Verify OAuth state token to prevent CSRF
if (req.query.state !== req.session.oauthState) {
  throw new Error('Invalid OAuth state - CSRF attack detected');
}

// 2. Exchange code for token
const token = await github.getAccessToken(req.query.code);

// 3. Encrypt token before storing
const encrypted = encryptToken(token, process.env.TOKEN_ENCRYPTION_KEY);

// 4. Store encrypted token in DynamoDB
await userRepository.updateGitHubToken(userId, encrypted);

// 5. Never log or transmit unencrypted token
```

### Internal API Key Security

**Protect GitHub Actions callbacks:**

```typescript
// apps/backend/src/middleware/validate-internal-key.ts

export const validateInternalKey = (req, res, next) => {
  const internalKey = req.headers['x-internal-key'];
  
  if (!internalKey) {
    return res.status(401).json({ error: 'Missing internal key' });
  }
  
  // Compare using constant-time comparison (prevent timing attacks)
  if (!crypto.timingSafeEqual(
    Buffer.from(internalKey),
    Buffer.from(process.env.DEVDEPLOY_INTERNAL_KEY)
  )) {
    return res.status(401).json({ error: 'Invalid internal key' });
  }
  
  next();
};
```

---

## Infrastructure Security

### VPC & Network Isolation

```hcl
# infrastructure/terraform/modules/networking/main.tf

# Private subnets for backend (no internet access)
resource "aws_subnet" "private" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = "us-east-1a"
  map_public_ip_on_launch = false  # ✅ Not publicly accessible
}

# Security group for ECS
resource "aws_security_group" "ecs" {
  name = "devdeploy-ecs-sg"
  
  ingress {
    from_port       = 3001
    to_port         = 3001
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]  # Only ALB can reach
  }
  
  # Allow egress only to necessary services
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # HTTPS to AWS services
  }
}
```

### DynamoDB Encryption

```hcl
# infrastructure/terraform/modules/database/main.tf

resource "aws_dynamodb_table" "users" {
  name           = "devdeploy-users"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "userId"
  
  # ✅ Encryption at rest with AWS-managed key
  server_side_encryption_specification {
    enabled     = true
    kms_key_arn = aws_kms_key.dynamodb.arn
  }
  
  # ✅ Point-in-time recovery
  point_in_time_recovery_specification {
    point_in_time_recovery_enabled = true
  }
  
  ttl {
    attribute_name = "expirationTime"
    enabled        = true  # Auto-delete sessions after expiry
  }
  
  attribute {
    name = "userId"
    type = "S"
  }
}
```

### IAM Least Privilege

```hcl
# infrastructure/terraform/modules/security/main.tf

# ECS Task Execution Role (pulls images, writes logs)
resource "aws_iam_role" "ecs_execution_role" {
  name = "devdeploy-ecs-execution-role"
}

resource "aws_iam_role_policy" "ecs_execution_policy" {
  name = "devdeploy-ecs-execution-policy"
  role = aws_iam_role.ecs_execution_role.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # ✅ Least privilege: only needed actions
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer"
        ]
        Resource = "*"
      },
      {
        # ✅ CloudWatch logs
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:us-east-1:*:log-group:/devdeploy/*"
      },
      {
        # ✅ Secrets Manager
        Effect = "Allow"
        Action = ["secretsmanager:GetSecretValue"]
        Resource = "arn:aws:secretsmanager:us-east-1:*:secret:devdeploy-*"
      }
    ]
  })
}

# ECS Task Role (application permissions)
resource "aws_iam_role" "ecs_task_role" {
  name = "devdeploy-ecs-task-role"
}

resource "aws_iam_role_policy" "ecs_task_policy" {
  name = "devdeploy-ecs-task-policy"
  role = aws_iam_role.ecs_task_role.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # ✅ DynamoDB access restricted to specific tables
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:Scan"  # Consider removing if not needed
        ]
        Resource = "arn:aws:dynamodb:us-east-1:*:table/devdeploy-*"
      },
      {
        # ✅ EventBridge only for sending events
        Effect = "Allow"
        Action = ["events:PutEvents"]
        Resource = "*"
      }
    ]
  })
}
```

---

## Data Protection

### Encryption at Rest

**DynamoDB encryption:**

```bash
# All DynamoDB tables encrypted with AWS KMS
# Verify with:
aws dynamodb describe-table \
  --table-name devdeploy-users \
  --query 'Table.SSEDescription'
```

**S3 encryption (if used):**

```hcl
resource "aws_s3_bucket" "deployment_artifacts" {
  bucket = "devdeploy-artifacts"
}

resource "aws_s3_bucket_server_side_encryption_configuration" "artifacts" {
  bucket = aws_s3_bucket.deployment_artifacts.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Block public access
resource "aws_s3_bucket_public_access_block" "artifacts" {
  bucket = aws_s3_bucket.deployment_artifacts.id
  
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
```

### Encryption in Transit

**HTTPS/TLS:**

```hcl
# infrastructure/terraform/modules/networking/main.tf

# ALB listener uses HTTPS
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS-1-2-2017-01"
  certificate_arn   = aws_acm_certificate.main.arn
  
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

# Force HTTP → HTTPS redirect
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"
  
  default_action {
    type = "redirect"
    
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}
```

### GitHub Token Encryption

**Application-level encryption of stored tokens:**

```typescript
// apps/backend/src/shared/utils/crypto.ts

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

export const encryptGitHubToken = (token: string): EncryptedToken => {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, 'hex');
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    iv: iv.toString('hex'),
    encryptedData: encrypted,
    authTag: authTag.toString('hex')
  };
};

export const decryptGitHubToken = (encrypted: EncryptedToken): string => {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, 'hex');
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(encrypted.iv, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(encrypted.authTag, 'hex'));
  
  let decrypted = decipher.update(encrypted.encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};
```

---

## API Security

### Input Validation

```typescript
// apps/backend/src/middleware/validate.middleware.ts

import { body, validationResult } from 'express-validator';

export const validateRegister = [
  body('email').isEmail().trim().toLowerCase(),
  body('password')
    .isLength({ min: 8 })
    .matches(/[A-Z]/)  // Uppercase
    .matches(/[a-z]/)  // Lowercase
    .matches(/[0-9]/)  // Digit
    .matches(/[!@#$%^&*]/),  // Special char
  body('name').isLength({ min: 1, max: 255 }).trim()
];

export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};
```

### Rate Limiting

```typescript
// apps/backend/src/middleware/rate-limit.ts

import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,  // Max 5 login attempts
  message: 'Too many login attempts, try again later',
  standardHeaders: true,
  legacyHeaders: false
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 100,  // Max 100 requests per minute
  skip: (req) => {
    // Skip rate limiting for health check
    return req.path === '/health';
  }
});
```

### CORS Configuration

```typescript
// apps/backend/src/app.ts

import cors from 'cors';

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,  // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400  // 24 hours
}));
```

### Error Handling

```typescript
// apps/backend/src/middleware/error.middleware.ts

export const errorHandler = (err, req, res, next) => {
  // ✅ Don't leak sensitive error details to client
  const clientError = {
    status: err.status || 500,
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error'
      : err.message
  };
  
  // ✅ Log full error server-side for debugging
  console.error('[ERROR]', {
    message: err.message,
    stack: err.stack,
    timestamp: new Date(),
    userId: req.userId
  });
  
  res.status(clientError.status).json(clientError);
};
```

---

## GitHub Integration

### OAuth Security

```typescript
// apps/backend/src/modules/auth/auth.service.ts

export const handleGitHubCallback = async (code: string, state: string) => {
  // 1. Verify state (CSRF protection)
  const sessionState = await cache.get(`oauth-state-${state}`);
  if (!sessionState) {
    throw new Error('Invalid or expired OAuth state');
  }
  
  // 2. Exchange code for token
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: process.env.GITHUB_CALLBACK_URL
    })
  });
  
  const data = await response.json();
  
  if (data.error) {
    throw new Error(`GitHub OAuth failed: ${data.error}`);
  }
  
  // 3. Get user info from GitHub
  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${data.access_token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  
  // 4. Encrypt token before storing
  const encryptedToken = encryptGitHubToken(data.access_token);
  
  // 5. Store user in database
  await userRepository.createOrUpdateUser({
    gitHubId: userResponse.github_id,
    email: userResponse.email,
    encryptedToken
  });
  
  // 6. Create JWT for session
  const jwtToken = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  return jwtToken;
};
```

### Webhook Verification

```typescript
// apps/backend/src/modules/webhooks/webhook.service.ts

import crypto from 'crypto';

export const verifyGitHubWebhook = (payload: string, signature: string) => {
  const hmac = crypto.createHmac(
    'sha256',
    process.env.GITHUB_WEBHOOK_SECRET!
  );
  
  hmac.update(payload);
  const expectedSignature = `sha256=${hmac.digest('hex')}`;
  
  // Constant-time comparison (prevent timing attacks)
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
};
```

---

## Incident Response

### Security Incident Plan

**If you suspect a security breach:**

1. **Immediate actions (within 1 hour):**
   - Rotate all secrets (JWT, OAuth tokens, API keys)
   - Revoke compromised GitHub tokens
   - Reset all user passwords
   - Check CloudWatch logs for unauthorized access

2. **Investigation (within 24 hours):**
   - Review ECS task logs
   - Check DynamoDB access patterns
   - Audit IAM role permissions
   - Review GitHub Actions workflow runs

3. **Communication:**
   - Notify affected users
   - Document findings
   - Update security controls

### Monitoring & Alerting

```hcl
# infrastructure/terraform/modules/observability/main.tf

resource "aws_cloudwatch_metric_alarm" "failed_auth" {
  alarm_name          = "devdeploy-failed-auth-spike"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "FailedAuthAttempts"
  namespace           = "DevDeploy"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"  # Alert if 10+ failed attempts in 5 mins
  alarm_actions       = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "unauthorized_api_access" {
  alarm_name          = "devdeploy-unauthorized-api-access"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "UnauthorizedAPIAccess"
  namespace           = "DevDeploy"
  period              = "60"
  statistic           = "Sum"
  threshold           = "5"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}
```

---

## Compliance Checklist

### Before Going to Production

- ✅ All secrets generated with `openssl rand -hex`
- ✅ No `.env` files committed to Git
- ✅ `.gitignore` includes `*.env`, `*.local`, `secrets.auto.tfvars`
- ✅ GitHub OAuth configured with HTTPS callback URLs
- ✅ DynamoDB encryption enabled
- ✅ VPC security groups restrict traffic appropriately
- ✅ IAM roles follow principle of least privilege
- ✅ CloudWatch logs enabled for all resources
- ✅ HTTPS/TLS enabled on ALB
- ✅ CORS properly configured
- ✅ Rate limiting enabled on auth endpoints
- ✅ Input validation on all endpoints
- ✅ Error handling doesn't leak sensitive info
- ✅ MFA enabled on AWS account
- ✅ MFA enabled on GitHub account
- ✅ Backup strategy in place for DynamoDB
- ✅ Security monitoring and alerting configured
- ✅ Incident response plan documented
- ✅ Regular security audits scheduled

### For Each Deployment

```bash
#!/bin/bash
# security-checklist.sh

echo "🔒 Security Pre-Deployment Checklist"

# Check no secrets in code
if git diff HEAD --name-only | xargs grep -l "SECRET\|PASSWORD\|TOKEN" 2>/dev/null; then
  echo "❌ FAILED: Secrets found in code changes"
  exit 1
fi

# Check .env files are gitignored
if git ls-files | grep -E "\.env|secrets\.auto\.tfvars"; then
  echo "❌ FAILED: Secrets files tracked in Git"
  exit 1
fi

# Run security scanning
npm audit --audit-level=moderate

# Check Terraform security
terraform plan -var-file=secrets.auto.tfvars -out=tfplan
tfsec . 

echo "✅ All security checks passed!"
```

---

## Security Resources

- [OWASP Top 10](https://owasp.org/Top10/) - Common web vulnerabilities
- [AWS Security Best Practices](https://docs.aws.amazon.com/security/) - AWS docs
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/) - Security tips
- [GitHub Security](https://github.com/settings/security) - GitHub account security

---

**Last updated: July 4, 2026**
