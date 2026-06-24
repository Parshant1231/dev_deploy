import app from './app';
import { config } from './config/env';

const server = app.listen(config.port, () => {
  console.log(`
╔══════════════════════════════════════════╗
║          DevDeploy API Server            ║
╠══════════════════════════════════════════╣
║  Status:      Running                    ║
║  Port:        ${String(config.port).padEnd(26)}║
║  Environment: ${config.nodeEnv.padEnd(26)}║
║  Health:      /health                    ║
╚══════════════════════════════════════════╝
  `);
});

// Graceful shutdown — drain in-flight requests before stopping
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Starting graceful shutdown...');
  server.close(() => {
    console.log('Server closed. Process exiting.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Starting graceful shutdown...');
  server.close(() => {
    console.log('Server closed. Process exiting.');
    process.exit(0);
  });
});

export default server;  