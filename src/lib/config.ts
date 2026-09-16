/**
 * Application Configuration
 * Centralized source for environment variables and project constants.
 */

export const SUPER_ADMIN_EMAIL = process.env.VITE_SUPER_ADMIN_EMAIL || 'skilead770@gmail.com';
export const FIREBASE_PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || 'ulpaquiz';
export const API_BASE_URL = process.env.VITE_API_BASE_URL || '';

// Security check: Warn if environment variables are missing in production
if (process.env.PROD) {
  if (!process.env.VITE_SUPER_ADMIN_EMAIL) {
    console.warn('[Config] VITE_SUPER_ADMIN_EMAIL is not set in production!');
  }
  if (!process.env.VITE_FIREBASE_PROJECT_ID) {
    console.warn('[Config] VITE_FIREBASE_PROJECT_ID is not set in production!');
  }
}
