import 'dotenv/config';
import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { allowCorsOrigin } from './configs/cors';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import routes from './routes/index';

/**
 * Builds the configured Express app (CORS, security, body parsing, routes, error
 * handlers) with NO side effects: no DB connect, no Socket.IO, no `listen`. The
 * server entry point (`index.ts`) and integration tests (supertest) both consume
 * this so HTTP behaviour is identical in both.
 * @returns Configured Express application
 */
export function createApp() {
  const app = express();

  const corsOptions: cors.CorsOptions = {
    origin: allowCorsOrigin,
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'token',
      'x-access-token',
      'Cookie',
      'x-dev-password',
    ],
    exposedHeaders: ['Set-Cookie'],
    preflightContinue: false,
    maxAge: 86400,
  };

  app.use(cors(corsOptions));
  // Trust proxy for production deployment (Render.com, Heroku, etc.)
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());

  // Serve award files (decisions, adhoc-awards) at a stable public URL so the browser
  // opens them in its native PDF viewer with the real path + filename. Backups live
  // outside uploads/, so they stay private.
  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

  app.use(routes);

  // Must be registered after all routes
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
