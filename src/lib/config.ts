/**
 * Application Configuration
 * Centralized source for environment variables and project constants.
 */

export const SUPER_ADMIN_EMAIL = import.meta.env.VITE_SUPER_ADMIN_EMAIL || 'skilead770@gmail.com';
export const FIREBASE_PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'ulpaquiz';
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// Security check: Warn if environment variables are missing in production
if (import.meta.env.PROD) {
  if (!import.meta.env.VITE_SUPER_ADMIN_EMAIL) {
    console.warn('[Config] VITE_SUPER_ADMIN_EMAIL is not set in production!');
  }
  if (!import.meta.env.VITE_FIREBASE_PROJECT_ID) {
    console.warn('[Config] VITE_FIREBASE_PROJECT_ID is not set in production!');
  }
}
