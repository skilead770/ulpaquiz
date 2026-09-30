/**
 * Application Configuration
 * Centralized source for environment variables and project constants.
 */

const getViteEnv = (): Record<string, any> => {
  try {
    return Function('return typeof import.meta !== "undefined" ? import.meta.env ?? {} : {}')() || {};
  } catch {
    return {};
  }
};

// Helper to safely resolve variables from either Node's process.env or Vite's import.meta.env
const getEnv = (key: string, fallback: string = ''): string => {
  if (typeof process !== 'undefined' && process.env?.[key]) {
    return process.env[key]!;
  }

  const viteEnv = getViteEnv();
  if (viteEnv?.[key]) {
    return viteEnv[key];
  }

  return fallback;
};

// Check if running in a production environment
const isProd = typeof process !== 'undefined'
  ? process.env?.NODE_ENV === 'production' || Boolean(process.env?.PROD)
  : false;

export const SUPER_ADMIN_EMAIL = getEnv('VITE_SUPER_ADMIN_EMAIL', '');
export const FIREBASE_PROJECT_ID = getEnv('VITE_FIREBASE_PROJECT_ID', 'ulpaquiz');
export const API_BASE_URL = getEnv('VITE_API_BASE_URL', '');

// Security check: Warn if environment variables are missing in production
if (isProd) {
  if (!SUPER_ADMIN_EMAIL) {
    console.warn('[Config] VITE_SUPER_ADMIN_EMAIL is not set in production!');
  }
  if (!FIREBASE_PROJECT_ID) {
    console.warn('[Config] VITE_FIREBASE_PROJECT_ID is not set in production!');
  }
}
