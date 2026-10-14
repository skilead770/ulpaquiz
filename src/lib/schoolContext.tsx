import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { SchoolConfig, GenderVocabulary, SchoolGender, SchoolType } from '../types';
import { SUPER_ADMIN_EMAIL } from './config';
import { ULPANA_LOGO_URL } from '../assets/logo';
import { DEFAULT_CLASSES } from '../types';
import { db } from './firebaseClient';
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';

export const GIRLS_VOCABULARY: GenderVocabulary = {
  student: 'תלמידה',
  students: 'תלמידות',
  headmaster: 'מנהלת האולפנה',
  teacher: 'מורה',
  coordinator: 'רכזת ההלכה',
  schoolTerm: 'אולפנא',
  school: 'אולפנא',
  welcome: 'ברוכה הבאה',
  login: 'התחברי',
  register: 'הרשמי',
  study: 'לימוד יומי',
  leaderboard: 'טבלת מובילות',
  admin: 'ניהול אולפנה',
  completedQuiz: 'השלמת את החידון היומי!',
  earnedPoints: 'צברת',
  champion: 'אלופת האולפנה',
  pendingNotice: 'ההרשמה שלך נקלטה וממתינה לאישור רכזת ההלכה',
  studyConfirm: 'קראתי והבנתי את ההלכה היומית',
  registerNewStudent: 'הרשמת תלמידה חדשה',
  studentLeague: 'ליגת תלמידות',
  waitingApproval: 'ממתינה לאישור',
  approvedStudent: 'תלמידה מאושרת',
  noStudentsYet: 'אין תלמידות רשומות עדיין',
  congratulationsChampion: 'כל הכבוד! את אלופת האולפנה!',
};

export const BOYS_VOCABULARY: GenderVocabulary = {
  student: 'תלמיד',
  students: 'תלמידים',
  headmaster: 'ראש הישיבה',
  teacher: 'ר"מ',
  coordinator: 'רכז ההלכה',
  schoolTerm: 'ישיבה תיכונית',
  school: 'ישיבה תיכונית',
  welcome: 'ברוך הבא',
  login: 'התחבר',
  register: 'הרשם',
  study: 'לימוד יומי',
  leaderboard: 'טבלת מובילים',
  admin: 'ניהול ישיבה',
  completedQuiz: 'השלמת את החידון היומי!',
  earnedPoints: 'צברת',
  champion: 'אלוף הישיבה',
  pendingNotice: 'ההרשמה שלך נקלטה וממתינה לאישור רכז ההלכה',
  studyConfirm: 'קראתי ולמדתי את ההלכה היומית',
  registerNewStudent: 'הרשמת תלמיד חדש',
  studentLeague: 'ליגת תלמידים',
  waitingApproval: 'ממתין לאישור',
  approvedStudent: 'תלמיד מאושר',
  noStudentsYet: 'אין תלמידים רשומים עדיין',
  congratulationsChampion: 'כל הכבוד! אתה אלוף הישיבה!',
};

export const DEFAULT_SCHOOL_CONFIG: SchoolConfig = {
  id: 'even-shmuel',
  name: 'אולפנת אבן שמואל',
  gender: 'girls',
  type: 'ulpana',
  logoUrl: ULPANA_LOGO_URL,
  primaryColor: '#d97706', // amber-600
  themeKey: 'amber',
  defaultClasses: DEFAULT_CLASSES,
  superAdminEmail: SUPER_ADMIN_EMAIL,
  mainManagerEmail: 'skilead770@gmail.com',
  createdAt: '2026-09-01T00:00:00Z',
  dailyDedication: 'לעילוי נשמת מעוז פניגשטיין הי"ד',
  active: true,
};

// Seed pilot schools so the system is immediately ready for both Boys Yeshiva and Girls Ulpana
export const PILOT_SCHOOLS: SchoolConfig[] = [
  DEFAULT_SCHOOL_CONFIG,
  {
    id: 'kfar-haroeh',
    name: 'ישיבת כפר הרא"ה',
    gender: 'boys',
    type: 'yeshiva',
    logoUrl: '',
    primaryColor: '#1d4ed8', // blue-700
    themeKey: 'royal-blue',
    defaultClasses: ["ט'1", "ט'2", "י'1", "י'2", "יא'1", "יא'2", "יב'1", "יב'2"],
    superAdminEmail: SUPER_ADMIN_EMAIL,
    mainManagerEmail: 'rav.haroeh@gmail.com',
    mainManagerName: 'הרב אליהו',
    createdAt: new Date().toISOString(),
    dailyDedication: 'לעילוי נשמת מייסד הישיבה מרן הרב משה צבי נריה זצ"ל',
    active: true,
  },
  {
    id: 'pelech-jerusalem',
    name: 'אולפנת פלך ירושלים',
    gender: 'girls',
    type: 'ulpana',
    logoUrl: '',
    primaryColor: '#7c3aed', // violet-600
    themeKey: 'purple',
    defaultClasses: ["ט'1", "ט'2", "י'1", "י'2", "יא'1", "יב'1"],
    superAdminEmail: SUPER_ADMIN_EMAIL,
    mainManagerEmail: 'pelech.admin@gmail.com',
    mainManagerName: 'הרבנית תמר',
    createdAt: new Date().toISOString(),
    dailyDedication: '',
    active: true,
  },
];

export function detectSchoolIdFromEnvironment(): string {
  if (typeof window === 'undefined') return DEFAULT_SCHOOL_CONFIG.id;

  try {
    // 1. Check URL query param (e.g. ?school=kfar-haroeh)
    const urlParams = new URLSearchParams(window.location.search);
    const paramSchool = urlParams.get('school');
    if (paramSchool && paramSchool.trim()) {
      const cleanSlug = paramSchool.trim().toLowerCase();
      localStorage.setItem('ulpaquiz_active_school_id', cleanSlug);
      return cleanSlug;
    }

    // 2. Check Hostname for Multi-Site or Subdomain routing:
    // e.g. "kfar-haroeh.web.app", "kfar-haroeh.ulpaquiz.web.app", "pelech.org.il"
    const hostname = window.location.hostname.toLowerCase();
    if (
      hostname !== 'localhost' &&
      hostname !== '127.0.0.1' &&
      !hostname.startsWith('ulpaquiz.') &&
      hostname !== 'ulpaquiz.web.app' &&
      hostname !== 'ulpaquiz.firebaseapp.com'
    ) {
      // If it's a subdomain like "kfar-haroeh.web.app"
      const parts = hostname.split('.');
      if (parts.length >= 3) {
        return parts[0];
      }
    }

    // 3. Check persistent storage (e.g. previously selected school by admin/user)
    const stored = localStorage.getItem('ulpaquiz_active_school_id');
    if (stored && stored.trim()) {
      return stored.trim();
    }
  } catch (err) {
    console.warn('[SchoolContext] Could not detect school from URL/Storage:', err);
  }

  return DEFAULT_SCHOOL_CONFIG.id;
}

interface SchoolContextValue {
  school: SchoolConfig;
  t: GenderVocabulary;
  schoolId: string;
  setSchoolId: (id: string) => void;
  allSchools: SchoolConfig[];
  refreshSchools: () => Promise<void>;
  isLoadingSchool: boolean;
}

const SchoolContext = createContext<SchoolContextValue>({
  school: DEFAULT_SCHOOL_CONFIG,
  t: GIRLS_VOCABULARY,
  schoolId: DEFAULT_SCHOOL_CONFIG.id,
  setSchoolId: () => {},
  allSchools: PILOT_SCHOOLS,
  refreshSchools: async () => {},
  isLoadingSchool: false,
});

export const SchoolProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeSchoolId, setActiveSchoolId] = useState<string>(() => detectSchoolIdFromEnvironment());
  const [school, setSchool] = useState<SchoolConfig>(() => {
    const match = PILOT_SCHOOLS.find((s) => s.id === activeSchoolId);
    return match || DEFAULT_SCHOOL_CONFIG;
  });
  const [allSchools, setAllSchools] = useState<SchoolConfig[]>(PILOT_SCHOOLS);
  const [isLoadingSchool, setIsLoadingSchool] = useState(false);

  // Vocabulary based on school gender
  const t = useMemo(() => {
    return school.gender === 'boys' ? BOYS_VOCABULARY : GIRLS_VOCABULARY;
  }, [school.gender]);

  // Load all schools from Firestore
  const refreshSchools = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, 'schools'));
      if (!snap.empty) {
        const loaded = snap.docs.map((docSnap) => docSnap.data() as SchoolConfig);
        // Merge with pilot schools to make sure default school is always available
        const map = new Map<string, SchoolConfig>();
        PILOT_SCHOOLS.forEach((s) => map.set(s.id, s));
        loaded.forEach((s) => map.set(s.id, s));
        const combined = Array.from(map.values());
        setAllSchools(combined);

        // Update current school if it matches
        const currentMatch = combined.find((s) => s.id === activeSchoolId);
        if (currentMatch) {
          setSchool(currentMatch);
        }
      }
    } catch (err) {
      console.warn('[SchoolContext] Could not fetch schools from Firestore, using pilots:', err);
    }
  }, [activeSchoolId]);

  useEffect(() => {
    void refreshSchools();
  }, [refreshSchools]);

  // When activeSchoolId changes, load or switch the school profile
  useEffect(() => {
    let isMounted = true;
    setIsLoadingSchool(true);

    const loadSchool = async () => {
      try {
        // Try to get from Firestore
        const docRef = doc(db, 'schools', activeSchoolId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && isMounted) {
          const fetchedSchool = docSnap.data() as SchoolConfig;
          setSchool(fetchedSchool);
          setIsLoadingSchool(false);
          return;
        }
      } catch (err) {
        console.warn(`[SchoolContext] Could not load school ${activeSchoolId} from Firestore:`, err);
      }

      // Fallback: check pilot schools
      if (isMounted) {
        const pilotMatch = allSchools.find((s) => s.id === activeSchoolId) || DEFAULT_SCHOOL_CONFIG;
        setSchool(pilotMatch);
        setIsLoadingSchool(false);
      }
    };

    void loadSchool();

    return () => {
      isMounted = false;
    };
  }, [activeSchoolId, allSchools]);

  const handleSetSchoolId = useCallback((newId: string) => {
    const clean = newId.trim().toLowerCase();
    setActiveSchoolId(clean);
    try {
      localStorage.setItem('ulpaquiz_active_school_id', clean);
      // Also update URL query parameter cleanly without reloading
      const url = new URL(window.location.href);
      url.searchParams.set('school', clean);
      window.history.replaceState({}, '', url.toString());
    } catch (e) {
      console.warn('[SchoolContext] Could not persist school id:', e);
    }
  }, []);

  return (
    <SchoolContext.Provider
      value={{
        school,
        t,
        schoolId: activeSchoolId,
        setSchoolId: handleSetSchoolId,
        allSchools,
        refreshSchools,
        isLoadingSchool,
      }}
    >
      {children}
    </SchoolContext.Provider>
  );
};

export function useSchool(): SchoolContextValue {
  return useContext(SchoolContext);
}
