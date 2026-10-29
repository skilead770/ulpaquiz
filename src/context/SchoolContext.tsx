import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { School, DEFAULT_SCHOOLS, DEFAULT_SCHOOL_ID, TenantContextType } from '../types/tenant';
import { getGenderText } from '../lib/gender';
import { SUPER_ADMIN_EMAIL } from '../lib/config';
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../lib/firebaseClient';

const SchoolContext = createContext<TenantContextType | undefined>(undefined);

interface SchoolProviderProps {
  children: ReactNode;
}

export const SchoolProvider: React.FC<SchoolProviderProps> = ({ children }) => {
  const [schools, setSchools] = useState<School[]>(DEFAULT_SCHOOLS);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(() => {
    return auth.currentUser?.email || null;
  });

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setCurrentUserEmail(user?.email || null);
    });
  }, []);

  const [currentSchoolId, setCurrentSchoolId] = useState<string>(() => {
    // 1. Check URL query param: ?school=xxx
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlSchool = params.get('school');
      if (urlSchool) return urlSchool;

      // 2. Check localStorage
      const saved = localStorage.getItem('currentSchoolId');
      if (saved) return saved;
    }
    return DEFAULT_SCHOOL_ID;
  });

  // Fetch dynamic schools from Firestore on mount
  useEffect(() => {
    async function loadSchools() {
      try {
        const snap = await getDocs(collection(db, 'schools'));
        if (!snap.empty) {
          const loaded: School[] = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<School, 'id'>),
          }));

          // Seed any default school that isn't in Firestore yet, then use Firestore as source of truth
          const merged = [...loaded];
          const seedPromises: Promise<void>[] = [];
          for (const def of DEFAULT_SCHOOLS) {
            if (!merged.some((s) => s.id === def.id)) {
              merged.push(def);
              seedPromises.push(
                setDoc(doc(db, 'schools', def.id), def).catch((err) =>
                  console.warn(`[SchoolContext] Could not seed school ${def.id}:`, err)
                )
              );
            }
          }
          if (seedPromises.length > 0) void Promise.all(seedPromises);
          setSchools(merged);
        }
      } catch (err) {
        console.warn('[SchoolContext] Could not load schools from Firestore, using defaults:', err);
      }
    }
    loadSchools();
  }, []);

  // Update current school when currentSchoolId or schools changes
  const currentSchool = useMemo<School>(() => {
    const found = schools.find((s) => s.id === currentSchoolId && s.isActive !== false);
    if (found) return found;
    return schools.find((s) => s.id === DEFAULT_SCHOOL_ID) || DEFAULT_SCHOOLS[0];
  }, [schools, currentSchoolId]);

  // Gender vocabulary corresponding to active school
  const genderText = useMemo(() => {
    return getGenderText(currentSchool.type);
  }, [currentSchool.type]);

  const setSchoolId = (schoolId: string) => {
    setCurrentSchoolId(schoolId);
    try {
      localStorage.setItem('currentSchoolId', schoolId);
      // Update URL query parameter cleanly without reloading
      const url = new URL(window.location.href);
      url.searchParams.set('school', schoolId);
      window.history.replaceState({}, '', url.toString());
    } catch {
      // Ignore localStorage issues
    }
  };

  const isSuperAdmin = useMemo<boolean>(() => {
    if (!currentUserEmail) return false;
    return currentUserEmail.trim().toLowerCase() === SUPER_ADMIN_EMAIL.trim().toLowerCase();
  }, [currentUserEmail]);

  const canManageSchool = (schoolId: string): boolean => {
    if (!currentUserEmail) return false;
    const cleanEmail = currentUserEmail.trim().toLowerCase();
    if (cleanEmail === SUPER_ADMIN_EMAIL.trim().toLowerCase()) return true;

    const targetSchool = schools.find((s) => s.id === schoolId);
    if (!targetSchool) return false;

    return (targetSchool.adminEmails || []).some(
      (adminEmail) => adminEmail.trim().toLowerCase() === cleanEmail
    );
  };

  // Auto-switch school if current user is an admin of another school
  useEffect(() => {
    if (!currentUserEmail || isSuperAdmin) return;
    const cleanEmail = currentUserEmail.trim().toLowerCase();
    if (!canManageSchool(currentSchoolId)) {
      const managedSchool = schools.find((s) =>
        (s.adminEmails || []).some((e) => e.trim().toLowerCase() === cleanEmail)
      );
      if (managedSchool) {
        setSchoolId(managedSchool.id);
      }
    }
  }, [currentUserEmail, isSuperAdmin, schools, currentSchoolId]);

  const refreshSchools = async () => {
    try {
      const snap = await getDocs(collection(db, 'schools'));
      if (!snap.empty) {
        const loaded: School[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<School, 'id'>),
        }));
        setSchools(loaded);
      }
    } catch (e) {
      console.error('[SchoolContext] Failed to refresh schools:', e);
    }
  };

  const syncAllManagers = async (): Promise<number> => {
    let count = 0;
    try {
      const superClean = SUPER_ADMIN_EMAIL.trim().toLowerCase();
      const superDocId = superClean.replace(/[^a-zA-Z0-9_]/g, '_');

      // 1. Ensure super admin documents exist in managers
      await setDoc(
        doc(db, 'managers', superDocId),
        {
          id: superDocId,
          email: superClean,
          name: 'Super Admin',
          role: 'superadmin',
          schoolIds: ['all'],
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      count++;

      await setDoc(
        doc(db, 'managers', 'super_admin'),
        {
          id: 'super_admin',
          email: superClean,
          name: 'Super Admin',
          role: 'superadmin',
          schoolIds: ['all'],
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      // 2. Read all schools from Firestore
      const snap = await getDocs(collection(db, 'schools'));
      const allSchools: School[] = snap.empty
        ? schools
        : snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<School, 'id'>) }));

      const emailMap = new Map<string, { email: string; schoolIds: Set<string> }>();

      for (const sc of allSchools) {
        for (const adminEmail of sc.adminEmails || []) {
          const clean = adminEmail.trim().toLowerCase();
          if (!clean) continue;
          if (!emailMap.has(clean)) {
            emailMap.set(clean, { email: clean, schoolIds: new Set() });
          }
          emailMap.get(clean)!.schoolIds.add(sc.id);
        }
      }

      for (const [cleanEmail, data] of emailMap.entries()) {
        const docId = cleanEmail.replace(/[^a-zA-Z0-9_]/g, '_');
        await setDoc(
          doc(db, 'managers', docId),
          {
            id: docId,
            email: cleanEmail,
            name: cleanEmail.split('@')[0],
            role: cleanEmail === superClean ? 'superadmin' : 'admin',
            schoolIds: Array.from(data.schoolIds),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
        count++;
      }
    } catch (err) {
      console.error('[SchoolContext] Failed to sync managers:', err);
      throw err;
    }
    return count;
  };

  // Automatically sync managers when super admin is detected
  useEffect(() => {
    if (isSuperAdmin) {
      syncAllManagers().catch((err) => {
        console.warn('[SchoolContext] Auto-sync managers error:', err);
      });
    }
  }, [isSuperAdmin]);

  const saveSchool = async (school: School) => {
    try {
      await setDoc(doc(db, 'schools', school.id), school, { merge: true });

      // Automatically sync adminEmails to /managers so Firestore security rules recognize them immediately
      for (const adminEmail of school.adminEmails || []) {
        const clean = adminEmail.trim().toLowerCase();
        if (!clean) continue;
        const docId = clean.replace(/[^a-zA-Z0-9_]/g, '_');
        await setDoc(
          doc(db, 'managers', docId),
          {
            id: docId,
            email: clean,
            name: clean.split('@')[0],
            role: clean === SUPER_ADMIN_EMAIL.trim().toLowerCase() ? 'superadmin' : 'admin',
            schoolIds: [school.id],
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }

      setSchools((prev) => {
        const idx = prev.findIndex((s) => s.id === school.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = school;
          return next;
        }
        return [...prev, school];
      });
    } catch (e) {
      console.error('[SchoolContext] Failed to save school:', e);
      throw e;
    }
  };

  const deleteSchool = async (schoolId: string) => {
    try {
      await deleteDoc(doc(db, 'schools', schoolId));
      setSchools((prev) => prev.filter((s) => s.id !== schoolId));
    } catch (e) {
      console.error('[SchoolContext] Failed to delete school:', e);
      throw e;
    }
  };

  return (
    <SchoolContext.Provider
      value={{
        currentSchool,
        currentSchoolId: currentSchool.id,
        setSchoolId,
        availableSchools: schools,
        genderText,
        isSuperAdmin,
        canManageSchool,
        refreshSchools,
        saveSchool,
        deleteSchool,
        syncAllManagers,
      }}
    >
      {children}
    </SchoolContext.Provider>
  );
};

export const useTenant = (): TenantContextType => {
  const context = useContext(SchoolContext);
  if (!context) {
    throw new Error('useTenant must be used within a SchoolProvider');
  }
  return context;
};
