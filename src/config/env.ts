import dotenv from 'dotenv';
import { existsSync } from 'fs';
import path from 'path';

let loadedFrom: string | null = null;

export function loadEnv(): string | null {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../.env'),
  ];

  for (const envPath of candidates) {
    if (existsSync(envPath)) {
      dotenv.config({ path: envPath, override: true });
      loadedFrom = envPath;
      return envPath;
    }
  }

  dotenv.config({ override: true });
  return null;
}

export function getEnvPath(): string | null {
  return loadedFrom;
}

export function envStatus(): Record<string, boolean> {
  return {
    TAVILY_API_KEY: !!process.env.TAVILY_API_KEY,
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    NOTIFICATION_EMAIL: !!process.env.NOTIFICATION_EMAIL,
    EMAIL_USER: !!process.env.EMAIL_USER,
    EMAIL_PASS: !!process.env.EMAIL_PASS,
  };
}

export function requireEnv(key: string): string {
  loadEnv();
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `${key} is not set. Add it to .env in the project root and restart the API server (npm run dev).`,
    );
  }
  return value;
}

// Load immediately on first import
loadEnv();
