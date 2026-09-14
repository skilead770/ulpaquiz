/**
 * Strict Gmail address validation according to Google's official rules:
 * 1. Domain must be @gmail.com or @googlemail.com
 * 2. Username (before @):
 *    - 6 to 30 characters in length
 *    - English letters (a-z), numbers (0-9), and periods (.)
 *    - Cannot start or end with a period (.)
 *    - Cannot contain consecutive periods (..)
 */

export interface GmailValidationResult {
  isValid: boolean;
  normalizedEmail?: string;
  error?: string;
}

export function validateGmailAddress(input: string): GmailValidationResult {
  if (!input || typeof input !== 'string') {
    return { isValid: false, error: 'נא להזין כתובת דוא"ל' };
  }

  const trimmed = input.trim().toLowerCase();

  // If user only typed username, auto-check potential gmail format
  const fullEmail = trimmed.includes('@') ? trimmed : `${trimmed}@gmail.com`;

  const parts = fullEmail.split('@');
  if (parts.length !== 2) {
    return { isValid: false, error: 'כתובת דוא"ל אינה בפורמט תקין' };
  }

  const [username, domain] = parts;

  // Domain check
  if (domain !== 'gmail.com' && domain !== 'googlemail.com') {
    return {
      isValid: false,
      error: 'ההרשמה מיועדת לכתובת Gmail בלבד (סיומת @gmail.com)',
    };
  }

  // Username length check (Google rule: 6-30 characters)
  if (username.length < 6) {
    return {
      isValid: false,
      error: 'שם המשתמש ב-Gmail חייב להכיל לפחות 6 תווים',
    };
  }

  if (username.length > 30) {
    return {
      isValid: false,
      error: 'שם המשתמש ב-Gmail יכול להכיל לכל היותר 30 תווים',
    };
  }

  // Leading or trailing dot check
  if (username.startsWith('.') || username.endsWith('.')) {
    return {
      isValid: false,
      error: 'כתובת Gmail אינה יכולה להתחיל או להסתיים בנקודה',
    };
  }

  // Consecutive dots check
  if (username.includes('..')) {
    return {
      isValid: false,
      error: 'כתובת Gmail אינה יכולה להכיל נקודות רצופות',
    };
  }

  // Character set check: only a-z, 0-9, and dot (.)
  const validPattern = /^[a-z0-9.]+$/;
  if (!validPattern.test(username)) {
    return {
      isValid: false,
      error: 'כתובת Gmail יכולה להכיל רק אותיות באנגלית (a-z), ספרות (0-9) ונקודות',
    };
  }

  return {
    isValid: true,
    normalizedEmail: `${username}@gmail.com`,
  };
}
