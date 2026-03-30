import { createServer } from 'http';

import { env } from './config/env.js';
import { app } from './app.js';
import { logger } from './utils/logger.js';

const server = createServer(app);

server.listen(env.port, () => {
  logger.info(`Safe-Commit backend listening on port ${env.port}`);
});
