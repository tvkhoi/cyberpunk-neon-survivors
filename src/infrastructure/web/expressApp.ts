import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { Router } from 'express';
import { errorHandler } from '../../interfaces/http/middlewares/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function buildExpressApp(apiRouter: Router): express.Application {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '16kb' }));

  // Static files from public folder
  const publicPath = path.resolve(__dirname, '../../../public');
  app.use(express.static(publicPath));

  // Mount API Routes (supports both /api/* and root serverless routing)
  app.use('/api', apiRouter);
  app.use('/', apiRouter);

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}
