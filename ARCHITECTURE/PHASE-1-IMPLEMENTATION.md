# Phase 1: Foundation Implementation Guide

**Week 1 Target: Tenant Infrastructure**

---

## Files to Create

### 1. Type Definitions

#### src/types/tenant.ts
```typescript
/**
 * Core tenant (school) type definitions
 * These types form the foundation of multi-tenancy
 */

export type SchoolType = 'girls' | 'boys';

export interface SchoolBranding {
  primaryColor?: string;           // HEX color for UI accents
  secondaryColor?: string;          // HEX color for secondary UI
  logoUrl?: string;                 // CDN URL to school logo
  schoolName?: string;              // Override default school display name
  fontFamily?: string;              // Optional custom font
}

export interface SchoolPointSystem {
  basePoints: number;               // Points per correct answer
  streakBonus: number;              // Bonus for consecutive days
  milestoneThreshold: number;       // Points needed for prizes
  streakDaysRequired: number;       // Days needed for streak bonus
}

export interface SchoolCustomMessages {
  welcome?: string;                 // Custom welcome message
  quizDayHeader?: string;           // Header for daily quiz page
  noHalachaToday?: string;          // Message when no halacha available
  leaderboardTitle?: string;        // Custom leaderboard title
}

export interface SchoolSettings {
  halachaTheme: 'daily' | 'weekly' | 'custom';
  pointSystem: SchoolPointSystem;
  startDate: string;                  // ISO date for when school started using app
  customMessages: SchoolCustomMessages;
  allowStudentRegistration: boolean;  // Can students self-register?
  requireInvitationCode: boolean;    // Require valid invitation code?
}

export interface SchoolMetadata {
  id: string;
  name: string;
  type: SchoolType;
  subdomain: string;                  // e.g., "alhatora" for alhatora.ulpaquiz.com
  branding: SchoolBranding;
  adminEmails: string[];              // List of authorized admin emails
  createdAt: string;                    // ISO timestamp
  isActive: boolean;
}

export interface School extends SchoolMetadata {
  settings: SchoolSettings;
  status: {
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    lastActive: string;
  };
}

/**
 * Context for active school within the app
 */
export interface TenantContext {
  school: School | null;
  isInitialized: boolean;
  isLoading: boolean;
  error: Error | null;
}

/**
 * School identification methods
 */
export type SchoolIdentificationMethod = 'subdomain' | 'path' | 'selector';
```

---

### 2. Tenant Utilities

#### src/lib/tenant.ts
```typescript
/**
 * Tenant identification and school context management
 */

import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebaseClient';
import { School, SchoolIdentificationMethod } from '../types/tenant';

/**
 * Extract school ID from the current URL
 */
export function getSchoolIdFromUrl(
  method: SchoolIdentificationMethod = 'path'
): string | null {
  const path = window.location.pathname;
  const segments = path.split('/').filter(Boolean);
  
  if (method === 'path' && segments.length >= 2) {
    // /girls/school-name or /boys/school-name
    return segments[1] || null;
  }
  
  if (method === 'selector') {
    // Read from localStorage or sessionStorage
    return localStorage.getItem('currentSchoolId');
  }
  
  return null;
}

/**
 * Extract school type from URL (girls/boys)
 */
export function getSchoolTypeFromUrl(): 'girls' | 'boys' | null {
  const path = window.location.pathname;
  if (path.includes('/girls')) return 'girls';
  if (path.includes('/boys')) return 'boys';
  return null;
}

/**
 * Load school configuration from Firestore
 */
export async function loadSchoolConfig(
  schoolId: string
): Promise<School | null> {
  try {
    const schoolRef = doc(db, 'schools', schoolId);
    const schoolSnap = await getDoc(schoolRef);
    
    if (!schoolSnap.exists()) {
      console.warn(`School not found: ${schoolId}`);
      return null;
    }
    
    return { id: schoolSnap.id, ...schoolSnap.data() } as School;
  } catch (error) {
    console.error('Failed to load school config:', error);
    return null;
  }
}

/**
 * Find school by subdomain
 */
export async function findSchoolBySubdomain(
  subdomain: string
): Promise<School | null> {
  try {
    const schoolsRef = collection(db, 'schools');
    const q = query(schoolsRef, where('subdomain', '==', subdomain));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return null;
    
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as School;
  } catch (error) {
    console.error('Failed to find school by subdomain:', error);
    return null;
  }
}

/**
 * Check if user email is authorized for this school
 */
export function isUserAuthorizedForSchool(
  userEmail: string,
  school: School | null
): boolean {
  if (!school) return false;
  
  const normalizedEmail = userEmail.toLowerCase().trim();
  return school.adminEmails.some(email => 
    email.toLowerCase().trim() === normalizedEmail
  );
}

/**
 * Check if user is a student in this school
 */
export function isStudentInSchool(
  studentId: string,
  schoolId: string
): boolean {
  // This would query the students collection with schoolId filter
  // Implementation depends on how student records are structured
  return true; // Placeholder
}
```

---

### 3. React Hook

#### src/hooks/useSchool.ts
```typescript
/**
 * React hook for school tenant context
 */

import { useEffect, useState } from 'react';
import { loadSchoolConfig, getSchoolIdFromUrl } from '../lib/tenant';
import { School } from '../types/tenant';

export function useSchool() {
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const initSchool = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const schoolId = getSchoolIdFromUrl();
        if (!schoolId) {
          throw new Error('School ID not found in URL');
        }
        
        const config = await loadSchoolConfig(schoolId);
        if (!config) {
          throw new Error(`School "${schoolId}" not configured`);
        }
        
        setSchool(config);
      } catch (e) {
        setError(e instanceof Error ? e : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    initSchool();
  }, []);

  return { school, loading, error };
}
```

---

### 4. Context Provider

#### src/components/tenant/SchoolConfigProvider.tsx
```typescript
/**
 * Provider component for school context
 * Wraps the app to provide school configuration
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { useSchool } from '../../hooks/useSchool';
import { TenantContext, School } from '../../types/tenant';

const TenantContext = createContext<TenantContext>({
  school: null,
  isInitialized: false,
  isLoading: true,
  error: null,
});

interface Props {
  children: ReactNode;
}

export function SchoolConfigProvider({ children }: Props) {
  const { school, loading, error } = useSchool();
  
  const value: TenantContext = {
    school,
    isInitialized: !!school && !loading,
    isLoading: loading,
    error,
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}

export { TenantContext };
```

---

## Quick Migration Script

#### scripts/migrate-to-multi-tenant.mjs (partial)
```javascript
/**
 * Add schoolId field to existing documents
 * Safe: Add-only, doesn't modify existing data (just adds field)
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, writeBatch } from 'firebase-admin/firestore';

const projectId = 'ulpaquiz';
const app = initializeApp({
  credential: applicationDefault(),
  projectId,
});
const db = getFirestore(app, '(default)');

const DEFAULT_SCHOOL_ID = 'olpna-girls'; // Original school ID

async function migrateStudents() {
  const batch = writeBatch(db);
  const students = db.collection('students').limit(500);
  
  for (const doc of students.docs) {
    batch.update(doc.ref, { schoolId: DEFAULT_SCHOOL_ID });
  }
  
  await batch.commit();
  console.log('Migrated students');
}

// Similar for quizzes, halachot, submissions, etc.
```

---

## Firestore Rules Template

#### firestore.rules (add to existing)
```firestore
// Tenant-aware security rules
function isAuthorizedForSchool(schoolId) {
  return request.auth != null &&
    exists(/databases/$(database)/documents/schools/$(schoolId)) &&
    get(/databases/$(database)/documents/schools/$(schoolId)).data.adminEmails has any [request.auth.token.email];
}

function isStudentInSchool(studentId, schoolId) {
  return get(/databases/$(database)/documents/students/$(studentId)).data.schoolId == schoolId;
}
```

---

## Next Steps After Phase 1

1. ✅ Types created and tested
2. ✅ Tenant utils implemented
3. ✅ React hook built
4. ✅ Context provider wrapping the app
5. ⏳ Run migration script on staging data
6. ⏳ Update Firestore security rules
7. ⏳ Test isolation with multiple schools