import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

// Fallback to parent directory if not found in current directory
if (!process.env.JWT_SECRET) {
  dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
}

export const config = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  SUPABASE_URL: process.env.VITE_SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRY: process.env.JWT_EXPIRY || '24h',
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,
  ENCRYPTION_MASTER_KEY: process.env.ENCRYPTION_MASTER_KEY,
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  LOG_LEVEL: process.env.LOG_LEVEL || 'debug',
  LOG_FILE: process.env.LOG_FILE || 'logs/app.log',
};

const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET', 'REFRESH_TOKEN_SECRET', 'ENCRYPTION_MASTER_KEY'];
const missing = required.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.error('Missing environment variables:', missing);
  process.exit(1);
}

export default config;
