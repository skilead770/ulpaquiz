import {
  collection,
  getDocs,
  query,
  where,
  doc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebaseClient';
import { getUpcomingQuizAvailability } from '../quizSchedule';
import {
  Student,
  PublicStudentSummary,
  QuizAvailability,
} from '../../types';

// Token Management for secure API requests.
// Keep the token in memory only so a browser compromise or local persistence does not expose an authenticated session.
let currentAuthToken: string | null = null;

export function setAuthToken(token: string | null) {
  currentAuthToken = token;
}

export function getAuthToken(): string | null {
  return currentAuthToken;
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// Helper to determine if a response is JSON
export async function parseJsonResponse(res: Response) {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('Not a JSON response (Static Server / Firebase Hosting)');
  }
  return res.json();
}

export function stripUndefinedValues<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedValues(item)) as T;
  }

  if (value && typeof value === 'object') {
    const cleaned: Record<string, any> = {};
    Object.entries(value as Record<string, any>).forEach(([key, item]) => {
      if (typeof item !== 'undefined') {
        cleaned[key] = stripUndefinedValues(item);
      }
    });
    return cleaned as T;
  }

  return value;
}

export function toPublicStudentSummary(student: Student): PublicStudentSummary | null {
  if (student.status !== 'approved' || student.managerParticipation) return null;
  return {
    id: student.id,
    fullName: student.fullName,
    className: student.className,
    grade: student.grade,
    points: student.points,
    completedDates: student.completedDates,
  };
}

export async function syncPublicStudentSummaries(students: Student[]): Promise<void> {
  const collectionRef = collection(db, 'publicStudents');
  const existing = await getDocs(collectionRef);
  const summaries = students
    .map(toPublicStudentSummary)
    .filter((summary): summary is PublicStudentSummary => summary !== null);
  const activeIds = new Set(summaries.map((summary) => summary.id));
  const writes: Array<{ id: string; summary?: PublicStudentSummary }> = [
    ...summaries.map((summary) => ({ id: summary.id, summary })),
    ...existing.docs
      .filter((studentDoc) => !activeIds.has(studentDoc.id))
      .map((studentDoc) => ({ id: studentDoc.id })),
  ];

  for (let offset = 0; offset < writes.length; offset += 450) {
    const batch = writeBatch(db);
    writes.slice(offset, offset + 450).forEach(({ id, summary }) => {
      const summaryRef = doc(db, 'publicStudents', id);
      if (summary) batch.set(summaryRef, summary);
      else batch.delete(summaryRef);
    });
    await batch.commit();
  }
  invalidatePublicStudentSummariesCache();
}

let cachedPublicSummaries: { data: PublicStudentSummary[]; timestamp: number } | null = null;
let inFlightPublicSummariesPromise: Promise<PublicStudentSummary[]> | null = null;
const PUBLIC_SUMMARIES_CACHE_TTL_MS = 30_000;

export function invalidatePublicStudentSummariesCache(): void {
  cachedPublicSummaries = null;
  inFlightPublicSummariesPromise = null;
}

export async function fetchPublicStudentSummaries(forceRefresh: boolean = false): Promise<PublicStudentSummary[]> {
  const now = Date.now();
  if (!forceRefresh && cachedPublicSummaries && (now - cachedPublicSummaries.timestamp < PUBLIC_SUMMARIES_CACHE_TTL_MS)) {
    return cachedPublicSummaries.data;
  }

  if (!forceRefresh && inFlightPublicSummariesPromise) {
    return inFlightPublicSummariesPromise;
  }

  inFlightPublicSummariesPromise = (async () => {
    try {
      let snapshot = await getDocs(collection(db, 'publicStudents'));
      const firebaseUser = auth.currentUser;
      const email = firebaseUser?.email?.trim().toLowerCase();
      if (snapshot.empty && firebaseUser?.emailVerified && email) {
        const managerSnapshot = await getDocs(
          query(collection(db, 'managers'), where('email', '==', email))
        );
        if (!managerSnapshot.empty) {
          const studentsSnapshot = await getDocs(collection(db, 'students'));
          const students = studentsSnapshot.docs.map((studentDoc) => studentDoc.data() as Student);
          await syncPublicStudentSummaries(students);
          snapshot = await getDocs(collection(db, 'publicStudents'));
        }
      }

      const data = snapshot.docs.map((studentDoc) => studentDoc.data() as PublicStudentSummary);
      cachedPublicSummaries = { data, timestamp: Date.now() };
      return data;
    } finally {
      inFlightPublicSummariesPromise = null;
    }
  })();

  return inFlightPublicSummariesPromise;
}

export async function fetchAdvanceQuizDates(today: string): Promise<string[]> {
  const availability = await getDocs(query(
    collection(db, 'quizAvailability'),
    where('availableOn', '==', today)
  ));
  return availability.docs
    .map((document) => document.data() as QuizAvailability)
    .filter((entry) => entry.availableOn === today && entry.date > today)
    .map((entry) => entry.date);
}

export async function syncAdvanceQuizAvailability(): Promise<void> {
  const firebaseUser = auth.currentUser;
  if (!firebaseUser?.emailVerified) {
    throw new Error('נדרשת התחברות מנהלת מאומתת לעדכון לוח החידונים');
  }

  const availability = getUpcomingQuizAvailability();
  for (let offset = 0; offset < availability.length; offset += 450) {
    const batch = writeBatch(db);
    availability.slice(offset, offset + 450).forEach((entry) => {
      batch.set(doc(db, 'quizAvailability', entry.date), entry);
    });
    await batch.commit();
  }
}
