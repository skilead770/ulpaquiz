import {
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  deleteField,
  onSnapshot,
} from 'firebase/firestore';
import { auth, db } from '../firebaseClient';
import {
  PrizeMilestone,
  PrizeReportItem,
  CustomCalendarAnnotation,
  CalendarAnnotationsMap,
} from '../../types';
import { DEFAULT_PRIZE_MILESTONES } from '../../data/seedData';
import { API_BASE_URL } from '../config';
import { fetchPublicStudentSummaries, parseJsonResponse } from './core';

let cachedPrizeMilestones: PrizeMilestone[] | null = null;

export function invalidatePrizeMilestonesCache(): void {
  cachedPrizeMilestones = null;
}

export async function getPrizeMilestones(forceRefresh: boolean = false): Promise<PrizeMilestone[]> {
  if (!forceRefresh && cachedPrizeMilestones) {
    return cachedPrizeMilestones;
  }
  try {
    const settingsSnap = await getDoc(doc(db, 'settings', 'prizeMilestones'));
    if (settingsSnap.exists()) {
      const data = settingsSnap.data() as { milestones?: PrizeMilestone[] };
      if (Array.isArray(data.milestones) && data.milestones.length > 0) {
        const sorted = [...data.milestones].sort((a, b) => a.points - b.points);
        cachedPrizeMilestones = sorted;
        return sorted;
      }
    }
  } catch (err) {
    console.info('[Firestore] Direct prize milestone read failed, falling back to defaults:', err);
  }

  const defaults = [...DEFAULT_PRIZE_MILESTONES].sort((a, b) => a.points - b.points);
  cachedPrizeMilestones = defaults;
  return defaults;
}

export async function savePrizeMilestonesApi(milestones: PrizeMilestone[]): Promise<PrizeMilestone[]> {
  const normalized = [...milestones]
    .map((m) => ({
      ...m,
      points: Math.max(0, Number(m.points) || 0),
      title: (m.title || '').trim(),
      rewardDescription: (m.rewardDescription || '').trim(),
      iconName: (m.iconName || 'Award').trim(),
    }))
    .filter((m) => m.title && m.rewardDescription)
    .sort((a, b) => a.points - b.points);

  await setDoc(doc(db, 'settings', 'prizeMilestones'), {
    milestones: normalized,
    updatedAt: new Date().toISOString(),
  });

  cachedPrizeMilestones = normalized;
  return normalized;
}

export async function getDailyQuizDedicationApi(): Promise<string> {
  const dedicationSnap = await getDoc(doc(db, 'settings', 'dailyQuizDedication'));
  if (!dedicationSnap.exists()) return '';

  const name = dedicationSnap.data().name;
  if (typeof name !== 'string') {
    throw new Error('הגדרת הקדשת החידון אינה תקינה');
  }
  return name.trim();
}

export function subscribeToDailyQuizDedication(
  onChange: (name: string) => void,
  onError: (error: Error) => void
): () => void {
  return onSnapshot(
    doc(db, 'settings', 'dailyQuizDedication'),
    (dedicationSnap) => {
      if (!dedicationSnap.exists()) {
        onChange('');
        return;
      }

      const name = dedicationSnap.data().name;
      if (typeof name !== 'string') {
        onError(new Error('הגדרת הקדשת החידון אינה תקינה'));
        return;
      }
      onChange(name.trim());
    },
    onError
  );
}

export async function saveDailyQuizDedicationApi(name: string): Promise<string> {
  const normalizedName = name.trim();
  if (normalizedName.length > 120) {
    throw new Error('שם ההקדשה יכול להכיל עד 120 תווים');
  }

  await setDoc(doc(db, 'settings', 'dailyQuizDedication'), {
    name: normalizedName,
    updatedAt: new Date().toISOString(),
  });
  return normalizedName;
}

export async function getCalendarAnnotationsApi(): Promise<CalendarAnnotationsMap> {
  const snap = await getDoc(doc(db, 'settings', 'calendarAnnotations'));
  if (!snap.exists()) return {};
  const data = snap.data();
  if (!data || typeof data.annotations !== 'object' || data.annotations === null) {
    return {};
  }
  return data.annotations as CalendarAnnotationsMap;
}

export function subscribeToCalendarAnnotations(
  onChange: (annotations: CalendarAnnotationsMap) => void,
  onError?: (error: Error) => void
): () => void {
  return onSnapshot(
    doc(db, 'settings', 'calendarAnnotations'),
    (snap) => {
      if (!snap.exists()) {
        onChange({});
        return;
      }
      const data = snap.data();
      if (!data || typeof data.annotations !== 'object' || data.annotations === null) {
        onChange({});
        return;
      }
      onChange(data.annotations as CalendarAnnotationsMap);
    },
    (error) => {
      if (onError) onError(error);
    }
  );
}

export async function saveCalendarAnnotationApi(
  dateKey: string,
  annotation: CustomCalendarAnnotation | null
): Promise<void> {
  const trimmedKey = dateKey.trim();
  if (!trimmedKey) {
    throw new Error('מזהה תאריך אינו תקין');
  }

  const ref = doc(db, 'settings', 'calendarAnnotations');
  const snap = await getDoc(ref);

  if (annotation === null) {
    if (snap.exists()) {
      await updateDoc(ref, {
        [`annotations.${trimmedKey}`]: deleteField(),
        updatedAt: new Date().toISOString(),
      });
    }
    return;
  }

  const cleanText = (annotation.text || '').trim();
  if (!cleanText) {
    if (snap.exists()) {
      await updateDoc(ref, {
        [`annotations.${trimmedKey}`]: deleteField(),
        updatedAt: new Date().toISOString(),
      });
    }
    return;
  }

  if (cleanText.length > 200) {
    throw new Error('הערת התאריך יכולה להכיל עד 200 תווים');
  }

  const itemToSave: CustomCalendarAnnotation = {
    text: cleanText,
    mode: annotation.mode === 'replace' ? 'replace' : 'append',
    updatedAt: new Date().toISOString(),
    ...(auth.currentUser?.email ? { updatedBy: auth.currentUser.email } : {}),
  };

  if (!snap.exists()) {
    await setDoc(ref, {
      annotations: {
        [trimmedKey]: itemToSave,
      },
      updatedAt: new Date().toISOString(),
    });
  } else {
    await updateDoc(ref, {
      [`annotations.${trimmedKey}`]: itemToSave,
      updatedAt: new Date().toISOString(),
    });
  }
}

export async function fetchPrizesApi(): Promise<{
  reports: PrizeReportItem[];
  milestones: PrizeMilestone[];
}> {
  try {
    const milestones = await getPrizeMilestones();
    const activeStudents = await fetchPublicStudentSummaries();

    const reports: PrizeReportItem[] = activeStudents.map((student) => {
      const qualifyingMilestones = milestones.filter((m) => student.points >= m.points);
      const nextMilestone = milestones.find((m) => student.points < m.points) || null;
      const pointsNeeded = nextMilestone ? nextMilestone.points - student.points : 0;

      return {
        student,
        qualifyingMilestones,
        nextMilestone,
        pointsNeeded,
      };
    });

    return {
      reports,
      milestones,
    };
  } catch (e) {
    console.info('[API] Firestore prize fetch failed, trying server fallback');
  }

  try {
    const res = await fetch(API_BASE_URL + '/api/prizes');
    if (res.ok) {
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Server prize fetch failed, using defaults');
  }

  return {
    reports: [],
    milestones: [...DEFAULT_PRIZE_MILESTONES].sort((a, b) => a.points - b.points),
  };
}
