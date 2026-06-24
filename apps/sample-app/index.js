const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    app: 'devdeploy-sample-app',
    version: process.env.APP_VERSION || '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Hello from DevDeploy!',
    deployedAt: process.env.DEPLOYED_AT || 'unknown',
    commitSha: process.env.COMMIT_SHA || 'unknown',
  });
});

app.listen(PORT, () => {
  console.log(`Sample app running on port ${PORT}`);
});