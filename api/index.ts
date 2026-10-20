import type { Request, Response } from 'express';
import { createServer } from '../src/server.js';

const app = createServer();

export default function handler(req: Request, res: Response) {
  // Normalize URL: Vercel serverless functions in /api might receive URLs with or without /api prefix
  if (req.url && !req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  return app(req, res);
}
