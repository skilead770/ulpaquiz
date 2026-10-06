/**
 * Application Configuration
 * Centralized source for environment variables and project constants.
 */

// Helper to safely resolve variables from either Vite's compile-time inlined import.meta.env or Node's process.env
const getEnvVar = (viteVal: string | undefined, nodeKey: string, fallback: string = ''): string => {
  if (viteVal !== undefined && viteVal !== '') {
    return viteVal;
  }
  if (typeof process !== 'undefined' && process.env?.[nodeKey]) {
    return process.env[nodeKey]!;
  }
  return fallback;
};

// Explicit static references to import.meta.env so Vite can replace them at build time
export const SUPER_ADMIN_EMAIL: string = getEnvVar(
  import.meta.env.VITE_SUPER_ADMIN_EMAIL,
  'VITE_SUPER_ADMIN_EMAIL',
  'skilead770@gmail.com'
);

export const FIREBASE_PROJECT_ID: string = getEnvVar(
  import.meta.env.VITE_FIREBASE_PROJECT_ID,
  'VITE_FIREBASE_PROJECT_ID',
  'ulpaquiz'
);

export const API_BASE_URL: string = getEnvVar(
  import.meta.env.VITE_API_BASE_URL,
  'VITE_API_BASE_URL',
  ''
);

// Security check: Warn if environment variables are missing in production
if (import.meta.env.PROD) {
  if (!SUPER_ADMIN_EMAIL) {
    console.warn('[Config] VITE_SUPER_ADMIN_EMAIL is not set in production!');
  }
  if (!FIREBASE_PROJECT_ID) {
    console.warn('[Config] VITE_FIREBASE_PROJECT_ID is not set in production!');
  }
}
