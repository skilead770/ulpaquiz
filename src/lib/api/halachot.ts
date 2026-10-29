import {
  collection,
  getDocs,
  getDoc,
  query,
  where,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  limit,
  orderBy,
} from 'firebase/firestore';
import { auth, db } from '../firebaseClient';
import { API_BASE_URL } from '../config';
import { getTodayInJerusalem, isQuizDateAvailable } from '../quizSchedule';
import {
  Student,
  DailyHalacha,
  PrizeMilestone,
  QuizSubmission,
} from '../../types';
import { INITIAL_HALACHOT } from '../../data/seedData';
import {
  getAuthHeaders,
  parseJsonResponse,
  toPublicStudentSummary,
  invalidatePublicStudentSummariesCache,
} from './core';
import { getPrizeMilestones } from './prizes';

export async function getOrSeedFirestoreHalachot(): Promise<DailyHalacha[]> {
  try {
    const snap = await getDocs(collection(db, 'halachot'));
    if (!snap.empty) {
      const list: DailyHalacha[] = [];
      snap.forEach((d) => list.push(d.data() as DailyHalacha));
      return list;
    }
    // Seed initial halachot to Firestore
    for (const halacha of INITIAL_HALACHOT) {
      await setDoc(doc(db, 'halachot', halacha.id), halacha);
    }
    return INITIAL_HALACHOT;
  } catch (err) {
    console.warn('[Firestore Fallback] Error fetching halachot from Firestore:', err);
    return INITIAL_HALACHOT;
  }
}

export async function fetchHalachot(dates?: string[]): Promise<DailyHalacha[]> {
  try {
    if (dates && dates.length > 0) {
      const results: DailyHalacha[] = [];
      for (let i = 0; i < dates.length; i += 30) {
        const chunk = dates.slice(i, i + 30);
        const q = query(collection(db, 'halachot'), where('date', 'in', chunk));
        const snap = await getDocs(q);
        snap.forEach((d) => results.push(d.data() as DailyHalacha));
      }
      if (results.length > 0) {
        return results;
      }
    } else {
      const snap = await getDocs(collection(db, 'halachot'));
      if (!snap.empty) {
        const list: DailyHalacha[] = [];
        snap.forEach((d) => list.push(d.data() as DailyHalacha));
        return list;
      }
    }
  } catch (e) {
    console.info('[Firestore] Direct halacha read failed, falling back to API:', e);
  }

  try {
    const res = await fetch(API_BASE_URL + '/api/halachot');
    if (res.ok) {
      const data = await parseJsonResponse(res);
      if (dates && dates.length > 0 && Array.isArray(data)) {
        return data.filter((h: DailyHalacha) => dates.includes(h.date));
      }
      return data;
    }
  } catch (e) {
    console.info('[API] Falling back to seeded Firestore for fetchHalachot');
  }
  const seeded = await getOrSeedFirestoreHalachot();
  if (dates && dates.length > 0) {
    return seeded.filter((h) => dates.includes(h.date));
  }
  return seeded;
}

export async function fetchHalachaByDate(date: string): Promise<DailyHalacha> {
  try {
    const snap = await getDocs(query(collection(db, 'halachot'), where('date', '==', date), limit(1)));
    if (!snap.empty) {
      return snap.docs[0].data() as DailyHalacha;
    }
  } catch (e) {
    console.info('[Firestore] Direct halacha-by-date read failed, falling back to API:', e);
  }

  try {
    const res = await fetch(API_BASE_URL + `/api/halachot/${date}`);
    if (res.ok) {
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Falling back to seeded Firestore for fetchHalachaByDate');
  }
  const halachot = await getOrSeedFirestoreHalachot();
  const found = halachot.find((h) => h.date === date);
  if (!found) {
    if (halachot.length > 0) return halachot[0];
    throw new Error('הלכה לא נמצאה לתאריך זה');
  }
  return found;
}

export async function submitQuizApi(
  studentId: string,
  date: string,
  answers: Record<string, number>,
  confirmedStudy: boolean = false
) {
  const todayDate = getTodayInJerusalem();
  if (!isQuizDateAvailable(todayDate, date)) {
    throw new Error('אפשר להשלים מראש רק חידונים לתאריכים שחלים בשבת או בחג');
  }
  const firebaseUser = auth.currentUser;
  if (!firebaseUser?.emailVerified) {
    throw new Error('להגשת החידון יש להתחבר תחילה באמצעות Google SSO');
  }

  if (date !== todayDate) {
    const availabilitySnapshot = await getDoc(doc(db, 'quizAvailability', date));
    if (
      !availabilitySnapshot.exists() ||
      availabilitySnapshot.data().availableOn !== todayDate
    ) {
      throw new Error('החידון לתאריך זה אינו זמין להגשה מראש');
    }
  }

  // Firestore-first write path for the scoring workflow.
  try {
    const halachaSnap = await getDocs(query(collection(db, 'halachot'), where('date', '==', date), limit(1)));
    if (halachaSnap.empty) {
      throw new Error('הלכה לא נמצאה לתאריך זה');
    }
    const halacha = halachaSnap.docs[0].data() as DailyHalacha;
    if (halacha.quizEnabled === false) {
      throw new Error('המנהלת השביתה את החידון לתאריך זה');
    }

    const studentRef = doc(db, 'students', studentId);
    const studentSnap = await getDoc(studentRef);
    if (!studentSnap.exists()) {
      throw new Error('תלמידה לא נמצאה');
    }

    const student = { ...(studentSnap.data() as Student) };
    if (student.completedDates.includes(date)) {
      throw new Error('כבר הגשת את החידון היומי להיום!');
    }

    let correctCount = 0;
    halacha.questions.forEach((q) => {
      const selectedOption = answers[q.id];
      if (selectedOption !== undefined && Number(selectedOption) === q.correctOptionIndex) {
        correctCount++;
      }
    });

    const isPerfect = correctCount === 4;
    const studyPoints = confirmedStudy ? 5 : 0;
    const questionPoints = correctCount * 5;
    const bonusPoints = 0;
    const earnedPoints = studyPoints + questionPoints + bonusPoints;
    const previousPoints = student.points;
    const newPoints = previousPoints + earnedPoints;
    const submissionTime = new Date().toLocaleTimeString('he-IL', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const submission: QuizSubmission = {
      date,
      halachaId: halacha.id,
      score: correctCount,
      earnedPoints,
      submittedAt: submissionTime,
      answers,
      ...(confirmedStudy ? { confirmedStudy: true } : {}),
    };

    student.points = newPoints;
    student.completedDates = [...student.completedDates, date];
    student.submissions = {
      ...student.submissions,
      [date]: submission,
    };

    const batch = writeBatch(db);
    batch.update(studentRef, {
      points: student.points,
      completedDates: student.completedDates,
      [`submissions.${date}`]: submission,
    });
    const publicSummary = toPublicStudentSummary(student);
    if (publicSummary) {
      batch.set(doc(db, 'publicStudents', student.id), publicSummary);
    }
    await batch.commit();
    invalidatePublicStudentSummariesCache();

    const currentMilestones = await getPrizeMilestones();
    const milestonesReached: PrizeMilestone[] = [];
    currentMilestones.forEach((m) => {
      if (previousPoints < m.points && newPoints >= m.points) {
        milestonesReached.push(m);
      }
    });

    return {
      success: true,
      score: correctCount,
      earnedPoints,
      isPerfect,
      previousPoints,
      newPoints,
      student,
      milestonesReached,
      message: isPerfect
        ? `אלופה! ענית נכון על כל 4 השאלות וצברת ${earnedPoints} נקודות!`
        : `כל הכבוד על ההשתתפות! צברת ${earnedPoints} נקודות לימוד לך, לכיתה ולשכבה!`,
    };
  } catch (firestoreErr) {
    console.error('[Firestore] Quiz submission failed:', firestoreErr);
    throw firestoreErr;
  }
}

export async function saveHalachaApi(halacha: DailyHalacha) {
  try {
    const res = await fetch(API_BASE_URL + '/api/halachot', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(halacha),
    });
    if (res.ok) {
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Falling back to direct Firestore for saveHalachaApi');
  }

  await setDoc(doc(db, 'halachot', halacha.id), halacha);
  const allHalachot = await getOrSeedFirestoreHalachot();
  return { success: true, halacha, halachot: allHalachot };
}

export async function deleteHalachaApi(id: string) {
  try {
    const res = await fetch(API_BASE_URL + `/api/halachot/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Falling back to direct Firestore for deleteHalachaApi');
  }

  await deleteDoc(doc(db, 'halachot', id));
  const allHalachot = await getOrSeedFirestoreHalachot();
  return { success: true, halachot: allHalachot };
}

export async function bulkImportHalachotApi(halachot: Partial<DailyHalacha>[], replaceAll = false) {
  try {
    const res = await fetch(API_BASE_URL + '/api/admin/bulk-import-halachot', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ halachot, replaceAll }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.info('[API] Backend unavailable, writing directly to Firestore via writeBatch');
  }

  // Direct Firestore batch upload in chunks of 400 (under the 500 operation limit)
  let addedCount = 0;
  let updatedCount = 0;
  const chunkSize = 400;
  for (let i = 0; i < halachot.length; i += chunkSize) {
    const chunk = halachot.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const item of chunk) {
      if (!item.id || !item.date) continue;
      const ref = doc(db, 'halachot', item.id);
      batch.set(ref, item, { merge: true });
      addedCount++;
    }
    await batch.commit();
  }
  return { success: true, addedCount, updatedCount };
}

export async function parseDocContentApi(data: ArrayBuffer | Uint8Array | string) {
  const headers = getAuthHeaders();
  headers['Content-Type'] = 'application/octet-stream';
  const res = await fetch(API_BASE_URL + '/api/admin/parse-doc-content', {
    method: 'POST',
    headers,
    body: data,
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'שגיאה בפענוח תוכן המסמך');
  }
  return res.json();
}

export async function generateAiHalachaApi(topic: string, date: string, hebrewDate?: string, rawContent?: string) {
  const res = await fetch(API_BASE_URL + '/api/admin/generate-ai-halacha', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ topic, date, hebrewDate, rawContent }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'נכשלה יצירת ההלכה (דורש שרת AI פעיל)');
  }
  return res.json();
}

export async function fetchUpcomingHalachotApi(
  startDate: string,
  limitCount = 60
): Promise<DailyHalacha[]> {
  try {
    const q = query(
      collection(db, 'halachot'),
      where('date', '>=', startDate),
      orderBy('date', 'asc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const list: DailyHalacha[] = [];
      snap.forEach((d) => list.push(d.data() as DailyHalacha));
      return list;
    }
  } catch (err) {
    console.warn('[Firestore] Direct upcoming halachot query failed, falling back:', err);
  }

  const all = await fetchHalachot();
  const future = all
    .filter((h) => h.date >= startDate)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (future.length > 0) {
    return future.slice(0, limitCount);
  }
  return all.sort((a, b) => a.date.localeCompare(b.date)).slice(0, limitCount);
}
