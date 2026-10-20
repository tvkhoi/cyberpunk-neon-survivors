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

  // Edge & HTTPS Security Headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(cors());
  app.use(express.json({ limit: '16kb' }));

  // Static files from public folder with Edge caching policy
  const publicPath = path.resolve(__dirname, '../../../public');
  app.use(express.static(publicPath, {
    maxAge: '1h',
    etag: true,
  }));

  // Mount API Routes (supports both /api/* and root serverless routing)
  app.use('/api', apiRouter);
  app.use('/', apiRouter);

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}
