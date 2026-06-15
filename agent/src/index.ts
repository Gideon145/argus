import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { Orchestrator } from './orchestrator';
import { createLogger, Logger } from './logger';

const STATUS_PORT = parseInt(process.env.STATUS_PORT || '3001');
const LOOP_INTERVAL_MS = parseInt(process.env.LOOP_INTERVAL_MS || '15000');

const logger: Logger = createLogger('Argus');

async function main() {
  logger.info('Argus agent starting...');

  // --- Config ---
  const config = {
    arcRpc: process.env.ARC_RPC_URL || 'https://rpc.testnet.arc-node.thecanteenapp.com',
    treasuryAddress: process.env.TREASURY_ADDRESS || '',
    loopIntervalMs: LOOP_INTERVAL_MS,
  };

  // --- Orchestrator ---
  const orchestrator = new Orchestrator(config, logger);

  // --- Status server ---
  const app = express();
  app.use(cors());

  let lastState: any = { status: 'starting', queries: 0, consensusRate: 0, treasury: '0' };

  app.get('/status', (_req, res) => {
    res.json(lastState);
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.listen(STATUS_PORT, () => {
    logger.info(`Status server on :${STATUS_PORT}`);
  });

  // --- Main loop ---
  logger.info(`Main loop starting (${config.loopIntervalMs}ms interval)`);

  setInterval(async () => {
    try {
      const state = await orchestrator.tick();
      lastState = state;
      logger.debug(`Tick complete — ${state.queries} total queries`);
    } catch (err) {
      logger.error('Tick error:', err);
    }
  }, config.loopIntervalMs);

  logger.info('Argus agent ready.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
