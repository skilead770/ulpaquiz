import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from './firebaseClient';
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
} from '../types';
import {
  INITIAL_STUDENTS,
  INITIAL_HALACHOT,
  INITIAL_INVITATIONS,
  DEFAULT_PRIZE_MILESTONES,
} from '../data/seedData';

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
    const res = await fetch('/api/students');
    if (res.ok) {
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Falling back to direct Firestore for fetchStudents');
  }
  return getOrSeedFirestoreStudents();
}

export async function fetchHalachot(): Promise<DailyHalacha[]> {
  try {
    const res = await fetch('/api/halachot');
    if (res.ok) {
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Falling back to direct Firestore for fetchHalachot');
  }
  return getOrSeedFirestoreHalachot();
}

export async function fetchHalachaByDate(date: string): Promise<DailyHalacha> {
  try {
    const res = await fetch(`/api/halachot/${date}`);
    if (res.ok) {
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Falling back to direct Firestore for fetchHalachaByDate');
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
  answers: Record<string, number>
) {
  try {
    const res = await fetch('/api/submit-quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, date, answers }),
    });
    if (res.ok) {
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Falling back to direct Firestore for submitQuizApi');
  }

  // Client-side Firestore calculation
  const halachot = await getOrSeedFirestoreHalachot();
  const halacha = halachot.find((h) => h.date === date);
  if (!halacha) {
    throw new Error('הלכה לא נמצאה לתאריך זה');
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
  const earnedPoints = isPerfect ? 2 : 1;

  const previousPoints = student.points;
  const newPoints = previousPoints + earnedPoints;

  const submissionTime = new Date().toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const submission: QuizSubmission = {
    date,
    score: correctCount,
    earnedPoints,
    submittedAt: submissionTime,
    answers,
  };

  student.points = newPoints;
  if (!student.completedDates.includes(date)) {
    student.completedDates.push(date);
  }
  student.submissions = {
    ...student.submissions,
    [date]: submission,
  };

  await setDoc(doc(db, 'students', student.id), student);

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
      ? 'כל הכבוד! ענית נכון על כל השאלות! צברת 2 נקודות לך, לכיתה ולשכבה!'
      : `כל הכבוד על ההשתתפות! צברת ${earnedPoints} נקודה לימוד לך, לכיתה ולשכבה!`,
  };
}

export async function fetchLeaderboardApi(date: string): Promise<LeaderboardData> {
  try {
    const res = await fetch(`/api/leaderboard?date=${date}`);
    if (res.ok) {
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Falling back to direct Firestore for fetchLeaderboardApi');
  }

  const students = await getOrSeedFirestoreStudents();
  const activeStudents = students.filter(
    (s) => s.status !== 'pending' && s.status !== 'rejected'
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
    const res = await fetch('/api/prizes');
    if (res.ok) {
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Falling back to direct Firestore for fetchPrizesApi');
  }

  const students = await getOrSeedFirestoreStudents();
  const activeStudents = students.filter((s) => s.status !== 'pending' && s.status !== 'rejected');

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
    const res = await fetch('/api/students/bulk-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    password: s.password || '123',
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
    const res = await fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(student),
    });
    if (res.ok) {
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Falling back to direct Firestore for addStudentApi');
  }

  const newStudent: Student = {
    id: student.id || `s-${Date.now()}`,
    fullName: student.fullName || '',
    className: student.className || '',
    grade: (student.grade as GradeType) || 'ט',
    username: student.username || '',
    password: student.password || '123',
    points: student.points || 0,
    completedDates: [],
    submissions: {},
    status: student.status || 'approved',
  };

  await setDoc(doc(db, 'students', newStudent.id), newStudent);
  const allStudents = await getOrSeedFirestoreStudents();
  return { success: true, student: newStudent, students: allStudents };
}

export async function deleteStudentApi(id: string) {
  try {
    const res = await fetch(`/api/students/${id}`, {
      method: 'DELETE',
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

export async function saveHalachaApi(halacha: DailyHalacha) {
  try {
    const res = await fetch('/api/halachot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    const res = await fetch(`/api/halachot/${id}`, {
      method: 'DELETE',
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

export async function generateAiHalachaApi(topic: string, date: string) {
  const res = await fetch('/api/admin/generate-ai-halacha', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, date }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'נכשלה יצירת ההלכה (דורש שרת AI פעיל)');
  }
  return res.json();
}

export async function fetchInvitationsApi(): Promise<Invitation[]> {
  try {
    const res = await fetch('/api/invitations');
    if (res.ok) {
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Falling back to direct Firestore for fetchInvitationsApi');
  }

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
    return INITIAL_INVITATIONS;
  }
}

export async function createInvitationApi(invitationData: {
  className: string;
  grade: GradeType;
  maxUses: number;
  code: string;
}) {
  try {
    const res = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invitationData),
    });
    if (res.ok) {
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Falling back to direct Firestore for createInvitationApi');
  }

  const cleanCode = invitationData.code.trim().toUpperCase();
  const inv: Invitation = {
    id: `inv-${Date.now()}`,
    code: cleanCode,
    className: invitationData.className.trim(),
    grade: invitationData.grade,
    maxUses: Number(invitationData.maxUses) || 50,
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
    const res = await fetch(`/api/invitations/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Falling back to direct Firestore for deleteInvitationApi');
  }

  await deleteDoc(doc(db, 'invitations', id));
  const invitations = await fetchInvitationsApi();
  return { success: true, invitations };
}

export async function validateInvitationCodeApi(code: string): Promise<{ valid: boolean; invitation?: Invitation; error?: string }> {
  try {
    const res = await fetch(`/api/invitations/validate/${encodeURIComponent(code)}`);
    if (res.ok) {
      return await parseJsonResponse(res);
    } else {
      const data = await parseJsonResponse(res).catch(() => ({ valid: false }));
      return data;
    }
  } catch (e) {
    console.info('[API] Falling back to direct Firestore for validateInvitationCodeApi');
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

export async function registerStudentApi(studentData: {
  fullName: string;
  grade: string;
  className: string;
  username: string;
  password?: string;
  invitationCode?: string;
}) {
  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(studentData),
    });
    if (res.ok) {
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Falling back to direct Firestore for registerStudentApi');
  }

  const existingStudents = await getOrSeedFirestoreStudents();
  const trimmedUser = studentData.username.trim().toLowerCase();
  if (existingStudents.some((s) => s.username.trim().toLowerCase() === trimmedUser)) {
    throw new Error('שם המשתמש כבר תפוס, נא לבחור שם משתמש אחר');
  }

  let isAutoApproved = false;
  if (studentData.invitationCode) {
    const valRes = await validateInvitationCodeApi(studentData.invitationCode);
    if (valRes.valid && valRes.invitation) {
      isAutoApproved = true;
      const inv = valRes.invitation;
      inv.usedCount += 1;
      await setDoc(doc(db, 'invitations', inv.id), inv);
    }
  }

  const newStudent: Student = {
    id: `s-reg-${Date.now()}`,
    fullName: studentData.fullName.trim(),
    className: studentData.className.trim(),
    grade: studentData.grade as GradeType,
    username: studentData.username.trim(),
    password: studentData.password?.trim() || '123',
    points: 0,
    completedDates: [],
    submissions: {},
    status: isAutoApproved ? 'approved' : 'pending',
    registeredAt: new Date().toISOString(),
    invitationCode: studentData.invitationCode ? studentData.invitationCode.trim().toUpperCase() : undefined,
  };

  await setDoc(doc(db, 'students', newStudent.id), newStudent);

  return {
    success: true,
    autoApproved: isAutoApproved,
    message: isAutoApproved
      ? 'הרשמתך אושרה אוטומטית באמצעות קוד ההזמנה! הרי אנו מברכים אותך בהצטרפות למבצע.'
      : 'בקשת ההרשמה נקלטה בהצלחה וממתינה לאישור הנהלת האולפנה',
    student: newStudent,
  };
}

export async function approveStudentApi(id: string) {
  try {
    const res = await fetch(`/api/students/${id}/approve`, {
      method: 'POST',
    });
    if (res.ok) {
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Falling back to direct Firestore for approveStudentApi');
  }

  await updateDoc(doc(db, 'students', id), { status: 'approved' });
  const students = await getOrSeedFirestoreStudents();
  return { success: true, students };
}

export async function rejectStudentApi(id: string) {
  try {
    const res = await fetch(`/api/students/${id}/reject`, {
      method: 'POST',
    });
    if (res.ok) {
      return await parseJsonResponse(res);
    }
  } catch (e) {
    console.info('[API] Falling back to direct Firestore for rejectStudentApi');
  }

  await updateDoc(doc(db, 'students', id), { status: 'rejected' });
  const students = await getOrSeedFirestoreStudents();
  return { success: true, students };
}

export async function resetDemoApi() {
  try {
    const res = await fetch('/api/reset-demo', {
      method: 'POST',
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
