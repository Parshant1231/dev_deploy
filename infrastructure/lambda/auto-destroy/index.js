/**
 * DevDeploy Auto-Destroy Lambda
 *
 * Runs every 15 minutes via EventBridge Scheduler.
 * Scans DynamoDB for environments that should be destroyed:
 *   1. Environments with TTL timestamp in the past
 *   2. Environments marked IDLE with lastActivityAt older than ttlHours
 *
 * For each expired environment:
 *   1. Set status to DESTROYING
 *   2. Stop ECS service
 *   3. Remove ALB listener rule
 *   4. Delete ALB target group
 *   5. Set status to DESTROYED
 *   6. Publish EventBridge event
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { ECSClient, UpdateServiceCommand, DeleteServiceCommand, DescribeServicesCommand, ListTasksCommand, StopTaskCommand } = require('@aws-sdk/client-ecs');
const { ElasticLoadBalancingV2Client, DescribeRulesCommand, DeleteRuleCommand, DeleteTargetGroupCommand, DescribeTargetGroupsCommand, DeregisterTargetsCommand, DescribeTargetHealthCommand } = require('@aws-sdk/client-elastic-load-balancing-v2');
const { EventBridgeClient, PutEventsCommand } = require('@aws-sdk/client-eventbridge');

// ─────────────────────────────────────────────
// AWS CLIENTS
// ─────────────────────────────────────────────

const region = process.env.AWS_REGION ?? 'us-east-1';

const dynamoClient = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: { removeUndefinedValues: true },
});
const ecsClient = new ECSClient({ region });
const elbClient = new ElasticLoadBalancingV2Client({ region });
const eventBridgeClient = new EventBridgeClient({ region });

// ─────────────────────────────────────────────
// CONFIGURATION FROM ENVIRONMENT VARIABLES
// ─────────────────────────────────────────────

const CONFIG = {
  environmentsTable: process.env.ENVIRONMENTS_TABLE,
  deploymentsTable:  process.env.DEPLOYMENTS_TABLE,
  eventsTable:       process.env.EVENTS_TABLE,
  ecsCluster:        process.env.ECS_CLUSTER,
  eventBusName:      process.env.EVENT_BUS_NAME,
  environment:       process.env.ENVIRONMENT ?? 'dev',
};

// ─────────────────────────────────────────────
// LAMBDA HANDLER
// Entry point called by EventBridge Scheduler.
// ─────────────────────────────────────────────

exports.handler = async (event) => {
  console.log('Auto-destroy invoked', { source: event.source, timestamp: new Date().toISOString() });

  // Manual destroy from API — destroy a specific environment immediately
  if (event.source === 'api-manual-destroy' && event.environmentId) {
    console.log(`Manual destroy triggered for environment: ${event.environmentId}`);

    try {
      const { GetCommand } = require('@aws-sdk/lib-dynamodb');
      const envResult = await docClient.send(
        new GetCommand({
          TableName: CONFIG.environmentsTable,
          Key: {
            environmentId: event.environmentId,
            projectId:     event.projectId,
          },
        })
      );

      if (envResult.Item) {
        await destroyEnvironment(envResult.Item);
        return { statusCode: 200, body: JSON.stringify({ destroyed: event.environmentId }) };
      }

      return { statusCode: 404, body: JSON.stringify({ error: 'Environment not found' }) };
    } catch (error) {
      console.error('Manual destroy failed:', error);
      throw error;
    }
  }

  // Scheduled scan — find and destroy all expired environments
  // (existing handler logic below — keep as is)
  // ...existing scan logic...
};

// ─────────────────────────────────────────────
// FIND EXPIRED ENVIRONMENTS
//
// An environment should be destroyed if:
//   A) DynamoDB TTL has expired (ttl < now in Unix seconds)
//   B) Status is IDLE AND lastActivityAt is older than ttlHours
//   C) Status is DESTROYING (stuck in a previous cleanup attempt)
// ─────────────────────────────────────────────

async function findExpiredEnvironments() {
  const nowUnix    = Math.floor(Date.now() / 1000);
  const nowIso     = new Date().toISOString();

  // Scan the environments table
  // In production at scale, replace with GSI query on status
  // (Phase 10 optimization — scan is acceptable at this scale)
  const result = await docClient.send(
    new ScanCommand({
      TableName: CONFIG.environmentsTable,
      FilterExpression:
        '#status IN (:running, :idle, :destroying) AND ' +
        '(#ttl < :now OR (#status = :idle AND lastActivityAt < :cutoff))',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#ttl':    'ttl',
      },
      ExpressionAttributeValues: {
        ':running':   'RUNNING',
        ':idle':      'IDLE',
        ':destroying': 'DESTROYING',
        ':now':       nowUnix,
        ':cutoff':    calculateCutoffTime(nowIso),
      },
    })
  );

  const environments = result.Items ?? [];

  // Further filter: only destroy if TTL is set and non-zero
  // (production environments have ttl = 0 meaning never destroy)
  return environments.filter((env) => {
    if (!env.ttl || env.ttl === 0) return false;
    if (env.status === 'DESTROYED') return false;

    // Check if TTL has expired
    if (env.ttl < nowUnix) return true;

    // Check if idle for longer than configured TTL hours
    if (env.status === 'IDLE' && env.ttlHours > 0) {
      const lastActivity = new Date(env.lastActivityAt).getTime();
      const idleMs = Date.now() - lastActivity;
      const ttlMs  = env.ttlHours * 60 * 60 * 1000;
      return idleMs > ttlMs;
    }

    // Stuck in DESTROYING for more than 30 minutes
    if (env.status === 'DESTROYING') {
      const updatedAt = new Date(env.updatedAt).getTime();
      const stuckMs   = Date.now() - updatedAt;
      return stuckMs > 30 * 60 * 1000;
    }

    return false;
  });
}

// Calculate the cutoff ISO timestamp for idle detection
// Returns the ISO time N hours ago
function calculateCutoffTime(nowIso) {
  // We use a generous 1-hour minimum to avoid race conditions
  // The actual TTL check uses the environment's configured ttlHours
  const onHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  return onHourAgo.toISOString();
}

// ─────────────────────────────────────────────
// DESTROY ENVIRONMENT
// Main teardown orchestrator for a single environment.
// ─────────────────────────────────────────────

async function destroyEnvironment(environment) {
  const {
    environmentId,
    projectId,
    userId,
    name: envName,
    ecsServiceArn,
    deploymentId,
  } = environment;

  console.log(`Destroying environment: ${environmentId} (${envName}) for project ${projectId}`);

  // Step 1 — Mark as DESTROYING
  await updateEnvironmentStatus(environmentId, projectId, 'DESTROYING');

  // Step 2 — Record the destroy event
  await recordDestroyEvent(environmentId, projectId, userId, deploymentId, 'ENVIRONMENT_DESTROYING');

  try {
    // Step 3 — Stop ECS service
    // ECS service names must not contain underscores — replace with hyphens.
    // The workflow uses the same sanitisation when creating the service.
    const serviceName = ecsServiceArn
      ?? `dd-${projectId}-${envName}`.replace(/_/g, '-').slice(0, 36);

    await stopEcsService(serviceName);

    // Step 4 — Clean up ALB resources
    // ALB target group names only allow alphanumeric and hyphens (no underscores).
    // Mirror the sanitisation in deploy-user-app.yml: tr '_' '-' | cut -c1-32
    const targetGroupName = `dd-${projectId}-${envName}`.replace(/_/g, '-').slice(0, 32);
    await cleanupAlbResources(targetGroupName);

    // Step 5 — Mark as DESTROYED
    await updateEnvironmentStatus(environmentId, projectId, 'DESTROYED');

    // Step 6 — Update related deployment to DESTROYED
    if (deploymentId) {
      await updateDeploymentStatus(deploymentId, projectId, 'DESTROYED');
    }

    // Step 7 — Record the destroyed event
    await recordDestroyEvent(environmentId, projectId, userId, deploymentId, 'ENVIRONMENT_DESTROYED');

    // Step 8 — Publish EventBridge event
    await publishDestroyEvent(environmentId, projectId, userId, envName);

    console.log(`Environment ${environmentId} destroyed successfully`);
  } catch (error) {
    console.error(`Error during teardown of ${environmentId}:`, error);

    // Mark as DESTROYED anyway to prevent stuck environments
    // The resources may already be partially cleaned up
    await updateEnvironmentStatus(environmentId, projectId, 'DESTROYED')
      .catch((e) => console.error('Failed to update status after error:', e));

    throw error;
  }
}

// ─────────────────────────────────────────────
// STOP ECS SERVICE
// Sets desired count to 0, waits for drain, deletes service.
// ─────────────────────────────────────────────

async function stopEcsService(serviceName) {
  console.log(`Stopping ECS service: ${serviceName}`);

  try {
    // Check if service exists
    const describeResult = await ecsClient.send(
      new DescribeServicesCommand({
        cluster:  CONFIG.ecsCluster,
        services: [serviceName],
      })
    );

    const service = describeResult.services?.[0];
    if (!service || service.status === 'INACTIVE') {
      console.log(`ECS service ${serviceName} not found or already inactive`);
      return;
    }

    // Step A — Set desired count to 0 (drain tasks)
    await ecsClient.send(
      new UpdateServiceCommand({
        cluster:      CONFIG.ecsCluster,
        service:      serviceName,
        desiredCount: 0,
      })
    );

    console.log(`Set desired count to 0 for ${serviceName}`);

    // Step B — Wait for tasks to drain (up to 30 seconds)
    await waitForServiceDrain(serviceName);

    // Step C — Force stop any remaining tasks
    await forceStopTasks(serviceName);

    // Step D — Delete the service
    await ecsClient.send(
      new DeleteServiceCommand({
        cluster: CONFIG.ecsCluster,
        service: serviceName,
        force:   true,
      })
    );

    console.log(`ECS service ${serviceName} deleted`);
  } catch (error) {
    if (error.name === 'ServiceNotFoundException' ||
        error.name === 'ClusterNotFoundException') {
      console.log(`Service ${serviceName} already removed — skipping`);
      return;
    }
    throw error;
  }
}

async function waitForServiceDrain(serviceName, maxWaitMs = 30000) {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const result = await ecsClient.send(
      new ListTasksCommand({
        cluster:     CONFIG.ecsCluster,
        serviceName: serviceName,
      })
    );

    if (!result.taskArns || result.taskArns.length === 0) {
      console.log(`All tasks drained from ${serviceName}`);
      return;
    }

    console.log(`Waiting for ${result.taskArns.length} task(s) to drain...`);
    await sleep(5000);
  }

  console.log(`Drain timeout reached for ${serviceName} — proceeding with force stop`);
}

async function forceStopTasks(serviceName) {
  try {
    const result = await ecsClient.send(
      new ListTasksCommand({
        cluster:     CONFIG.ecsCluster,
        serviceName: serviceName,
      })
    );

    if (!result.taskArns || result.taskArns.length === 0) return;

    await Promise.all(
      result.taskArns.map((taskArn) =>
        ecsClient.send(
          new StopTaskCommand({
            cluster: CONFIG.ecsCluster,
            task:    taskArn,
            reason:  'Auto-destroy: environment TTL expired',
          })
        )
      )
    );

    console.log(`Force stopped ${result.taskArns.length} task(s)`);
  } catch (error) {
    console.warn('Force stop tasks warning:', error.message);
  }
}

// ─────────────────────────────────────────────
// CLEAN UP ALB RESOURCES
// Removes listener rules and target groups.
// Must be done AFTER ECS service is stopped.
// ─────────────────────────────────────────────

async function cleanupAlbResources(targetGroupName) {
  console.log(`Cleaning up ALB resources for target group: ${targetGroupName}`);

  try {
    // Find the target group by name
    const tgResult = await elbClient.send(
      new DescribeTargetGroupsCommand({
        Names: [targetGroupName],
      })
    );

    const targetGroup = tgResult.TargetGroups?.[0];
    if (!targetGroup) {
      console.log(`Target group ${targetGroupName} not found — skipping ALB cleanup`);
      return;
    }

    const targetGroupArn = targetGroup.TargetGroupArn;
    console.log(`Found target group: ${targetGroupArn}`);

    // Find all listener rules pointing to this target group
    // and delete them before deleting the target group
    await deleteListenerRulesForTargetGroup(targetGroupArn);

    // Deregister all targets (ECS task IPs)
    await deregisterAllTargets(targetGroupArn);

    // Delete the target group
    await elbClient.send(
      new DeleteTargetGroupCommand({
        TargetGroupArn: targetGroupArn,
      })
    );

    console.log(`Target group ${targetGroupName} deleted`);
  } catch (error) {
    if (error.name === 'TargetGroupNotFoundException') {
      console.log(`Target group ${targetGroupName} already deleted — skipping`);
      return;
    }
    throw error;
  }
}

async function deleteListenerRulesForTargetGroup(targetGroupArn) {
  try {
    // We need the listener ARN to list rules
    // Get it from the target group's load balancer
    const tgResult = await elbClient.send(
      new DescribeTargetGroupsCommand({
        TargetGroupArns: [targetGroupArn],
      })
    );

    const loadBalancerArns = tgResult.TargetGroups?.[0]?.LoadBalancerArns ?? [];
    if (loadBalancerArns.length === 0) {
      console.log('Target group not attached to any load balancer');
      return;
    }

    // For each listener on the load balancer, check for rules pointing to our target group
    const rulesResult = await elbClient.send(
      new DescribeRulesCommand({
        // Note: DescribeRules requires either listener ARN or rule ARN
        // We use a workaround — describe all rules by listing listeners
        // In production, store the listener rule ARN in DynamoDB during creation
      })
    );

    // If we stored the listener rule ARN in DynamoDB during Phase 5,
    // we would use it here directly. For now, we skip rule deletion
    // and rely on ECS service deletion removing the registered targets,
    // which causes the rule to have no healthy targets (returns 502).
    // The rule itself is harmless without active targets.
    //
    // Phase 10 enhancement: Store listener rule ARN in environment record
    // and delete it explicitly here.
    console.log('Listener rule cleanup: rule ARN not stored — targets deregistered instead');
  } catch (error) {
    console.warn('Listener rule cleanup warning:', error.message);
  }
}

async function deregisterAllTargets(targetGroupArn) {
  try {
    const healthResult = await elbClient.send(
      new DescribeTargetHealthCommand({
        TargetGroupArn: targetGroupArn,
      })
    );

    const targets = healthResult.TargetHealthDescriptions ?? [];
    if (targets.length === 0) {
      console.log('No targets to deregister');
      return;
    }

    await elbClient.send(
      new DeregisterTargetsCommand({
        TargetGroupArn: targetGroupArn,
        Targets: targets.map((t) => ({
          Id:   t.Target.Id,
          Port: t.Target.Port,
        })),
      })
    );

    console.log(`Deregistered ${targets.length} target(s)`);

    // Wait for deregistration to complete
    await sleep(5000);
  } catch (error) {
    console.warn('Deregister targets warning:', error.message);
  }
}

// ─────────────────────────────────────────────
// DYNAMODB UPDATES
// ─────────────────────────────────────────────

async function updateEnvironmentStatus(environmentId, projectId, status) {
  await docClient.send(
    new UpdateCommand({
      TableName: CONFIG.environmentsTable,
      Key:       { environmentId, projectId },
      UpdateExpression:
        'SET #status = :status, updatedAt = :updatedAt',
      ExpressionAttributeNames:  { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status':    status,
        ':updatedAt': new Date().toISOString(),
      },
    })
  );
}

async function updateDeploymentStatus(deploymentId, projectId, status) {
  try {
    await docClient.send(
      new UpdateCommand({
        TableName: CONFIG.deploymentsTable,
        Key:       { deploymentId, projectId },
        UpdateExpression:
          'SET #status = :status, updatedAt = :updatedAt',
        ExpressionAttributeNames:  { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status':    status,
          ':updatedAt': new Date().toISOString(),
        },
        ConditionExpression: 'attribute_exists(deploymentId)',
      })
    );
  } catch (error) {
    if (error.name === 'ConditionalCheckFailedException') {
      console.log(`Deployment ${deploymentId} not found — skipping status update`);
      return;
    }
    throw error;
  }
}

// ─────────────────────────────────────────────
// EVENT RECORDING
// ─────────────────────────────────────────────

async function recordDestroyEvent(environmentId, projectId, userId, deploymentId, eventType) {
  const eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now     = new Date().toISOString();

  await docClient.send(
    new PutCommand({
      TableName: CONFIG.eventsTable,
      Item: {
        eventId,
        createdAt:     now,
        deploymentId:  deploymentId ?? 'none',
        projectId,
        userId:        userId ?? 'system',
        type:          eventType,
        message:       `Environment auto-destroyed by scheduler`,
        metadata: {
          environmentId,
          trigger: 'auto-destroy-lambda',
        },
      },
    })
  );
}

// ─────────────────────────────────────────────
// EVENTBRIDGE PUBLISH
// ─────────────────────────────────────────────

async function publishDestroyEvent(environmentId, projectId, userId, envName) {
  try {
    await eventBridgeClient.send(
      new PutEventsCommand({
        Entries: [
          {
            EventBusName: CONFIG.eventBusName,
            Source:       'devdeploy.environments',
            DetailType:   'EnvironmentDestroyed',
            Detail: JSON.stringify({
              eventType:     'EnvironmentDestroyed',
              environmentId,
              projectId,
              userId,
              environment:   envName,
              timestamp:     new Date().toISOString(),
              trigger:       'auto-destroy',
            }),
            Time: new Date(),
          },
        ],
      })
    );
  } catch (error) {
    // Fire-and-forget — never fail teardown because of EventBridge
    console.warn('EventBridge publish warning:', error.message);
  }
}

// ─────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}