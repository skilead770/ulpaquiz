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
  getStudentRegistrationDocumentId,
} from '../types';
import {
  INITIAL_STUDENTS,
  INITIAL_HALACHOT,
  INITIAL_INVITATIONS,
  INITIAL_MANAGERS,
  DEFAULT_PRIZE_MILESTONES,
} from '../data/seedData';

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

async function fetchAllStudentRecords(): Promise<Student[]> {
  const snap = await getDocs(collection(db, 'students'));
  return snap.docs.map((studentDoc) => studentDoc.data() as Student);
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
  };
}

async function writeStudentAndPublicSummary(student: Student): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(db, 'students', student.id), stripUndefinedValues(student));
  const publicSummary = toPublicStudentSummary(student);
  const publicRef = doc(db, 'publicStudents', student.id);
  if (publicSummary) {
    batch.set(publicRef, publicSummary);
  } else {
    batch.delete(publicRef);
  }
  await batch.commit();
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
}

async function fetchPublicStudentSummaries(): Promise<PublicStudentSummary[]> {
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

  return snapshot.docs.map((studentDoc) => studentDoc.data() as PublicStudentSummary);
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

export async function fetchStudents(): Promise<Student[]> {
  const firebaseUser = auth.currentUser;
  const email = firebaseUser?.email?.trim().toLowerCase();
  if (!firebaseUser?.emailVerified || !email) {
    throw new Error('נדרשת התחברות מאומתת כדי לטעון את רשימת התלמידות');
  }

  try {
    const managerSnap = await getDocs(query(collection(db, 'managers'), where('email', '==', email)));
    if (!managerSnap.empty) {
      const snap = await getDocs(collection(db, 'students'));
      return snap.docs
        .map((studentDoc) => studentDoc.data() as Student)
        .filter((student) => !student.managerParticipation);
    }

    const snap = await getDocs(query(collection(db, 'students'), where('email', '==', email)));
    return snap.docs
      .map((studentDoc) => studentDoc.data() as Student)
      .filter((student) => !student.managerParticipation);
  } catch (e) {
    console.info('[Firestore] Direct student read failed, falling back to API:', e);
  }

  const res = await fetch(API_BASE_URL + '/api/students', {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'לא ניתן לטעון את רשימת התלמידות');
  }
  const students = await parseJsonResponse(res) as Student[];
  return students.filter((student) => !student.managerParticipation);
}

export async function getOrCreateManagerParticipant(): Promise<Student> {
  const firebaseUser = auth.currentUser;
  const email = firebaseUser?.email?.trim().toLowerCase();
  if (!firebaseUser?.emailVerified || !email) {
    throw new Error('יש להתחבר באמצעות חשבון Google מאומת כדי להשתתף בחידון');
  }

  const managerQuery = query(collection(db, 'managers'), where('email', '==', email));
  const managerSnapshot = await getDocs(managerQuery);
  if (managerSnapshot.empty) {
    throw new Error('ההשתתפות בחידון זמינה למנהלות בלבד');
  }
  const manager = managerSnapshot.docs[0].data() as Manager;
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

export async function fetchHalachot(): Promise<DailyHalacha[]> {
  try {
    const snap = await getDocs(collection(db, 'halachot'));
    if (!snap.empty) {
      const list: DailyHalacha[] = [];
      snap.forEach((d) => list.push(d.data() as DailyHalacha));
      return list;
    }
  } catch (e) {
    console.info('[Firestore] Direct halacha read failed, falling back to API:', e);
  }

  try {
    const res = await fetch(API_BASE_URL + '/api/halachot');
    if (res.ok) {
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Falling back to seeded Firestore for fetchHalachot');
  }
  return getOrSeedFirestoreHalachot();
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

    const milestonesReached: PrizeMilestone[] = [];
    DEFAULT_PRIZE_MILESTONES.forEach((m) => {
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

export async function fetchLeaderboardApi(date: string): Promise<LeaderboardData> {
  try {
    const res = await fetch(API_BASE_URL + `/api/leaderboard?date=${date}`);
    if (res.ok) {
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Falling back to direct Firestore for fetchLeaderboardApi');
  }

  const students = await fetchPublicStudentSummaries();
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

export async function getPrizeMilestones(): Promise<PrizeMilestone[]> {
  try {
    const settingsSnap = await getDoc(doc(db, 'settings', 'prizeMilestones'));
    if (settingsSnap.exists()) {
      const data = settingsSnap.data() as { milestones?: PrizeMilestone[] };
      if (Array.isArray(data.milestones) && data.milestones.length > 0) {
        return [...data.milestones].sort((a, b) => a.points - b.points);
      }
    }
  } catch (err) {
    console.info('[Firestore] Direct prize milestone read failed, falling back to defaults:', err);
  }

  return [...DEFAULT_PRIZE_MILESTONES].sort((a, b) => a.points - b.points);
}

export async function savePrizeMilestonesApi(milestones: PrizeMilestone[]): Promise<PrizeMilestone[]> {
  const normalized = [...milestones]
    .map((m) => ({
      ...m,
      points: Number(m.points) || 0,
      title: (m.title || '').trim(),
      rewardDescription: (m.rewardDescription || '').trim(),
    }))
    .filter((m) => m.title && m.rewardDescription)
    .sort((a, b) => a.points - b.points);

  await setDoc(doc(db, 'settings', 'prizeMilestones'), {
    milestones: normalized,
    updatedAt: new Date().toISOString(),
  });

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

export async function bulkImportStudentsApi(students: Partial<Student>[]) {
  try {
    const res = await fetch(API_BASE_URL + '/api/students/bulk-import', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ students }),
    });
    if (res.ok) {
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Falling back to direct Firestore for bulkImportStudentsApi');
  }

  const imported: Student[] = students.map((s, idx) => ({
    id: s.id || `s-imp-${Date.now()}-${idx}`,
    fullName: s.fullName || 'תלמידה',
    className: s.className || "ט'1",
    grade: (s.grade as GradeType) || 'ט',
    username: s.username || `user_${Date.now()}_${idx}`,
    points: Number(s.points) || 0,
    completedDates: Array.isArray(s.completedDates) ? s.completedDates : [],
    submissions: s.submissions || {},
    status: s.status || 'approved',
  }));

  for (const st of imported) {
    await writeStudentAndPublicSummary(st);
  }

  const allStudents = await fetchAllStudentRecords();
  return { success: true, count: imported.length, students: allStudents };
}

export async function addStudentApi(student: Partial<Student>) {
  try {
    const res = await fetch(API_BASE_URL + '/api/students', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(student),
    });
    if (res.ok) {
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Falling back to direct Firestore for addStudentApi');
  }

  const allStudents = await fetchAllStudentRecords();
  const existingIdx = allStudents.findIndex((s) => s.id === student.id);
  let targetStudent: Student;

  if (existingIdx >= 0) {
    targetStudent = {
      ...allStudents[existingIdx],
      ...student,
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
    };
  }

  const sanitizedStudent = stripUndefinedValues(targetStudent) as Student;
  await writeStudentAndPublicSummary(sanitizedStudent);
  const updatedStudents = await fetchAllStudentRecords();
  return { success: true, student: targetStudent, students: updatedStudents };
}

export async function deleteStudentApi(id: string) {
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
        throw new Error(data.error || `שגיאה במחיקת התלמידה (${res.status})`);
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
    const allStudents = await fetchAllStudentRecords();
    return { success: true, students: allStudents };
  } catch (error) {
    firestoreError = error;
  }

  throw firestoreError instanceof Error
    ? firestoreError
    : new Error('לא ניתן למחוק את בקשת התלמידה. בדקי את הרשאות Firestore ונסי שוב.');
}

export async function bulkImportHalachotApi(halachot: Partial<DailyHalacha>[], replaceAll = false) {
  const res = await fetch(API_BASE_URL + '/api/admin/bulk-import-halachot', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ halachot, replaceAll }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'שגיאה ביבוא הלכות');
  }
  return res.json();
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

export async function fetchInvitationsApi(): Promise<Invitation[]> {
  try {
    const snap = await getDocs(collection(db, 'invitations'));
    if (!snap.empty) {
      const list: Invitation[] = [];
      snap.forEach((d) => list.push(d.data() as Invitation));
      return list;
    }
    for (const inv of INITIAL_INVITATIONS) {
      await setDoc(doc(db, 'invitations', inv.id), inv);
    }
    return INITIAL_INVITATIONS;
  } catch (err) {
    console.warn('[Firestore Fallback] Error fetching invitations:', err);
  }

  try {
    const res = await fetch('/api/invitations', {
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Falling back to seeded Firestore for fetchInvitationsApi');
  }

  return INITIAL_INVITATIONS;
}

export async function createInvitationApi(invitationData: {
  className: string;
  grade: GradeType;
  maxUses: number;
  code: string;
}) {
  const cleanCode = invitationData.code.trim().toUpperCase();
  const cleanClass = invitationData.className.trim();
  const maxUses = Number(invitationData.maxUses) || 50;

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
    };

    await setDoc(doc(db, 'invitations', inv.id), inv);
    const invitations = await fetchInvitationsApi();
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
      body: JSON.stringify(invitationData),
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
  };

  await setDoc(doc(db, 'invitations', inv.id), inv);
  const invitations = await fetchInvitationsApi();
  return { success: true, invitation: inv, invitations };
}

export async function deleteInvitationApi(id: string) {
  try {
    await deleteDoc(doc(db, 'invitations', id));
    const invitations = await fetchInvitationsApi();
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

  const invitations = await fetchInvitationsApi();
  return { success: true, invitations };
}

export async function validateInvitationCodeApi(code: string): Promise<{ valid: boolean; invitation?: Invitation; error?: string }> {
  try {
    const cleanCode = code.trim().toUpperCase();
    const invitations = await fetchInvitationsApi();
    const inv = invitations.find((i) => i.code.trim().toUpperCase() === cleanCode && i.active);

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

  const invitations = await fetchInvitationsApi();
  const cleanCode = code.trim().toUpperCase();
  const inv = invitations.find((i) => i.code.trim().toUpperCase() === cleanCode && i.active);

  if (!inv) {
    return { valid: false, error: 'קוד הזמנה לא קיים או שאינו פעיל' };
  }
  if (inv.maxUses > 0 && inv.usedCount >= inv.maxUses) {
    return { valid: false, error: 'קוד ההזמנה הגיע למכסת השימושים המרבית' };
  }
  return { valid: true, invitation: inv };
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

  throw new Error('לא ניתן לבדוק את סטטוס ההרשמה כעת. התחברי לחשבון Google הרשום או נסי שוב מאוחר יותר.');
}

export async function registerStudentApi(studentData: {
  fullName: string;
  email?: string;
  grade?: string;
  className?: string;
  username?: string;
  password?: string;
  invitationCode?: string;
}): Promise<{
  success: boolean;
  status?: 'pending' | 'approved' | 'rejected';
  autoApproved?: boolean;
  isManager?: boolean;
  message: string;
  student?: Student;
}> {
  const cleanEmail = (studentData.email || studentData.username || '').trim().toLowerCase();
  const effectiveEmail = cleanEmail.includes('@') ? cleanEmail : `${cleanEmail}@gmail.com`;

  try {
    const existingStudents = await fetchAllStudentRecords();
    const existing = existingStudents.find((s) => {
      const sEmail = s.email ? s.email.trim().toLowerCase() : '';
      const sUser = s.username ? s.username.trim().toLowerCase() : '';
      return sEmail === effectiveEmail || sUser === effectiveEmail || sUser === cleanEmail.split('@')[0];
    });

    if (existing) {
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
          message: 'ההרשמה שלך כבר נקלטה וממתינה לאישור. לאחר האישור, התחברי באמצעות חשבון Google הרשום במערכת.',
          student: existing,
        };
      }
      throw new Error('בקשת ההרשמה שלך נדחתה בעבר. נא לפנות להנהלת האולפנה.');
    }

    const baseUser = cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') || 'student';
    let finalUsername = baseUser;
    let counter = 1;
    while (existingStudents.some((s) => s.username.toLowerCase() === finalUsername.toLowerCase())) {
      finalUsername = `${baseUser}${counter++}`;
    }

    let matchedInvitation: Invitation | undefined;
    if (studentData.invitationCode) {
      const invitationSnap = await getDocs(collection(db, 'invitations'));
      const invDoc = invitationSnap.docs.find((d) => {
        const item = d.data() as Invitation;
        return item.code.trim().toUpperCase() === studentData.invitationCode!.trim().toUpperCase() && item.active;
      });

      if (invDoc) {
        const item = invDoc.data() as Invitation;
        if (item.maxUses > 0 && item.usedCount >= item.maxUses) {
          throw new Error('קוד ההזמנה הגיע למכסת השימושים המרבית');
        }
        matchedInvitation = { ...item, usedCount: item.usedCount + 1 };
        await setDoc(doc(db, 'invitations', invDoc.id), matchedInvitation);
      }
    }

    const chosenClass = (studentData.className?.trim() || matchedInvitation?.className || DEFAULT_CLASSES[0]);
    const derivedGrade = inferGradeFromClass(chosenClass);
    const newStudent: Student = {
      id: getStudentRegistrationDocumentId(effectiveEmail),
      fullName: studentData.fullName.trim(),
      className: chosenClass,
      grade: derivedGrade,
      username: finalUsername,
      email: effectiveEmail,
      points: 0,
      completedDates: [],
      submissions: {},
      status: 'pending',
      registeredAt: new Date().toISOString(),
      ...(studentData.invitationCode?.trim()
        ? { invitationCode: studentData.invitationCode.trim().toUpperCase() }
        : {}),
    };

    await setDoc(doc(db, 'students', newStudent.id), newStudent);

    return {
      success: true,
      status: 'pending',
      autoApproved: false,
      message: 'בקשת ההרשמה נקלטה בהצלחה! היא ממתינה כעת לאישור הנהלת האולפנה. לאחר האישור, התחברי באמצעות חשבון Google הרשום במערכת.',
      student: newStudent,
    };
  } catch (firestoreErr: any) {
    console.info('[Firestore] Direct registration failed, falling back to API:', firestoreErr);
  }

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(studentData),
    });
    if (res.ok) {
      return await parseJsonResponse(res);
    } else {
      const err = await parseJsonResponse(res).catch(() => ({ error: 'שגיאה ברישום' }));
      throw new Error(err.error || 'שגיאה ברישום');
    }
  } catch (e: any) {
    if (e.message && (e.message.includes('Gmail') || e.message.includes('שם מלא'))) {
      throw e;
    }
    console.info('[API] Falling back to seeded Firestore for registerStudentApi');
  }

  if (studentData.invitationCode?.trim()) {
    throw new Error('הרשמה עם קוד הזמנה דורשת חיבור לשרת. נסי שוב מאוחר יותר.');
  }

  const baseUser = cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') || 'student';
  const chosenClass = studentData.className?.trim() || DEFAULT_CLASSES[0];
  const newStudent: Student = {
    id: getStudentRegistrationDocumentId(effectiveEmail),
    fullName: studentData.fullName.trim(),
    className: chosenClass,
    grade: inferGradeFromClass(chosenClass),
    username: baseUser,
    email: effectiveEmail,
    points: 0,
    completedDates: [],
    submissions: {},
    status: 'pending',
    registeredAt: new Date().toISOString(),
  };
  try {
    await setDoc(doc(db, 'students', newStudent.id), newStudent);
  } catch (error) {
    console.error('[Registration] Direct Firestore registration failed:', error);
    throw new Error('לא ניתן להשלים את ההרשמה. ייתכן שכבר קיימת בקשה לכתובת זו; התחברי באמצעות Google או פני למנהלת.');
  }

  return {
    success: true,
    status: 'pending',
    autoApproved: false,
    message: 'בקשת ההרשמה נקלטה בהצלחה! היא ממתינה כעת לאישור הנהלת האולפנה. לאחר האישור, התחברי באמצעות חשבון Google הרשום במערכת.',
    student: newStudent,
  };
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
  date: string
): Promise<{ success: boolean; student: Student; students: Student[] }> {
  try {
    const studentRef = doc(db, 'students', studentId);

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(studentRef);
      if (!snap.exists()) {
        throw new Error('תלמידה לא נמצאה');
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

    const updatedStudentSnap = await getDoc(studentRef);
    if (!updatedStudentSnap.exists()) {
      throw new Error('Failed to refetch student after reset.');
    }
    const updatedStudent = updatedStudentSnap.data() as Student;
    const allStudents = await fetchStudents();

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
      return await parseJsonResponse(res);
    }
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'שגיאה באיפוס החידון מהשרת');
  } catch (apiErr: any) {
    console.error('[API] Reset submission failed via API as well:', apiErr);
    throw new Error(`איפוס החידון נכשל. ${apiErr.message}`);
  }
}

export async function resetDemoApi() {
  try {
    const res = await fetch('/api/reset-demo', {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (res.ok) {
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
  name: string
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
      body: JSON.stringify({ email, name }),
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

export async function fetchClassesApi(): Promise<string[]> {
  try {
    const snap = await getDocs(collection(db, 'settings'));
    let found: string[] | null = null;
    snap.forEach((d) => {
      if (d.id === 'classes') {
        const cData = d.data();
        if (cData && Array.isArray(cData.list) && cData.list.length > 0) {
          found = cData.list;
        }
      }
    });
    if (found) return found;

    await setDoc(doc(db, 'settings', 'classes'), { list: DEFAULT_CLASSES });
    return DEFAULT_CLASSES;
  } catch (err) {
    console.warn('[Firestore Fallback] Error fetching classes:', err);
  }

  try {
    const res = await fetch('/api/classes');
    if (res.ok) {
      const data = await parseJsonResponse(res);
      if (Array.isArray(data.classes) && data.classes.length > 0) {
        return data.classes;
      }
    }
  } catch (e) {
    console.info('[API] Falling back to seeded Firestore for fetchClassesApi');
  }

  return DEFAULT_CLASSES;
}

export async function addClassApi(name: string): Promise<string[]> {
  const clean = name.trim();
  if (!clean) throw new Error('נא להזין שם כיתה');

  try {
    const current = await fetchClassesApi();
    if (!current.includes(clean)) {
      const updated = [...current, clean];
      await setDoc(doc(db, 'settings', 'classes'), { list: updated });
      return updated;
    }
    return current;
  } catch (err) {
    console.warn('[Firestore Fallback] Error saving classes:', err);
  }

  try {
    const res = await fetch('/api/classes', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ name: clean }),
    });
    if (res.ok) {
      const data = await parseJsonResponse(res);
      return data.classes;
    }
  } catch (e) {
    console.info('[API] Falling back to seeded Firestore for addClassApi');
  }

  const current = await fetchClassesApi();
  if (!current.includes(clean)) {
    const updated = [...current, clean];
    await setDoc(doc(db, 'settings', 'classes'), { list: updated });
    return updated;
  }
  return current;
}

export async function deleteClassApi(name: string): Promise<string[]> {
  const clean = name.trim();

  try {
    const current = await fetchClassesApi();
    const updated = current.filter((c) => c !== clean);
    await setDoc(doc(db, 'settings', 'classes'), { list: updated });
    return updated;
  } catch (err) {
    console.warn('[Firestore Fallback] Error deleting class:', err);
  }

  try {
    const res = await fetch(`/api/classes/${encodeURIComponent(clean)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const data = await parseJsonResponse(res);
      return data.classes;
    }
  } catch (e) {
    console.info('[API] Falling back to seeded Firestore for deleteClassApi');
  }

  const current = await fetchClassesApi();
  const updated = current.filter((c) => c !== clean);
  await setDoc(doc(db, 'settings', 'classes'), { list: updated });
  return updated;
}

export async function updateClassesApi(classes: string[]): Promise<string[]> {
  try {
    await setDoc(doc(db, 'settings', 'classes'), { list: classes });
    return classes;
  } catch (err) {
    console.warn('[Firestore Fallback] Error updating classes:', err);
  }

  try {
    const res = await fetch('/api/classes', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ classes }),
    });
    if (res.ok) {
      const data = await parseJsonResponse(res);
      return data.classes;
    }
  } catch (e) {
    console.info('[API] Falling back to seeded Firestore for updateClassesApi');
  }

  await setDoc(doc(db, 'settings', 'classes'), { list: classes });
  return classes;
}
