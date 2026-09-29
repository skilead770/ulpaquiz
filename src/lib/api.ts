import {
  collection,
  getDocs,
  getDoc,
  query,
  where,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  runTransaction,
  deleteField,
} from 'firebase/firestore';
import { auth, db } from './firebaseClient';
import { getTodayInJerusalem } from './quizSchedule';
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
  Invitation,
  Manager,
  DEFAULT_CLASSES,
  inferGradeFromClass,
} from '../types';
import {
  INITIAL_STUDENTS,
  INITIAL_HALACHOT,
  INITIAL_INVITATIONS,
  INITIAL_MANAGERS,
  DEFAULT_PRIZE_MILESTONES,
} from '../data/seedData';

// Token Management for secure API requests
let currentAuthToken: string | null = typeof window !== 'undefined' ? localStorage.getItem('halacha_auth_token') : null;

export function setAuthToken(token: string | null) {
  currentAuthToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('halacha_auth_token', token);
    } else {
      localStorage.removeItem('halacha_auth_token');
    }
  }
}

export function getAuthToken(): string | null {
  if (!currentAuthToken && typeof window !== 'undefined') {
    currentAuthToken = localStorage.getItem('halacha_auth_token');
  }
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

// Client-side Firestore seed fallback
async function getOrSeedFirestoreStudents(): Promise<Student[]> {
  try {
    const snap = await getDocs(collection(db, 'students'));
    if (!snap.empty) {
      const list: Student[] = [];
      snap.forEach((d) => list.push(d.data() as Student));
      return list;
    }
    // Seed initial students to Firestore
    for (const student of INITIAL_STUDENTS) {
      await setDoc(doc(db, 'students', student.id), student);
    }
    return INITIAL_STUDENTS;
  } catch (err) {
    console.warn('[Firestore Fallback] Error fetching students from Firestore:', err);
    return INITIAL_STUDENTS;
  }
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

export async function fetchStudents(): Promise<Student[]> {
  try {
    const snap = await getDocs(collection(db, 'students'));
    if (!snap.empty) {
      const list: Student[] = [];
      snap.forEach((d) => list.push(d.data() as Student));
      return list.filter((student) => !student.managerParticipation);
    }
  } catch (e) {
    console.info('[Firestore] Direct student read failed, falling back to API:', e);
  }

  try {
    const res = await fetch(API_BASE_URL + '/api/students');
    if (res.ok) {
      const students = await parseJsonResponse(res) as Student[];
      return students.filter((student) => !student.managerParticipation);
    }
  } catch (e) {
    console.info('[API] Falling back to seeded Firestore for fetchStudents');
  }
  return getOrSeedFirestoreStudents();
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
    const snap = await getDocs(collection(db, 'halachot'));
    if (!snap.empty) {
      const list: DailyHalacha[] = [];
      snap.forEach((d) => list.push(d.data() as DailyHalacha));
      const found = list.find((h) => h.date === date);
      if (found) return found;
      if (list.length > 0) return list[0];
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
  if (date !== getTodayInJerusalem()) {
    throw new Error('ניתן להיבחן רק בחידון של היום');
  }
  const firebaseUser = auth.currentUser;
  if (!firebaseUser?.emailVerified) {
    throw new Error('להגשת החידון יש להתחבר תחילה באמצעות Google SSO');
  }
  const authHeaders = getAuthHeaders();
  authHeaders.Authorization = `Bearer ${await firebaseUser.getIdToken()}`;

  // Firestore-first write path for the scoring workflow.
  try {
    const halachaSnap = await getDocs(collection(db, 'halachot'));
    const halachaList: DailyHalacha[] = [];
    halachaSnap.forEach((d) => halachaList.push(d.data() as DailyHalacha));
    const halacha = halachaList.find((h) => h.date === date);
    if (!halacha) {
      throw new Error('הלכה לא נמצאה לתאריך זה');
    }
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
    const studyPoints = confirmedStudy ? 10 : 0;
    const questionPoints = correctCount * 10;
    const bonusPoints = isPerfect ? 20 : 0;
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

    await updateDoc(studentRef, {
      points: student.points,
      completedDates: student.completedDates,
      [`submissions.${date}`]: submission,
    });

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
        ? `אלופה! ענית נכון על כל 4 השאלות וזכית בבונוס מושלם! צברת ${earnedPoints} נקודות!`
        : `כל הכבוד על ההשתתפות! צברת ${earnedPoints} נקודה לימוד לך, לכיתה ולשכבה!`,
    };
  } catch (firestoreErr) {
    console.info('[Firestore] Direct quiz submission failed, trying legacy API:', firestoreErr);
  }

  try {
    const res = await fetch(API_BASE_URL + '/api/submit-quiz', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ studentId, date, answers, confirmedStudy }),
    });
    if (res.ok) {
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Falling back to seeded Firestore for submitQuizApi');
  }

  // Seeded fallback remains available.
  const halachot = await getOrSeedFirestoreHalachot();
  const halacha = halachot.find((h) => h.date === date);
  if (!halacha) {
    throw new Error('הלכה לא נמצאה לתאריך זה');
  }
  if (halacha.quizEnabled === false) {
    throw new Error('המנהלת השביתה את החידון לתאריך זה');
  }

  const students = await getOrSeedFirestoreStudents();
  const studentIndex = students.findIndex((s) => s.id === studentId);
  if (studentIndex === -1) {
    throw new Error('תלמידה לא נמצאה');
  }
  const student = { ...students[studentIndex] };

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
  const studyPoints = confirmedStudy ? 10 : 0;
  const questionPoints = correctCount * 10;
  const bonusPoints = isPerfect ? 20 : 0;
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
  if (!student.completedDates.includes(date)) {
    student.completedDates.push(date);
  }
  student.submissions = {
    ...student.submissions,
    [date]: submission,
  };

  await updateDoc(doc(db, 'students', student.id), {
    points: student.points,
    completedDates: student.completedDates,
    [`submissions.${date}`]: submission,
  });

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
      ? `אלופה! ענית נכון על כל 4 השאלות וזכית בבונוס מושלם! צברת ${earnedPoints} נקודות!`
      : `כל הכבוד על ההשתתפות! צברת ${earnedPoints} נקודה לימוד לך, לכיתה ולשכבה!`,
  };
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

  const students = await getOrSeedFirestoreStudents();
  const activeStudents = students.filter(
    (s) => !s.managerParticipation && s.status !== 'pending' && s.status !== 'rejected'
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

export async function fetchPrizesApi(): Promise<{
  reports: PrizeReportItem[];
  milestones: PrizeMilestone[];
}> {
  try {
    const res = await fetch(API_BASE_URL + '/api/prizes');
    if (res.ok) {
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Falling back to direct Firestore for fetchPrizesApi');
  }

  const students = await getOrSeedFirestoreStudents();
  const activeStudents = students.filter(
    (s) => !s.managerParticipation && s.status !== 'pending' && s.status !== 'rejected'
  );

  const reports: PrizeReportItem[] = activeStudents.map((student) => {
    const qualifyingMilestones = DEFAULT_PRIZE_MILESTONES.filter(
      (m) => student.points >= m.points
    );
    const nextMilestone =
      DEFAULT_PRIZE_MILESTONES.find((m) => student.points < m.points) || null;
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
    milestones: DEFAULT_PRIZE_MILESTONES,
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
    await setDoc(doc(db, 'students', st.id), st);
  }

  const allStudents = await getOrSeedFirestoreStudents();
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

  const allStudents = await getOrSeedFirestoreStudents();
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

  await setDoc(doc(db, 'students', targetStudent.id), targetStudent);
  const updatedStudents = await getOrSeedFirestoreStudents();
  return { success: true, student: targetStudent, students: updatedStudents };
}

export async function deleteStudentApi(id: string) {
  try {
    const res = await fetch(API_BASE_URL + `/api/students/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Falling back to direct Firestore for deleteStudentApi');
  }

  await deleteDoc(doc(db, 'students', id));
  const allStudents = await getOrSeedFirestoreStudents();
  return { success: true, students: allStudents };
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
  const cleanUsername = cleanEmail.split('@')[0];

  try {
    const q = query(collection(db, 'students'), where('email', '==', cleanEmail));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const student = snap.docs[0].data() as Student;
      return {
        registered: true,
        status: student.status || 'approved',
        student: student.status === 'approved' ? student : undefined,
      };
    }

    const usernameQuery = query(collection(db, 'students'), where('username', '==', cleanUsername));
    const usernameSnap = await getDocs(usernameQuery);
    if (!usernameSnap.empty) {
      const student = usernameSnap.docs[0].data() as Student;
      return {
        registered: true,
        status: student.status || 'approved',
        student: student.status === 'approved' ? student : undefined,
      };
    }
  } catch (e) {
    console.info('[Firestore] Direct status check failed, falling back to API:', e);
  }

  try {
    const res = await fetch('/api/auth/check-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (res.ok) {
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Falling back to seeded Firestore for checkStudentStatusApi');
  }

  const existingStudents = await getOrSeedFirestoreStudents();
  const student = existingStudents.find((s) => {
    const sEmail = s.email ? s.email.trim().toLowerCase() : '';
    const sUser = s.username ? s.username.trim().toLowerCase() : '';
    return sEmail === cleanEmail || sUser === cleanEmail || sUser === cleanUsername;
  });

  if (!student) {
    return { registered: false };
  }

  return {
    registered: true,
    status: student.status || 'approved',
    student: student.status === 'approved' ? student : undefined,
  };
}

export async function loginByEmailApi(
  email: string
): Promise<{
  success: boolean;
  student?: Student;
  isManager?: boolean;
  role?: string;
  message?: string;
  manager?: Manager;
}> {
  const cleanEmail = email.trim().toLowerCase();

  try {
    const managerQ = query(collection(db, 'managers'), where('email', '==', cleanEmail));
    const managerSnap = await getDocs(managerQ);
    if (!managerSnap.empty) {
      const manager = managerSnap.docs[0].data() as Manager;
      return {
        success: true,
        isManager: true,
        role: 'admin',
        manager,
        message: 'שלום מנהל המערכת!',
      };
    }
  } catch (e) {
    console.info('[Firestore] Direct manager login check failed, falling back to API:', e);
  }

  try {
    const studentQ = query(collection(db, 'students'), where('email', '==', cleanEmail));
    const studentSnap = await getDocs(studentQ);
    if (!studentSnap.empty) {
      const student = studentSnap.docs[0].data() as Student;
      if (student.status === 'pending') {
        throw new Error('בקשת ההרשמה שלך התקבלה בהצלחה, אך היא עדיין ממתינה לאישור מנהל האולפנה. לא ניתן להיכנס למערכת עד לקבלת אישור.');
      }
      if (student.status === 'rejected') {
        throw new Error('בקשת ההרשמה שלך נדחתה. נא לפנות להנהלת האולפנה לבירור.');
      }
      return { success: true, student };
    }

    const usernameQ = query(collection(db, 'students'), where('username', '==', cleanEmail.split('@')[0]));
    const usernameSnap = await getDocs(usernameQ);
    if (!usernameSnap.empty) {
      const student = usernameSnap.docs[0].data() as Student;
      if (student.status === 'pending') {
        throw new Error('בקשת ההרשמה שלך התקבלה בהצלחה, אך היא עדיין ממתינה לאישור מנהל האולפנה. לא ניתן להיכנס למערכת עד לקבלת אישור.');
      }
      if (student.status === 'rejected') {
        throw new Error('בקשת ההרשמה שלך נדחתה. נא לפנות להנהלת האולפנה לבירור.');
      }
      return { success: true, student };
    }
  } catch (e: any) {
    if (e.message && (e.message.includes('לא נמצאה תלמידה') || e.message.includes('ממתינה לאישור') || e.message.includes('נדחתה'))) {
      throw e;
    }
    console.info('[Firestore] Direct student login check failed, falling back to API:', e);
  }

  try {
    const res = await fetch('/api/auth/login-by-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (res.ok) {
      return await parseJsonResponse(res);
    } else {
      const err = await parseJsonResponse(res).catch(() => ({ error: 'שגיאה בהתחברות' }));
      throw new Error(err.error || 'שגיאה בהתחברות');
    }
  } catch (e: any) {
    if (e.message && (e.message.includes('לא נמצאה תלמידה') || e.message.includes('ממתינה לאישור') || e.message.includes('נדחתה'))) {
      throw e;
    }
    console.info('[API] Falling back to seeded Firestore for loginByEmailApi');
  }

  if (cleanEmail === SUPER_ADMIN_EMAIL.toLowerCase()) {
    return {
      success: true,
      isManager: true,
      role: 'admin',
      manager: INITIAL_MANAGERS[0],
      message: 'שלום מנהל המערכת!',
    };
  }

  const existingStudents = await getOrSeedFirestoreStudents();
  const cleanUsername = cleanEmail.split('@')[0];

  const student = existingStudents.find((s) => {
    const sEmail = s.email ? s.email.trim().toLowerCase() : '';
    const sUser = s.username ? s.username.trim().toLowerCase() : '';
    return sEmail === cleanEmail || sUser === cleanEmail || sUser === cleanUsername;
  });

  if (!student) {
    throw new Error('לא נמצאה תלמידה רשומה עם כתובת Gmail זו. נא להירשם תחילה.');
  }

  if (student.status === 'pending') {
    throw new Error('בקשת ההרשמה שלך התקבלה בהצלחה, אך היא עדיין ממתינה לאישור מנהל האולפנה. לא ניתן להיכנס למערכת עד לקבלת אישור.');
  }

  if (student.status === 'rejected') {
    throw new Error('בקשת ההרשמה שלך נדחתה. נא לפנות להנהלת האולפנה לבירור.');
  }

  return { success: true, student };
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
    const existingStudents = await getOrSeedFirestoreStudents();
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
          message: 'שלום שוב! התחברת בהצלחה עם כתובת ה-Gmail שלך.',
          student: existing,
        };
      }
      if (existing.status === 'pending') {
        return {
          success: true,
          status: 'pending',
          autoApproved: false,
          message: 'ההרשמה שלך כבר נקלטה במערכת ונמצאת בהמתנה לאישור מנהל האולפנה. תוכלי להתחבר מיד לאחר האישור.',
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
      id: `s-reg-${Date.now()}`,
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
      message: 'בקשת ההרשמה נקלטה בהצלחה! היא ממתינה כעת לאישור הנהלת האולפנה. לאחר אישור המנהל, תוכלי להיכנס ישירות עם כתובת ה-Gmail שלך.',
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

  const existingStudents = await getOrSeedFirestoreStudents();
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
        message: 'שלום שוב! התחברת בהצלחה עם כתובת ה-Gmail שלך.',
        student: existing,
      };
    }
    if (existing.status === 'pending') {
      return {
        success: true,
        status: 'pending',
        autoApproved: false,
        message: 'ההרשמה שלך כבר נקלטה במערכת ונמצאת בהמתנה לאישור מנהל האולפנה. תוכלי להתחבר מיד לאחר האישור.',
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
    const valRes = await validateInvitationCodeApi(studentData.invitationCode);
    if (valRes.valid && valRes.invitation) {
      matchedInvitation = valRes.invitation;
      matchedInvitation.usedCount += 1;
      await setDoc(doc(db, 'invitations', matchedInvitation.id), matchedInvitation);
    }
  }

  const chosenClass = (studentData.className?.trim() || matchedInvitation?.className || DEFAULT_CLASSES[0]);
  const derivedGrade = inferGradeFromClass(chosenClass);

  const newStudent: Student = {
    id: `s-reg-${Date.now()}`,
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
    message: 'בקשת ההרשמה נקלטה בהצלחה! היא ממתינה כעת לאישור הנהלת האולפנה. לאחר אישור המנהל, תוכלי להיכנס ישירות עם כתובת ה-Gmail שלך.',
    student: newStudent,
  };
}

export async function approveStudentApi(id: string) {
  try {
    await updateDoc(doc(db, 'students', id), { status: 'approved' });
    const students = await getOrSeedFirestoreStudents();
    return { success: true, students };
  } catch (e) {
    console.info('[Firestore] Direct approval failed, trying legacy API:', e);
  }

  try {
    const res = await fetch(`/api/students/${id}/approve`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Falling back to seeded Firestore for approveStudentApi');
  }

  await updateDoc(doc(db, 'students', id), { status: 'approved' });
  const students = await getOrSeedFirestoreStudents();
  return { success: true, students };
}

export async function rejectStudentApi(id: string) {
  try {
    await updateDoc(doc(db, 'students', id), { status: 'rejected' });
    const students = await getOrSeedFirestoreStudents();
    return { success: true, students };
  } catch (e) {
    console.info('[Firestore] Direct rejection failed, trying legacy API:', e);
  }

  try {
    const res = await fetch(`/api/students/${id}/reject`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Falling back to seeded Firestore for rejectStudentApi');
  }

  await updateDoc(doc(db, 'students', id), { status: 'rejected' });
  const students = await getOrSeedFirestoreStudents();
  return { success: true, students };
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
    await setDoc(doc(db, 'students', student.id), student);
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
    await deleteDoc(doc(db, 'managers', safeId));
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

  const safeId = cleanEmail.replace(/[^a-zA-Z0-9_]/g, '_');
  await deleteDoc(doc(db, 'managers', safeId));
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
