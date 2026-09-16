/**
 * Application Configuration
 * Centralized source for environment variables and project constants.
 */

// Helper to safely resolve variables from either Node's process.env or Vite's import.meta.env
const getEnv = (key: string, fallback: string = ''): string => {
  if (typeof process !== 'undefined' && process.env?.[key]) {
    return process.env[key]!;
  }
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env?.[key]) {
    // @ts-ignore
    return import.meta.env[key];
  }
  return fallback;
};

// Check if running in a production environment
const isProd = typeof process !== 'undefined' 
  ? process.env?.NODE_ENV === 'production' || process.env?.PROD
  // @ts-ignore
  : typeof import.meta !== 'undefined' ? import.meta.env?.PROD : false;

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
