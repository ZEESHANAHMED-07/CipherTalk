import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import config from './config/env.js';
import logger from './utils/logger.js';
import { testSupabaseConnection } from './config/supabase.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

import authRoutes from './routes/auth.js';
import messageRoutes from './routes/messages.js';
import roomRoutes from './routes/rooms.js';

const app = express();

/* ==========================================================
   SECURITY HEADERS
========================================================== */

app.use(
  helmet({
    contentSecurityPolicy:
      config.NODE_ENV === 'production'
        ? {
          directives: {
            defaultSrc: ["'self'"],

            scriptSrc: [
              "'self'",
            ],

            styleSrc: [
              "'self'",
              "'unsafe-inline'",
            ],

            imgSrc: [
              "'self'",
              "data:",
              "https:",
            ],

            fontSrc: [
              "'self'",
              "https:",
              "data:",
            ],

            connectSrc: [
              "'self'",
              config.FRONTEND_URL,
              "https://*.supabase.co",
              "wss://*.supabase.co",
            ],

            objectSrc: ["'none'"],

            frameAncestors: ["'none'"],

            baseUri: ["'self'"],

            formAction: ["'self'"],

            upgradeInsecureRequests: [],
          },
        }
        : false,

    crossOriginResourcePolicy: {
      policy: 'cross-origin',
    },

    crossOriginEmbedderPolicy: false,
  })
);

/* ==========================================================
   CORS
========================================================== */

app.use(
  cors({
    origin: [
      config.FRONTEND_URL,
      'http://localhost:5173',
      'http://localhost:4173',
    ],
    credentials: true,
  })
);

/* ==========================================================
   RATE LIMITER
========================================================== */

const limiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

/* ==========================================================
   BODY PARSER
========================================================== */

app.use(express.json({ limit: '10mb' }));
app.use(
  express.urlencoded({
    limit: '10mb',
    extended: true,
  })
);

/* ==========================================================
   ROUTES
========================================================== */

app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/rooms', roomRoutes);

/* ==========================================================
   HEALTH CHECKS
========================================================== */

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/api/test', (req, res) => {
  res.status(200).json({
    message: '🔐 CipherTalk Backend Running!',
  });
});

/* ==========================================================
   ERROR HANDLING
========================================================== */

app.use(notFound);
app.use(errorHandler);

/* ==========================================================
   SERVER STARTUP
========================================================== */

async function startServer() {
  try {
    logger.info('Checking Supabase connection...');

    const connected = await testSupabaseConnection();

    if (!connected) {
      throw new Error('Unable to connect to Supabase.');
    }

    logger.info('Supabase connected successfully.');

    app.listen(config.PORT, () => {
      logger.info('========================================');
      logger.info('🚀 CipherTalk Backend Started');
      logger.info('========================================');
      logger.info(`Environment : ${config.NODE_ENV}`);
      logger.info(`Server      : http://localhost:${config.PORT}`);
      logger.info(`Frontend    : ${config.FRONTEND_URL}`);
      logger.info('========================================');
      logger.info('Available Routes');
      logger.info('POST   /api/auth/register');
      logger.info('POST   /api/auth/login');
      logger.info('POST   /api/rooms/create');
      logger.info('GET    /api/rooms/list');
      logger.info('POST   /api/messages/send');
      logger.info('GET    /api/messages/:roomId');
      logger.info('GET    /api/health');
      logger.info('========================================');
    });

  } catch (error) {
    logger.error('Server failed to start.');
    logger.error(error.message);
    process.exit(1);
  }
}

/* ==========================================================
   SHUTDOWN
========================================================== */

process.on('SIGINT', () => {
  logger.info('Gracefully shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Server terminated.');
  process.exit(0);
});

/* ==========================================================
   START
========================================================== */

startServer();

export default app;