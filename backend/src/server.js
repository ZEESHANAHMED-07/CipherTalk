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

app.use(helmet({
  contentSecurityPolicy: false,             // CSP managed in frontend index.html
  crossOriginResourcePolicy: { policy: 'cross-origin' },  // Allow cross-port fetch
}));
app.use(cors({
  origin: [
    config.FRONTEND_URL,          // from .env (http://localhost:5173)
    'http://localhost:4173',       // Vite preview port
    'http://localhost:5173',       // Vite dev port (explicit)
  ],
  credentials: true,
}));

const limiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/rooms', roomRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/test', (req, res) => {
  res.json({ message: '🔐 CIPHERTALK Backend Running!' });
});

app.use(notFound);
app.use(errorHandler);

async function startServer() {
  try {
    const connected = await testSupabaseConnection();
    if (!connected) throw new Error('Supabase connection failed');
    app.listen(config.PORT, () => {
      logger.info(`🚀 Server running on http://localhost:${config.PORT}`);
      logger.info(`📊 Environment: ${config.NODE_ENV}`);
      logger.info('📍 API routes ready:');
      logger.info('   POST   /api/auth/register');
      logger.info('   POST   /api/auth/login');
      logger.info('   POST   /api/rooms/create');
      logger.info('   GET    /api/rooms/list');
      logger.info('   POST   /api/messages/send');
      logger.info('   GET    /api/messages/:roomId');
    });
  } catch (error) {
    logger.error('Failed to start:', error.message);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  logger.info('Shutting down...');
  process.exit(0);
});

startServer();

export default app;
