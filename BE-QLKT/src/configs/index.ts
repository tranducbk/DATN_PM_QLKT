function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

export const NODE_ENV = process.env.NODE_ENV || 'development';
export const PORT = process.env.PORT || '4000';

export const DATABASE_URL = process.env.DATABASE_URL;

export const JWT_SECRET = requireEnv('JWT_SECRET');
export const JWT_REFRESH_SECRET = requireEnv('JWT_REFRESH_SECRET');

export const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD;
export const DEV_ZONE_PASSWORD = process.env.DEV_ZONE_PASSWORD;


export const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
