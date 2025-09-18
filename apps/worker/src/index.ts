import express from 'express';
import { env } from './env.js';
import { logger } from './log.js';
import { ensureWaSessionRow } from './supa.js';
import { WhatsAppClient } from './wa/client.js';

const app = express();
const whatsappClient = new WhatsAppClient();

// Health check endpoint
app.get('/healthz', (_req, res) => {
  res.json({ ok: true });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  await whatsappClient.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  await whatsappClient.stop();
  process.exit(0);
});

// Start the worker
async function start() {
  try {
    logger.info('Starting WA Monitor Worker...');
    
    // Ensure database is ready
    logger.info('Ensuring database session row...');
    await ensureWaSessionRow();
    logger.info('Database session row ensured');
    
    // Start WhatsApp client
    logger.info('Starting WhatsApp client...');
    await whatsappClient.start();
    logger.info('WhatsApp client started');
    
    // Start HTTP server
    const port = process.env.PORT || env.PORT;
    app.listen(port, '0.0.0.0', () => {
      logger.info(`Worker HTTP server listening on port ${port}`);
    });
    
    logger.info('WA Monitor Worker started successfully');
  } catch (error) {
    logger.error('Failed to start worker:');
    logger.error('Error details:', error);
    if (error instanceof Error) {
      logger.error('Error stack:', error.stack);
    }
    process.exit(1);
  }
}

start();
