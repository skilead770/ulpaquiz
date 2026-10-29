import {
  collection,
  getDocs,
  getDoc,
  onSnapshot,
  query,
  where,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  runTransaction,
  writeBatch,
  deleteField,
  limit,
  orderBy,
} from 'firebase/firestore';
import { auth, db } from './firebaseClient';
import {
  getTodayInJerusalem,
  getUpcomingQuizAvailability,
  isQuizDateAvailable,
} from './quizSchedule';
import { SUPER_ADMIN_EMAIL, API_BASE_URL } from './config';
import {
  Student,
  DailyHalacha,
  LeaderboardData,
  PrizeReportItem,
  PrizeMilestone,
  ClassLeaderboardItem,
  GradeLeaderboardItem,
  StudentLeaderboardItem,
  GradeType,
  QuizSubmission,
  QuizAvailability,
  Invitation,
  Manager,
  PublicStudentSummary,
  DEFAULT_CLASSES,
  inferGradeFromClass,
  sortClasses,
  getStudentRegistrationDocumentId,
  CustomCalendarAnnotation,
  CalendarAnnotationsMap,
  QuestionSuggestion,
  QuestionFeedback,
  QuestionFeedbackType,
} from '../types';
import { DEFAULT_SCHOOLS } from '../types/tenant';
import {
  INITIAL_STUDENTS,
  INITIAL_HALACHOT,
  INITIAL_INVITATIONS,
  INITIAL_MANAGERS,
  DEFAULT_PRIZE_MILESTONES,
} from '../data/seedData';
import { validateGmailAddress } from './gmailValidator';

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
async function parseJsonResponse(res: Response) {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('Not a JSON response (Static Server / Firebase Hosting)');
  }
  return res.json();
}

async function fetchAllStudentRecords(schoolId?: string): Promise<Student[]> {
  const snap = await getDocs(collection(db, 'students'));
  const all = snap.docs.map((studentDoc) => studentDoc.data() as Student);
  if (!schoolId) return all;
  return all.filter((s) => (s.schoolId || 'shvut-rachel') === schoolId);
}

function toPublicStudentSummary(student: Student): PublicStudentSummary | null {
  if (student.status !== 'approved' || student.managerParticipation) return null;
  return {
    id: student.id,
    fullName: student.fullName,
    className: student.className,
    grade: student.grade,
    points: student.points,
    completedDates: student.completedDates,
    schoolId: student.schoolId || 'shvut-rachel',
  };
}

async function writeStudentAndPublicSummary(student: Student): Promise<void> {
  const normalized: Student = {
    ...student,
    schoolId: student.schoolId || 'shvut-rachel',
  };
  const batch = writeBatch(db);
  batch.set(doc(db, 'students', normalized.id), stripUndefinedValues(normalized));
  const publicSummary = toPublicStudentSummary(normalized);
  const publicRef = doc(db, 'publicStudents', normalized.id);
  if (publicSummary) {
    batch.set(publicRef, publicSummary);
  } else {
    batch.delete(publicRef);
  }
  await batch.commit();
  invalidatePublicStudentSummariesCache();
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

async function approveStudentAndPublicSummary(student: Student): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'students', student.id), { status: 'approved' });
  const publicSummary = toPublicStudentSummary({ ...student, status: 'approved' });
  if (publicSummary) {
    batch.set(doc(db, 'publicStudents', student.id), publicSummary);
  }
  await batch.commit();
  invalidatePublicStudentSummariesCache();
}

async function syncPublicStudentSummaries(students: Student[]): Promise<void> {
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

async function fetchPublicStudentSummaries(forceRefresh: boolean = false, schoolId?: string): Promise<PublicStudentSummary[]> {
  const now = Date.now();
  let summaries: PublicStudentSummary[];
  if (!forceRefresh && cachedPublicSummaries && (now - cachedPublicSummaries.timestamp < PUBLIC_SUMMARIES_CACHE_TTL_MS)) {
    summaries = cachedPublicSummaries.data;
  } else if (!forceRefresh && inFlightPublicSummariesPromise) {
    summaries = await inFlightPublicSummariesPromise;
  } else {
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
    summaries = await inFlightPublicSummariesPromise;
  }

  if (schoolId) {
    return summaries.filter((s) => (s.schoolId || 'shvut-rachel') === schoolId);
  }
  return summaries;
}

async function getOrSeedFirestoreHalachot(): Promise<DailyHalacha[]> {
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

function stripUndefinedValues<T>(value: T): T {
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

export async function fetchStudents(schoolId?: string): Promise<Student[]> {
  const firebaseUser = auth.currentUser;
  const email = firebaseUser?.email?.trim().toLowerCase();
  if (!firebaseUser?.emailVerified || !email) {
    throw new Error('נדרשת התחברות מאומתת כדי לטעון את רשימת התלמידים');
  }

  const matchesSchool = (student: Student) => {
    if (!schoolId) return true;
    return (student.schoolId || 'shvut-rachel') === schoolId;
  };

  try {
    const isSuperAdminEmail = SUPER_ADMIN_EMAIL && email === SUPER_ADMIN_EMAIL.toLowerCase();
    const safeDocId = email.replace(/[^a-zA-Z0-9_]/g, '_');
    const [directDocSnap, managerSnap] = await Promise.all([
      getDoc(doc(db, 'managers', safeDocId)).catch(() => null),
      getDocs(query(collection(db, 'managers'), where('email', '==', email))).catch(() => null),
    ]);

    let isManager = isSuperAdminEmail || (directDocSnap && directDocSnap.exists()) || (managerSnap && !managerSnap.empty);

    if (!isManager) {
      try {
        const schoolsSnap = await getDocs(collection(db, 'schools'));
        isManager = schoolsSnap.docs.some((d) => {
          const data = d.data() as { adminEmails?: string[] };
          return Array.isArray(data.adminEmails) && data.adminEmails.some((e) => e.trim().toLowerCase() === email);
        });
      } catch {
        // ignore
      }
    }

    if (isManager) {
      const snap = await getDocs(collection(db, 'students'));
      return snap.docs
        .map((studentDoc) => studentDoc.data() as Student)
        .filter((student) => !student.managerParticipation && matchesSchool(student));
    }

    const snap = await getDocs(query(collection(db, 'students'), where('email', '==', email)));
    return snap.docs
      .map((studentDoc) => studentDoc.data() as Student)
      .filter((student) => !student.managerParticipation && matchesSchool(student));
  } catch (e) {
    console.info('[Firestore] Direct student read failed, falling back to API:', e);
  }

  const res = await fetch(API_BASE_URL + '/api/students' + (schoolId ? `?schoolId=${encodeURIComponent(schoolId)}` : ''), {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'לא ניתן לטעון את רשימת התלמידים');
  }
  const students = await parseJsonResponse(res) as Student[];
  return students.filter((student) => !student.managerParticipation && matchesSchool(student));
}

export async function getOrCreateManagerParticipant(): Promise<Student> {
  const firebaseUser = auth.currentUser;
  const email = firebaseUser?.email?.trim().toLowerCase();
  if (!firebaseUser?.emailVerified || !email) {
    throw new Error('יש להתחבר באמצעות חשבון Google מאומת כדי להשתתף בחידון');
  }

  const isSuperAdminEmail = SUPER_ADMIN_EMAIL && email === SUPER_ADMIN_EMAIL.toLowerCase();
  const safeDocId = email.replace(/[^a-zA-Z0-9_]/g, '_');
  const [directDocSnap, managerSnapshot] = await Promise.all([
    getDoc(doc(db, 'managers', safeDocId)).catch(() => null),
    getDocs(query(collection(db, 'managers'), where('email', '==', email))).catch(() => null),
  ]);

  let manager: Manager | null = null;
  if (directDocSnap && directDocSnap.exists()) {
    manager = directDocSnap.data() as Manager;
  } else if (managerSnapshot && !managerSnapshot.empty) {
    manager = managerSnapshot.docs[0].data() as Manager;
  } else if (isSuperAdminEmail) {
    manager = {
      email,
      name: firebaseUser.displayName || 'Super Admin',
      role: 'superadmin',
      addedAt: new Date().toISOString(),
      schoolIds: ['all'],
    };
  }

  if (!manager) {
    throw new Error('ההשתתפות בחידון זמינה למנהלות בלבד');
  }
  let hash = 2166136261;
  for (let index = 0; index < email.length; index += 1) {
    hash = Math.imul(hash ^ email.charCodeAt(index), 16777619);
  }
  const participantId = `manager_${(hash >>> 0).toString(16)}`;
  const participantRef = doc(db, 'students', participantId);

  return runTransaction(db, async (transaction) => {
    const participantSnapshot = await transaction.get(participantRef);
    if (participantSnapshot.exists()) {
      const participant = participantSnapshot.data() as Student;
      if (!participant.managerParticipation || participant.email !== email) {
        throw new Error('לא ניתן לאמת את פרופיל ההשתתפות של המנהלת');
      }
      return participant;
    }

    const participant: Student = {
      id: participantId,
      fullName: manager.name || firebaseUser.displayName || email.split('@')[0],
      className: 'צוות מנהלות',
      grade: 'יב',
      username: participantId,
      email,
      points: 0,
      completedDates: [],
      submissions: {},
      status: 'approved',
      managerParticipation: true,
    };
    transaction.set(participantRef, participant);
    return participant;
  }, { maxAttempts: 1 });
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

export async function fetchLeaderboardApi(date: string, schoolId: string = 'shvut-rachel'): Promise<LeaderboardData> {
  try {
    const res = await fetch(API_BASE_URL + `/api/leaderboard?date=${date}&schoolId=${encodeURIComponent(schoolId)}`);
    if (res.ok) {
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Falling back to direct Firestore for fetchLeaderboardApi');
  }

  const students = await fetchPublicStudentSummaries(false, schoolId);
  const activeStudents = students.filter(
    (student) => student.id && student.fullName && student.className
  );

  // 1. Top students
  const studentItems: StudentLeaderboardItem[] = activeStudents.map((s) => ({
    id: s.id,
    fullName: s.fullName,
    className: s.className,
    grade: s.grade,
    points: s.points,
    completedToday: s.completedDates.includes(date),
  }));

  studentItems.sort((a, b) => b.points - a.points);
  const maxStudentPoints = studentItems.length > 0 ? studentItems[0].points : 0;
  const leadingStudents = studentItems.filter(
    (s) => s.points === maxStudentPoints && maxStudentPoints > 0
  );
  leadingStudents.forEach((s) => (s.isLeading = true));

  // 2. Class League
  const classMap: Record<
    string,
    { grade: GradeType; totalPoints: number; count: number; completedToday: number }
  > = {};

  activeStudents.forEach((s) => {
    if (!classMap[s.className]) {
      classMap[s.className] = {
        grade: s.grade,
        totalPoints: 0,
        count: 0,
        completedToday: 0,
      };
    }
    classMap[s.className].totalPoints += s.points;
    classMap[s.className].count += 1;
    if (s.completedDates.includes(date)) {
      classMap[s.className].completedToday += 1;
    }
  });

  const classLeague: ClassLeaderboardItem[] = Object.keys(classMap).map((clsName) => ({
    className: clsName,
    grade: classMap[clsName].grade,
    totalPoints: classMap[clsName].totalPoints,
    studentCount: classMap[clsName].count,
    completedTodayCount: classMap[clsName].completedToday,
  }));

  classLeague.sort((a, b) => b.totalPoints - a.totalPoints);
  const maxClassPoints = classLeague.length > 0 ? classLeague[0].totalPoints : 0;
  const leadingClasses = classLeague.filter(
    (c) => c.totalPoints === maxClassPoints && maxClassPoints > 0
  );
  leadingClasses.forEach((c) => (c.isLeading = true));

  // 3. Grade League
  const gradeMap: Record<
    GradeType,
    { totalPoints: number; count: number; completedToday: number }
  > = {
    'ט': { totalPoints: 0, count: 0, completedToday: 0 },
    'י': { totalPoints: 0, count: 0, completedToday: 0 },
    'יא': { totalPoints: 0, count: 0, completedToday: 0 },
    'יב': { totalPoints: 0, count: 0, completedToday: 0 },
  };

  activeStudents.forEach((s) => {
    if (gradeMap[s.grade]) {
      gradeMap[s.grade].totalPoints += s.points;
      gradeMap[s.grade].count += 1;
      if (s.completedDates.includes(date)) {
        gradeMap[s.grade].completedToday += 1;
      }
    }
  });

  const gradeLeague: GradeLeaderboardItem[] = (['ט', 'י', 'יא', 'יב'] as GradeType[]).map((g) => ({
    grade: g,
    totalPoints: gradeMap[g].totalPoints,
    studentCount: gradeMap[g].count,
    completedTodayCount: gradeMap[g].completedToday,
  }));

  gradeLeague.sort((a, b) => b.totalPoints - a.totalPoints);
  const maxGradePoints = gradeLeague.length > 0 ? gradeLeague[0].totalPoints : 0;
  const leadingGrades = gradeLeague.filter(
    (g) => g.totalPoints === maxGradePoints && maxGradePoints > 0
  );
  leadingGrades.forEach((g) => (g.isLeading = true));

  return {
    topStudents: studentItems,
    classLeague,
    gradeLeague,
    leadingStudents,
    leadingClasses,
    leadingGrades,
  };
}

let cachedPrizeMilestones: PrizeMilestone[] | null = null;

export function invalidatePrizeMilestonesCache(): void {
  cachedPrizeMilestones = null;
}

export async function getPrizeMilestones(forceRefresh: boolean = false, schoolId: string = 'shvut-rachel'): Promise<PrizeMilestone[]> {
  try {
    if (schoolId !== 'shvut-rachel') {
      const schoolSnap = await getDoc(doc(db, 'schools', schoolId));
      if (schoolSnap.exists()) {
        const sData = schoolSnap.data();
        if (Array.isArray(sData.prizeMilestones) && sData.prizeMilestones.length > 0) {
          return [...sData.prizeMilestones].sort((a, b) => a.points - b.points);
        }
      }
    }
    const settingsSnap = await getDoc(doc(db, 'settings', 'prizeMilestones'));
    if (settingsSnap.exists()) {
      const data = settingsSnap.data() as { milestones?: PrizeMilestone[] };
      if (Array.isArray(data.milestones) && data.milestones.length > 0) {
        return [...data.milestones].sort((a, b) => a.points - b.points);
      }
    }
  } catch (err) {
    console.info('[Firestore] Prize milestone read failed, falling back to defaults:', err);
  }

  return [...DEFAULT_PRIZE_MILESTONES].sort((a, b) => a.points - b.points);
}

export async function savePrizeMilestonesApi(milestones: PrizeMilestone[], schoolId: string = 'shvut-rachel'): Promise<PrizeMilestone[]> {
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

  if (schoolId !== 'shvut-rachel') {
    await updateDoc(doc(db, 'schools', schoolId), {
      prizeMilestones: normalized,
    });
  } else {
    await setDoc(doc(db, 'settings', 'prizeMilestones'), {
      milestones: normalized,
      updatedAt: new Date().toISOString(),
    });
  }

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

export async function fetchPrizesApi(schoolId: string = 'shvut-rachel'): Promise<{
  reports: PrizeReportItem[];
  milestones: PrizeMilestone[];
}> {
  try {
    const milestones = await getPrizeMilestones(false, schoolId);
    const activeStudents = await fetchPublicStudentSummaries(false, schoolId);

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

export async function bulkImportStudentsApi(students: Partial<Student>[], schoolId: string = 'shvut-rachel') {
  try {
    const res = await fetch(API_BASE_URL + '/api/students/bulk-import', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ students, schoolId }),
    });
    if (res.ok) {
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Falling back to direct Firestore for bulkImportStudentsApi');
  }

  const imported: Student[] = students.map((s, idx) => ({
    id: s.id || `s-imp-${Date.now()}-${idx}`,
    fullName: s.fullName || 'תלמיד/ה',
    className: s.className || "ט'1",
    grade: (s.grade as GradeType) || 'ט',
    username: s.username || `user_${Date.now()}_${idx}`,
    points: Number(s.points) || 0,
    completedDates: Array.isArray(s.completedDates) ? s.completedDates : [],
    submissions: s.submissions || {},
    status: s.status || 'approved',
    schoolId: s.schoolId || schoolId,
  }));

  for (const st of imported) {
    await writeStudentAndPublicSummary(st);
  }

  const allStudents = await fetchAllStudentRecords(schoolId);
  return { success: true, count: imported.length, students: allStudents };
}

export async function addStudentApi(student: Partial<Student>, schoolId: string = 'shvut-rachel') {
  try {
    const res = await fetch(API_BASE_URL + '/api/students', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ ...student, schoolId: student.schoolId || schoolId }),
    });
    if (res.ok) {
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Falling back to direct Firestore for addStudentApi');
  }

  const targetSchoolId = student.schoolId || schoolId;
  const allStudents = await fetchAllStudentRecords(targetSchoolId);
  const existingIdx = allStudents.findIndex((s) => s.id === student.id);
  let targetStudent: Student;

  if (existingIdx >= 0) {
    targetStudent = {
      ...allStudents[existingIdx],
      ...student,
      schoolId: targetSchoolId,
      points: typeof student.points === 'number' ? student.points : allStudents[existingIdx].points,
    } as Student;
  } else {
    targetStudent = {
      id: student.id || `s-${Date.now()}`,
      fullName: student.fullName || '',
      className: student.className || '',
      grade: (student.grade as GradeType) || 'ט',
      username: student.username || '',
      email: student.email || '',
      points: student.points || 0,
      completedDates: [],
      submissions: {},
      status: student.status || 'approved',
      schoolId: targetSchoolId,
    };
  }

  const sanitizedStudent = stripUndefinedValues(targetStudent) as Student;
  await writeStudentAndPublicSummary(sanitizedStudent);
  const updatedStudents = await fetchAllStudentRecords(targetSchoolId);
  return { success: true, student: targetStudent, students: updatedStudents };
}

export async function deleteStudentApi(id: string, schoolId?: string) {
  let firestoreError: unknown;
  try {
    const res = await fetch(`${API_BASE_URL}/api/students/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      return await parseJsonResponse(res);
    }
    if (contentType.includes('application/json')) {
      const data = await res.json().catch(() => ({}));
      if (res.status !== 404) {
        throw new Error(data.error || `שגיאה במחיקת התלמיד/ה (${res.status})`);
      }
    }
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
  }

  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'students', id));
    batch.delete(doc(db, 'publicStudents', id));
    await batch.commit();
    invalidatePublicStudentSummariesCache();
    const allStudents = await fetchAllStudentRecords(schoolId);
    return { success: true, students: allStudents };
  } catch (error) {
    firestoreError = error;
  }

  throw firestoreError instanceof Error
    ? firestoreError
    : new Error('לא ניתן למחוק את בקשת התלמיד/ה. יש לבדוק את ההרשאות ולנסות שוב.');
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

export async function fetchInvitationsApi(schoolId: string = 'shvut-rachel'): Promise<Invitation[]> {
  try {
    const snap = await getDocs(collection(db, 'invitations'));
    if (!snap.empty) {
      const list: Invitation[] = [];
      snap.forEach((d) => {
        const inv = d.data() as Invitation;
        if ((inv.schoolId || 'shvut-rachel') === schoolId) {
          list.push(inv);
        }
      });
      return list;
    }
    if (schoolId === 'shvut-rachel') {
      for (const inv of INITIAL_INVITATIONS) {
        await setDoc(doc(db, 'invitations', inv.id), { ...inv, schoolId: 'shvut-rachel' });
      }
      return INITIAL_INVITATIONS;
    }
    return [];
  } catch (err) {
    console.warn('[Firestore Fallback] Error fetching invitations:', err);
  }

  try {
    const res = await fetch(`/api/invitations?schoolId=${encodeURIComponent(schoolId)}`, {
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const all = await parseJsonResponse(res) as Invitation[];
      return all.filter((i) => (i.schoolId || 'shvut-rachel') === schoolId);
    }
  } catch (e) {
    console.info('[API] Falling back to seeded Firestore for fetchInvitationsApi');
  }

  return schoolId === 'shvut-rachel' ? INITIAL_INVITATIONS : [];
}

export async function createInvitationApi(invitationData: {
  className: string;
  grade: GradeType;
  maxUses: number;
  code: string;
  schoolId?: string;
}) {
  const cleanCode = invitationData.code.trim().toUpperCase();
  const cleanClass = invitationData.className.trim();
  const maxUses = Number(invitationData.maxUses) || 50;
  const schoolId = invitationData.schoolId || 'shvut-rachel';

  try {
    const snap = await getDocs(collection(db, 'invitations'));
    const duplicate = snap.docs.find((d) => {
      const item = d.data() as Invitation;
      return item.code.trim().toUpperCase() === cleanCode;
    });

    if (duplicate) {
      throw new Error('קוד הזמנה זה כבר קיים במערכת');
    }

    const inv: Invitation = {
      id: `inv-${Date.now()}`,
      code: cleanCode,
      className: cleanClass,
      grade: invitationData.grade,
      maxUses,
      usedCount: 0,
      createdAt: new Date().toISOString().split('T')[0],
      active: true,
      schoolId,
    };

    await setDoc(doc(db, 'invitations', inv.id), inv);
    const invitations = await fetchInvitationsApi(schoolId);
    return { success: true, invitation: inv, invitations };
  } catch (e: any) {
    if (e.message && e.message.includes('כבר קיים')) {
      throw e;
    }
    console.info('[Firestore] Direct invitation creation failed, trying legacy API:', e);
  }

  try {
    const res = await fetch('/api/invitations', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ ...invitationData, schoolId }),
    });
    if (res.ok) {
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Falling back to seeded Firestore for createInvitationApi');
  }

  const inv: Invitation = {
    id: `inv-${Date.now()}`,
    code: cleanCode,
    className: cleanClass,
    grade: invitationData.grade,
    maxUses,
    usedCount: 0,
    createdAt: new Date().toISOString().split('T')[0],
    active: true,
    schoolId,
  };

  await setDoc(doc(db, 'invitations', inv.id), inv);
  const invitations = await fetchInvitationsApi(schoolId);
  return { success: true, invitation: inv, invitations };
}

export async function deleteInvitationApi(id: string, schoolId: string = 'shvut-rachel') {
  try {
    await deleteDoc(doc(db, 'invitations', id));
    const invitations = await fetchInvitationsApi(schoolId);
    return { success: true, invitations };
  } catch (e) {
    console.info('[Firestore] Direct invitation delete failed, trying legacy API:', e);
  }

  try {
    const res = await fetch(`/api/invitations/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Falling back to seeded Firestore for deleteInvitationApi');
  }

  const invitations = await fetchInvitationsApi(schoolId);
  return { success: true, invitations };
}

export async function validateInvitationCodeApi(
  code: string,
  schoolId?: string
): Promise<{ valid: boolean; invitation?: Invitation; error?: string }> {
  try {
    const cleanCode = code.trim().toUpperCase();
    const snap = await getDocs(collection(db, 'invitations'));
    const all = snap.docs.map((d) => d.data() as Invitation);
    const inv = all.find((i) => {
      if (i.code.trim().toUpperCase() !== cleanCode || !i.active) return false;
      if (schoolId && (i.schoolId || 'shvut-rachel') !== schoolId) return false;
      return true;
    });

    if (!inv) {
      return { valid: false, error: 'קוד הזמנה לא קיים או שאינו פעיל' };
    }
    if (inv.maxUses > 0 && inv.usedCount >= inv.maxUses) {
      return { valid: false, error: 'קוד ההזמנה הגיע למכסת השימושים המרבית' };
    }
    return { valid: true, invitation: inv };
  } catch (e) {
    console.info('[Firestore] Direct invitation validation failed, trying legacy API:', e);
  }

  try {
    const res = await fetch(`/api/invitations/validate/${encodeURIComponent(code)}`);
    if (res.ok) {
      return await parseJsonResponse(res);
    } else {
      const data = await parseJsonResponse(res).catch(() => ({ valid: false }));
      return data;
    }
  } catch (e) {
    console.info('[API] Falling back to seeded Firestore for validateInvitationCodeApi');
  }

  return { valid: false, error: 'קוד הזמנה לא קיים או שאינו פעיל' };
}

export async function checkStudentStatusApi(email: string): Promise<{
  registered: boolean;
  status?: 'approved' | 'pending' | 'rejected';
  student?: Student;
}> {
  const cleanEmail = email.trim().toLowerCase();
  const currentEmail = auth.currentUser?.email?.trim().toLowerCase();
  if (currentEmail === cleanEmail && auth.currentUser?.emailVerified) {
    try {
      const q = query(collection(db, 'students'), where('email', '==', cleanEmail));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const student = snap.docs[0].data() as Student;
        return {
          registered: true,
          status: student.status || 'approved',
        };
      }
    } catch (e) {
      console.info('[Firestore] Own student status read failed, falling back to API:', e);
    }
  }

  try {
    const res = await fetch('/api/auth/check-status', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ email }),
    });
    if (res.ok) {
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Falling back to seeded Firestore for checkStudentStatusApi');
  }

  throw new Error('לא ניתן לבדוק את סטטוס ההרשמה כעת. התחבר/י לחשבון Google הרשום או נסו שוב מאוחר יותר.');
}

export async function registerStudentApi(studentData: {
  fullName: string;
  email?: string;
  grade?: string;
  className?: string;
  username?: string;
  password?: string;
  invitationCode?: string;
  schoolId?: string;
}): Promise<{
  success: boolean;
  status?: 'pending' | 'approved' | 'rejected';
  autoApproved?: boolean;
  isManager?: boolean;
  message: string;
  student?: Student;
}> {
  const rawInput = (studentData.email || studentData.username || '').trim();
  const gmailValidation = validateGmailAddress(rawInput);
  if (!gmailValidation.isValid || !gmailValidation.normalizedEmail) {
    throw new Error(gmailValidation.error || 'כתובת Gmail אינה תקינה');
  }
  const effectiveEmail = gmailValidation.normalizedEmail;
  const registrationDocId = getStudentRegistrationDocumentId(effectiveEmail);
  const baseUser = effectiveEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') || 'student';
  let targetSchoolId = studentData.schoolId || 'shvut-rachel';

  // Check if current user is logged in as this email
  const currentUser = auth.currentUser;
  const isCurrentUser = currentUser?.emailVerified && currentUser.email?.trim().toLowerCase() === effectiveEmail;

  if (isCurrentUser) {
    try {
      const existingSnap = await getDoc(doc(db, 'students', registrationDocId));
      if (existingSnap.exists()) {
        const existing = existingSnap.data() as Student;
        if (existing.status === 'approved') {
          return {
            success: true,
            status: 'approved',
            autoApproved: true,
            message: 'החשבון כבר אושר. יש להתחבר באמצעות חשבון Google הרשום במערכת.',
            student: existing,
          };
        }
        if (existing.status === 'pending') {
          return {
            success: true,
            status: 'pending',
            autoApproved: false,
            message: 'ההרשמה שלך כבר נקלטה וממתינה לאישור. לאחר האישור, יש להתחבר באמצעות חשבון Google הרשום במערכת.',
            student: existing,
          };
        }
        throw new Error('בקשת ההרשמה שלך נדחתה בעבר. נא לפנות להנהלה.');
      }
    } catch (e: any) {
      if (e.message && e.message.includes('נדחתה')) throw e;
    }
  }

  // Validate invitation code if provided
  let matchedInvitation: Invitation | undefined;
  if (studentData.invitationCode?.trim()) {
    try {
      const code = studentData.invitationCode.trim().toUpperCase();
      const invitationSnap = await getDocs(collection(db, 'invitations'));
      const invDoc = invitationSnap.docs.find((d) => {
        const item = d.data() as Invitation;
        return item.code.trim().toUpperCase() === code && item.active;
      });

      if (invDoc) {
        const item = invDoc.data() as Invitation;
        if (item.maxUses > 0 && item.usedCount >= item.maxUses) {
          throw new Error('קוד ההזמנה הגיע למכסת השימושים המרבית');
        }
        if (item.schoolId && studentData.schoolId && item.schoolId !== studentData.schoolId) {
          throw new Error('קוד ההזמנה אינו מתאים למוסד שנבחר');
        }
        if (item.schoolId) {
          targetSchoolId = item.schoolId;
        }
        matchedInvitation = item;
      } else {
        throw new Error('קוד הזמנה לא קיים או שאינו פעיל');
      }
    } catch (invErr: any) {
      if (invErr.message) throw invErr;
    }
  }

  const chosenClass = (studentData.className?.trim() || matchedInvitation?.className || DEFAULT_CLASSES[0]);
  const derivedGrade = inferGradeFromClass(chosenClass);
  const newStudent: Student = {
    id: registrationDocId,
    fullName: studentData.fullName.trim(),
    className: chosenClass,
    grade: derivedGrade,
    username: baseUser,
    email: effectiveEmail,
    points: 0,
    completedDates: [],
    submissions: {},
    status: 'pending',
    registeredAt: new Date().toISOString(),
    schoolId: targetSchoolId,
    ...(studentData.invitationCode?.trim()
      ? { invitationCode: studentData.invitationCode.trim().toUpperCase() }
      : {}),
  };

  try {
    await setDoc(doc(db, 'students', newStudent.id), newStudent);
    return {
      success: true,
      status: 'pending',
      autoApproved: false,
      message: 'בקשת ההרשמה נקלטה בהצלחה! היא ממתינה כעת לאישור ההנהלה. לאחר האישור, יש להתחבר באמצעות חשבון Google הרשום במערכת.',
      student: newStudent,
    };
  } catch (error: any) {
    console.info('[Registration] Direct Firestore registration attempt failed, trying fallback:', error);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...studentData, schoolId: targetSchoolId }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return await parseJsonResponse(res);
      }
    } catch {
      // Ignore static Hosting HTML fallback failure
    }

    throw new Error('לא ניתן להשלים את ההרשמה. ייתכן שכבר קיימת בקשה לכתובת זו; יש להתחבר באמצעות Google או לפנות להנהלה.');
  }
}

export async function approveStudentApi(id: string) {
  let firestoreError: unknown;
  try {
    const studentRef = doc(db, 'students', id);
    const studentSnap = await getDoc(studentRef);
    if (!studentSnap.exists()) throw new Error('תלמידה לא נמצאה');
    await approveStudentAndPublicSummary(studentSnap.data() as Student);
    return { success: true };
  } catch (e) {
    firestoreError = e;
    console.info('[Firestore] Direct approval failed, trying legacy API:', e);
  }

  try {
    const res = await fetch(`/api/students/${id}/approve`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      return await parseJsonResponse(res);
    }
    if (contentType.includes('application/json')) {
      const data = await res.json().catch(() => ({}));
      if (res.status !== 404) {
        throw new Error(data.error || `שגיאה באישור התלמידה (${res.status})`);
      }
    } else {
      console.info('[API] Approval endpoint did not return JSON; using the Firestore error instead.');
    }
  } catch (apiError) {
    if (!(apiError instanceof TypeError)) {
      throw apiError;
    }
  }

  throw firestoreError instanceof Error
    ? firestoreError
    : new Error('לא ניתן לאשר את התלמידה. בדקי את הרשאות Firestore ונסי שוב.');
}

export async function rejectStudentApi(id: string) {
  let firestoreError: unknown;
  try {
    const studentRef = doc(db, 'students', id);
    const studentSnap = await getDoc(studentRef);
    if (!studentSnap.exists()) throw new Error('תלמידה לא נמצאה');
    const batch = writeBatch(db);
    batch.update(studentRef, { status: 'rejected' });
    batch.delete(doc(db, 'publicStudents', id));
    await batch.commit();
    invalidatePublicStudentSummariesCache();
    return { success: true };
  } catch (e) {
    firestoreError = e;
    console.info('[Firestore] Direct rejection failed, trying legacy API:', e);
  }

  try {
    const res = await fetch(`/api/students/${id}/reject`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      invalidatePublicStudentSummariesCache();
      return await parseJsonResponse(res);
    }
    if (contentType.includes('application/json')) {
      const data = await res.json().catch(() => ({}));
      if (res.status !== 404) {
        throw new Error(data.error || `שגיאה בדחיית התלמידה (${res.status})`);
      }
    }
  } catch (apiError) {
    if (!(apiError instanceof TypeError)) {
      throw apiError;
    }
  }

  throw firestoreError instanceof Error
    ? firestoreError
    : new Error('לא ניתן לדחות את בקשת התלמידה. בדקי את הרשאות Firestore ונסי שוב.');
}

export async function resetStudentQuizSubmissionApi(
  studentId: string,
  date: string,
  schoolId?: string
): Promise<{ success: boolean; student: Student; students: Student[] }> {
  try {
    const studentRef = doc(db, 'students', studentId);

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(studentRef);
      if (!snap.exists()) {
        throw new Error('תלמיד/ה לא נמצא/ה');
      }
      const student = snap.data() as Student;
      const submission = student.submissions?.[date];

      if (!submission) {
        console.warn(`No submission found for student ${studentId} on date ${date} to reset.`);
        return;
      }

      const pointsToDeduct = submission.earnedPoints || 0;
      const newPoints = Math.max(0, (student.points || 0) - pointsToDeduct);
      const updatedCompletedDates = (student.completedDates || []).filter((d) => d !== date);

      transaction.update(studentRef, {
        points: newPoints,
        completedDates: updatedCompletedDates,
        [`submissions.${date}`]: deleteField(),
      });
      const publicSummary = toPublicStudentSummary({
        ...student,
        points: newPoints,
        completedDates: updatedCompletedDates,
      });
      if (publicSummary) {
        transaction.set(doc(db, 'publicStudents', studentId), publicSummary);
      }
    });

    invalidatePublicStudentSummariesCache();

    const updatedStudentSnap = await getDoc(studentRef);
    if (!updatedStudentSnap.exists()) {
      throw new Error('Failed to refetch student after reset.');
    }
    const updatedStudent = updatedStudentSnap.data() as Student;
    const allStudents = await fetchStudents(schoolId);

    return { success: true, student: updatedStudent, students: allStudents };
  } catch (firestoreErr: any) {
    console.info('[Firestore] Direct reset submission failed, falling back to API:', firestoreErr);
  }

  // Fallback to server API if direct Firestore write fails
  try {
    const res = await fetch(API_BASE_URL + `/api/students/${studentId}/reset-quiz`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ date }),
    });
    if (res.ok) {
      invalidatePublicStudentSummariesCache();
      return await parseJsonResponse(res);
    }
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'שגיאה באיפוס החידון מהשרת');
  } catch (apiErr: any) {
    console.error('[API] Reset submission failed via API as well:', apiErr);
    throw new Error(`איפוס החידון נכשל. ${apiErr.message}`);
  }
}

export async function resetClassOrGradeScoreApi(
  targetType: 'class' | 'grade',
  targetValue: string,
  options?: { clearHistory?: boolean }
): Promise<{ success: boolean; affectedCount: number; previousTotalPoints: number }> {
  const firebaseUser = auth.currentUser;
  const email = firebaseUser?.email?.trim().toLowerCase();
  if (!firebaseUser?.emailVerified || !email) {
    throw new Error('נדרשת התחברות מנהלת מאומתת לביצוע פעולה זו');
  }

  const managerSnap = await getDocs(query(collection(db, 'managers'), where('email', '==', email)));
  if (managerSnap.empty && email !== SUPER_ADMIN_EMAIL.toLowerCase()) {
    throw new Error('אין לך הרשאות מנהלת לביצוע איפוס ניקוד');
  }

  const allSnap = await getDocs(collection(db, 'students'));
  const targetClean = targetValue.trim();

  const studentsToReset = allSnap.docs
    .map((docSnap) => docSnap.data() as Student)
    .filter((s) => {
      if (s.managerParticipation) return false;
      if (targetType === 'class') {
        return (s.className || '').trim() === targetClean;
      } else {
        return (
          (s.grade || '').trim() === targetClean ||
          inferGradeFromClass(s.className || '') === targetClean
        );
      }
    });

  if (studentsToReset.length === 0) {
    return { success: true, affectedCount: 0, previousTotalPoints: 0 };
  }

  const previousTotalPoints = studentsToReset.reduce((sum, s) => sum + (s.points || 0), 0);

  const CHUNK_SIZE = 200;
  for (let i = 0; i < studentsToReset.length; i += CHUNK_SIZE) {
    const chunk = studentsToReset.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);

    for (const student of chunk) {
      const updatedStudent: Student = {
        ...student,
        points: 0,
        ...(options?.clearHistory
          ? { completedDates: [], submissions: {} }
          : {}),
      };

      const studentRef = doc(db, 'students', student.id);
      batch.set(studentRef, stripUndefinedValues(updatedStudent));

      const publicRef = doc(db, 'publicStudents', student.id);
      const publicSummary = toPublicStudentSummary(updatedStudent);
      if (publicSummary) {
        batch.set(publicRef, publicSummary);
      } else {
        batch.delete(publicRef);
      }
    }

    await batch.commit();
  }

  invalidatePublicStudentSummariesCache();

  return {
    success: true,
    affectedCount: studentsToReset.length,
    previousTotalPoints,
  };
}

export async function resetDemoApi() {
  try {
    const res = await fetch('/api/reset-demo', {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      invalidatePublicStudentSummariesCache();
      invalidatePrizeMilestonesCache();
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Falling back to direct Firestore for resetDemoApi');
  }

  // Overwrite Firestore with initial seed data
  for (const student of INITIAL_STUDENTS) {
    await writeStudentAndPublicSummary(student);
  }
  for (const halacha of INITIAL_HALACHOT) {
    await setDoc(doc(db, 'halachot', halacha.id), halacha);
  }

  invalidatePublicStudentSummariesCache();
  invalidatePrizeMilestonesCache();

  return { success: true };
}

export async function fetchManagersApi(): Promise<Manager[]> {
  try {
    const snap = await getDocs(collection(db, 'managers'));
    if (!snap.empty) {
      const list: Manager[] = [];
      snap.forEach((d) => list.push(d.data() as Manager));
      if (!list.some((m) => m.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase())) {
        list.unshift(INITIAL_MANAGERS[0]);
      }
      return list;
    }

    if (INITIAL_MANAGERS.length) {
      await setDoc(doc(db, 'managers', 'super_admin'), INITIAL_MANAGERS[0]);
    }
    return INITIAL_MANAGERS;
  } catch (err) {
    console.warn('[Firestore Fallback] Error fetching managers:', err);
  }

  try {
    const res = await fetch('/api/managers', {
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Falling back to seeded Firestore for fetchManagersApi');
  }

  return INITIAL_MANAGERS;
}

export async function addManagerApi(
  email: string,
  name: string,
  schoolIds?: string[]
): Promise<{ success: boolean; managers: Manager[] }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail.includes('@')) {
    throw new Error('נא להזין כתובת Gmail תקינה');
  }

  try {
    const snap = await getDocs(collection(db, 'managers'));
    const exists = snap.docs.some((d) => (d.data() as Manager).email.toLowerCase() === cleanEmail);
    if (exists) {
      throw new Error('מנהל זה כבר רשום במערכת');
    }

    const newMgr: Manager = {
      email: cleanEmail,
      name: name.trim() || cleanEmail.split('@')[0],
      role: 'admin',
      addedAt: new Date().toISOString(),
      ...(schoolIds && schoolIds.length > 0 ? { schoolIds } : {}),
    };
    const safeId = cleanEmail.replace(/[^a-zA-Z0-9_]/g, '_');
    await setDoc(doc(db, 'managers', safeId), newMgr);
    const managers = await fetchManagersApi();
    return { success: true, managers };
  } catch (e: any) {
    if (e.message && (e.message.includes('Gmail') || e.message.includes('כבר רשום'))) {
      throw e;
    }
    console.info('[Firestore] Direct manager creation failed, trying legacy API:', e);
  }

  try {
    const res = await fetch('/api/managers', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ email, name, schoolIds }),
    });
    if (res.ok) {
      return await parseJsonResponse(res);
    } else {
      const err = await parseJsonResponse(res).catch(() => ({ error: 'שגיאה בהוספת מנהל' }));
      throw new Error(err.error || 'שגיאה בהוספת מנהל');
    }
  } catch (e: any) {
    if (e.message && (e.message.includes('Gmail') || e.message.includes('מנהל זה כבר רשום'))) {
      throw e;
    }
    console.info('[API] Falling back to seeded Firestore for addManagerApi');
  }

  const newMgr: Manager = {
    email: cleanEmail,
    name: name.trim() || cleanEmail.split('@')[0],
    role: 'admin',
    addedAt: new Date().toISOString(),
  };
  const safeId = cleanEmail.replace(/[^a-zA-Z0-9_]/g, '_');
  await setDoc(doc(db, 'managers', safeId), newMgr);
  const managers = await fetchManagersApi();
  return { success: true, managers };
}

export async function deleteManagerApi(
  email: string
): Promise<{ success: boolean; managers: Manager[] }> {
  const cleanEmail = email.trim().toLowerCase();
  if (cleanEmail === SUPER_ADMIN_EMAIL.toLowerCase()) {
    throw new Error('לא ניתן למחוק את מנהל המערכת הראשי');
  }

  try {
    const safeId = cleanEmail.replace(/[^a-zA-Z0-9_]/g, '_');
    const managerSnap = await getDocs(collection(db, 'managers'));
    const matches = managerSnap.docs.filter((docSnap) => {
      const data = docSnap.data() as Partial<Manager>;
      return docSnap.id === safeId || (data.email || '').trim().toLowerCase() === cleanEmail;
    });

    if (matches.length > 0) {
      await Promise.all(matches.map((docSnap) => deleteDoc(docSnap.ref)));
    }

    const managers = await fetchManagersApi();
    return { success: true, managers };
  } catch (e: any) {
    if (e.message && e.message.includes('לא ניתן למחוק')) {
      throw e;
    }
    console.info('[Firestore] Direct manager delete failed, trying legacy API:', e);
  }

  try {
    const res = await fetch(`/api/managers/${encodeURIComponent(email)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      return await parseJsonResponse(res);
    } else {
      const err = await parseJsonResponse(res).catch(() => ({ error: 'שגיאה במחיקת מנהל' }));
      throw new Error(err.error || 'שגיאה במחיקת מנהל');
    }
  } catch (e: any) {
    if (e.message && e.message.includes('לא ניתן למחוק')) {
      throw e;
    }
    console.info('[API] Falling back to seeded Firestore for deleteManagerApi');
  }

  const managerSnap = await getDocs(collection(db, 'managers'));
  const matches = managerSnap.docs.filter((docSnap) => {
    const data = docSnap.data() as Partial<Manager>;
    return docSnap.id === cleanEmail.replace(/[^a-zA-Z0-9_]/g, '_') || (data.email || '').trim().toLowerCase() === cleanEmail;
  });

  if (matches.length > 0) {
    await Promise.all(matches.map((docSnap) => deleteDoc(docSnap.ref)));
  }

  const managers = await fetchManagersApi();
  return { success: true, managers };
}

// ==========================================
// School Classes API (Admin & Registration)
// ==========================================

async function fetchActiveStudentClasses(schoolId: string = 'shvut-rachel'): Promise<string[]> {
  try {
    const publicStudents = await fetchPublicStudentSummaries(false, schoolId);
    return Array.from(
      new Set(
        publicStudents
          .map((s) => (s.className || '').trim())
          .filter(Boolean)
      )
    );
  } catch {
    return [];
  }
}

// Reads the raw stored class list for a school without merging student classes.
async function readStoredClassList(schoolId: string): Promise<string[]> {
  if (schoolId !== 'shvut-rachel') {
    const schoolSnap = await getDoc(doc(db, 'schools', schoolId));
    if (schoolSnap.exists()) {
      const cData = schoolSnap.data();
      if (Array.isArray(cData?.classes)) return cData.classes as string[];
    }
    const defSchool = DEFAULT_SCHOOLS.find((s) => s.id === schoolId);
    return defSchool ? [...defSchool.classes] : [...DEFAULT_CLASSES];
  }
  const classesSnap = await getDoc(doc(db, 'settings', 'classes'));
  if (classesSnap.exists()) {
    const cData = classesSnap.data();
    if (Array.isArray(cData?.list)) return cData.list as string[];
  }
  return [...DEFAULT_CLASSES];
}

let seedAttempted = false;

export async function fetchClassesApi(schoolId: string = 'shvut-rachel'): Promise<string[]> {
  const activeStudentClasses = await fetchActiveStudentClasses(schoolId);

  try {
    if (schoolId !== 'shvut-rachel') {
      const schoolSnap = await getDoc(doc(db, 'schools', schoolId));
      if (schoolSnap.exists()) {
        const cData = schoolSnap.data();
        if (cData && Array.isArray(cData.classes) && cData.classes.length > 0) {
          return sortClasses(
            Array.from(new Set([...cData.classes, ...activeStudentClasses])).filter(Boolean)
          );
        }
      }
      const defSchool = DEFAULT_SCHOOLS.find((s) => s.id === schoolId);
      if (defSchool && defSchool.classes.length > 0) {
        return sortClasses(
          Array.from(new Set([...defSchool.classes, ...activeStudentClasses])).filter(Boolean)
        );
      }
    }

    const classesSnap = await getDoc(doc(db, 'settings', 'classes'));
    if (classesSnap.exists()) {
      const cData = classesSnap.data();
      if (cData && Array.isArray(cData.list) && cData.list.length > 0) {
        return sortClasses(
          Array.from(new Set([...cData.list, ...activeStudentClasses])).filter(Boolean)
        );
      }
    }

    const initialClasses = sortClasses(
      Array.from(new Set([...DEFAULT_CLASSES, ...activeStudentClasses])).filter(Boolean)
    );
    if (!seedAttempted) {
      seedAttempted = true;
      setDoc(doc(db, 'settings', 'classes'), { list: initialClasses }).catch((err) =>
        console.warn('[Firestore] Could not seed classes doc:', err)
      );
    }
    return initialClasses;
  } catch (err) {
    console.warn('[Firestore Fallback] Error fetching classes:', err);
  }

  try {
    const res = await fetch(`/api/classes?schoolId=${encodeURIComponent(schoolId)}`);
    if (res.ok) {
      const data = await parseJsonResponse(res);
      if (Array.isArray(data.classes) && data.classes.length > 0) {
        return sortClasses(
          Array.from(new Set([...data.classes, ...activeStudentClasses])).filter(Boolean)
        );
      }
    }
  } catch (e) {
    console.info('[API] Falling back to seeded Firestore for fetchClassesApi');
  }

  const defSchool = DEFAULT_SCHOOLS.find((s) => s.id === schoolId);
  return sortClasses(
    Array.from(
      new Set([...(defSchool ? defSchool.classes : DEFAULT_CLASSES), ...activeStudentClasses])
    ).filter(Boolean)
  );
}

export async function addClassApi(name: string, schoolId: string = 'shvut-rachel'): Promise<string[]> {
  const clean = name.trim();
  if (!clean) throw new Error('נא להזין שם כיתה');

  try {
    const stored = await readStoredClassList(schoolId);
    if (!stored.includes(clean)) {
      const updated = sortClasses([...stored, clean]);
      if (schoolId !== 'shvut-rachel') {
        await setDoc(doc(db, 'schools', schoolId), { classes: updated }, { merge: true });
      } else {
        await setDoc(doc(db, 'settings', 'classes'), { list: updated });
      }
      const activeStudentClasses = await fetchActiveStudentClasses(schoolId);
      return sortClasses(Array.from(new Set([...updated, ...activeStudentClasses])).filter(Boolean));
    }
    const activeStudentClasses = await fetchActiveStudentClasses(schoolId);
    return sortClasses(Array.from(new Set([...stored, ...activeStudentClasses])).filter(Boolean));
  } catch (err) {
    console.warn('[Firestore Fallback] Error saving classes:', err);
  }

  try {
    const res = await fetch('/api/classes', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ name: clean, schoolId }),
    });
    if (res.ok) {
      const data = await parseJsonResponse(res);
      return sortClasses(data.classes);
    }
  } catch (e) {
    console.info('[API] Falling back to seeded Firestore for addClassApi');
  }

  const stored = await readStoredClassList(schoolId);
  const updated = sortClasses(Array.from(new Set([...stored, clean])).filter(Boolean));
  if (schoolId !== 'shvut-rachel') {
    await setDoc(doc(db, 'schools', schoolId), { classes: updated }, { merge: true });
  } else {
    await setDoc(doc(db, 'settings', 'classes'), { list: updated });
  }
  return updated;
}

export async function deleteClassApi(name: string, schoolId: string = 'shvut-rachel'): Promise<string[]> {
  const clean = name.trim();

  try {
    const stored = await readStoredClassList(schoolId);
    const updated = sortClasses(stored.filter((c) => c !== clean));
    if (schoolId !== 'shvut-rachel') {
      await setDoc(doc(db, 'schools', schoolId), { classes: updated }, { merge: true });
    } else {
      await setDoc(doc(db, 'settings', 'classes'), { list: updated });
    }
    const activeStudentClasses = await fetchActiveStudentClasses(schoolId);
    return sortClasses(Array.from(new Set([...updated, ...activeStudentClasses])).filter(Boolean));
  } catch (err) {
    console.warn('[Firestore Fallback] Error deleting class:', err);
  }

  try {
    const res = await fetch(`/api/classes/${encodeURIComponent(clean)}?schoolId=${encodeURIComponent(schoolId)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const data = await parseJsonResponse(res);
      return sortClasses(data.classes);
    }
  } catch (e) {
    console.info('[API] Falling back to seeded Firestore for deleteClassApi');
  }

  const stored = await readStoredClassList(schoolId);
  const updated = sortClasses(stored.filter((c) => c !== clean));
  if (schoolId !== 'shvut-rachel') {
    await setDoc(doc(db, 'schools', schoolId), { classes: updated }, { merge: true });
  } else {
    await setDoc(doc(db, 'settings', 'classes'), { list: updated });
  }
  return updated;
}

export async function updateClassesApi(classes: string[], schoolId: string = 'shvut-rachel'): Promise<string[]> {
  const sorted = sortClasses(classes);
  try {
    if (schoolId !== 'shvut-rachel') {
      await setDoc(doc(db, 'schools', schoolId), { classes: sorted }, { merge: true });
    } else {
      await setDoc(doc(db, 'settings', 'classes'), { list: sorted });
    }
    return sorted;
  } catch (err) {
    console.warn('[Firestore Fallback] Error updating classes:', err);
  }

  try {
    const res = await fetch('/api/classes', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ classes: sorted, schoolId }),
    });
    if (res.ok) {
      const data = await parseJsonResponse(res);
      return sortClasses(data.classes);
    }
  } catch (e) {
    console.info('[API] Falling back to seeded Firestore for updateClassesApi');
  }

  if (schoolId !== 'shvut-rachel') {
    await setDoc(doc(db, 'schools', schoolId), { classes: sorted }, { merge: true });
  } else {
    await setDoc(doc(db, 'settings', 'classes'), { list: sorted });
  }
  return sorted;
}

// ==========================================
// Question Suggestions & Feedback API
// ==========================================

function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

export async function submitQuestionSuggestionApi(
  suggestionData: Omit<QuestionSuggestion, 'id' | 'status' | 'createdAt'>
): Promise<QuestionSuggestion> {
  const docRef = doc(collection(db, 'questionSuggestions'));
  const newSuggestion: QuestionSuggestion = {
    ...suggestionData,
    id: docRef.id,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  await setDoc(docRef, stripUndefined(newSuggestion));
  return newSuggestion;
}

export async function submitMultipleQuestionSuggestionsApi(
  suggestionsData: Omit<QuestionSuggestion, 'id' | 'status' | 'createdAt'>[]
): Promise<QuestionSuggestion[]> {
  const results: QuestionSuggestion[] = [];
  for (const item of suggestionsData) {
    const created = await submitQuestionSuggestionApi(item);
    results.push(created);
  }
  return results;
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

export async function fetchQuestionSuggestionsApi(): Promise<QuestionSuggestion[]> {
  const snap = await getDocs(collection(db, 'questionSuggestions'));
  const list: QuestionSuggestion[] = [];
  snap.forEach((d) => {
    list.push({ id: d.id, ...(d.data() as Omit<QuestionSuggestion, 'id'>) });
  });
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function approveQuestionSuggestionApi(
  id: string,
  options: { pointsAwarded: number; targetDate?: string; adminFeedback?: string }
): Promise<void> {
  const sugRef = doc(db, 'questionSuggestions', id);
  const snap = await getDoc(sugRef);
  if (!snap.exists()) throw new Error('ההצעה לא נמצאה');
  const sug = snap.data() as QuestionSuggestion;

  const updates: Partial<QuestionSuggestion> = {
    status: 'approved',
    pointsAwarded: options.pointsAwarded || 0,
    reviewedAt: new Date().toISOString(),
    reviewedBy: auth.currentUser?.email || 'מנהל',
  };
  if (options.targetDate) updates.targetDate = options.targetDate;
  if (options.adminFeedback) updates.adminFeedback = options.adminFeedback;

  await updateDoc(sugRef, stripUndefined(updates));

  // If bonus points were awarded, update student's points in private and public collections
  if (options.pointsAwarded > 0 && sug.studentId) {
    const studentRef = doc(db, 'students', sug.studentId);
    const studentSnap = await getDoc(studentRef);
    if (studentSnap.exists()) {
      const studentData = studentSnap.data() as Student;
      const newPoints = (studentData.points || 0) + options.pointsAwarded;
      const batch = writeBatch(db);
      batch.update(studentRef, { points: newPoints });

      const publicRef = doc(db, 'publicStudents', sug.studentId);
      const publicSnap = await getDoc(publicRef);
      if (publicSnap.exists()) {
        batch.update(publicRef, { points: newPoints });
      }
      await batch.commit();
      invalidatePublicStudentSummariesCache();
    }
  }
}

export async function rejectQuestionSuggestionApi(
  id: string,
  adminFeedback?: string
): Promise<void> {
  const sugRef = doc(db, 'questionSuggestions', id);
  const updates: Partial<QuestionSuggestion> = {
    status: 'rejected',
    reviewedAt: new Date().toISOString(),
    reviewedBy: auth.currentUser?.email || 'מנהל',
  };
  if (adminFeedback) updates.adminFeedback = adminFeedback;
  await updateDoc(sugRef, stripUndefined(updates));
}

export async function submitQuestionFeedbackApi(
  feedbackData: Omit<QuestionFeedback, 'id' | 'status' | 'createdAt'>
): Promise<QuestionFeedback> {
  const docRef = doc(collection(db, 'questionFeedback'));
  const newFeedback: QuestionFeedback = {
    ...feedbackData,
    id: docRef.id,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  await setDoc(docRef, stripUndefined(newFeedback));
  return newFeedback;
}

export async function fetchQuestionFeedbackApi(): Promise<QuestionFeedback[]> {
  const snap = await getDocs(collection(db, 'questionFeedback'));
  const list: QuestionFeedback[] = [];
  snap.forEach((d) => {
    list.push({ id: d.id, ...(d.data() as Omit<QuestionFeedback, 'id'>) });
  });
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function resolveQuestionFeedbackApi(
  id: string,
  adminResponse?: string
): Promise<void> {
  const feedbackRef = doc(db, 'questionFeedback', id);
  const updates: Partial<QuestionFeedback> = {
    status: 'resolved',
    resolvedAt: new Date().toISOString(),
    resolvedBy: auth.currentUser?.email || 'מנהל',
  };
  if (adminResponse) updates.adminResponse = adminResponse;
  await updateDoc(feedbackRef, stripUndefined(updates));
}


