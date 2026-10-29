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
  writeBatch,
  deleteField,
} from 'firebase/firestore';
import { auth, db } from '../firebaseClient';
import { API_BASE_URL, SUPER_ADMIN_EMAIL } from '../config';
import {
  Student,
  GradeType,
  Manager,
  DEFAULT_CLASSES,
  inferGradeFromClass,
  getStudentRegistrationDocumentId,
  Invitation,
} from '../../types';
import {
  INITIAL_STUDENTS,
  INITIAL_HALACHOT,
} from '../../data/seedData';
import { validateGmailAddress } from '../gmailValidator';
import {
  getAuthHeaders,
  parseJsonResponse,
  stripUndefinedValues,
  toPublicStudentSummary,
  invalidatePublicStudentSummariesCache,
} from './core';
import { invalidatePrizeMilestonesCache } from './prizes';

export async function fetchAllStudentRecords(): Promise<Student[]> {
  const snap = await getDocs(collection(db, 'students'));
  return snap.docs.map((studentDoc) => studentDoc.data() as Student);
}

export async function writeStudentAndPublicSummary(student: Student): Promise<void> {
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
  invalidatePublicStudentSummariesCache();
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

export async function fetchStudents(): Promise<Student[]> {
  const firebaseUser = auth.currentUser;
  const email = firebaseUser?.email?.trim().toLowerCase();
  if (!firebaseUser?.emailVerified || !email) {
    throw new Error('נדרשת התחברות מאומתת כדי לטעון את רשימת התלמידות');
  }

  try {
    const isSuperAdmin = email === SUPER_ADMIN_EMAIL.trim().toLowerCase();
    const managerSnap = isSuperAdmin
      ? { empty: false }
      : await getDocs(query(collection(db, 'managers'), where('email', '==', email)));
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
    invalidatePublicStudentSummariesCache();
    const allStudents = await fetchAllStudentRecords();
    return { success: true, students: allStudents };
  } catch (error) {
    firestoreError = error;
  }

  throw firestoreError instanceof Error
    ? firestoreError
    : new Error('לא ניתן למחוק את בקשת התלמידה. בדקי את הרשאות Firestore ונסי שוב.');
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

    invalidatePublicStudentSummariesCache();

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
  const rawInput = (studentData.email || studentData.username || '').trim();
  const gmailValidation = validateGmailAddress(rawInput);
  if (!gmailValidation.isValid || !gmailValidation.normalizedEmail) {
    throw new Error(gmailValidation.error || 'כתובת Gmail אינה תקינה');
  }
  const effectiveEmail = gmailValidation.normalizedEmail;
  const registrationDocId = getStudentRegistrationDocumentId(effectiveEmail);
  const baseUser = effectiveEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') || 'student';

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
            message: 'ההרשמה שלך כבר נקלטה וממתינה לאישור. לאחר האישור, התחברי באמצעות חשבון Google הרשום במערכת.',
            student: existing,
          };
        }
        throw new Error('בקשת ההרשמה שלך נדחתה בעבר. נא לפנות להנהלת האולפנה.');
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
      message: 'בקשת ההרשמה נקלטה בהצלחה! היא ממתינה כעת לאישור הנהלת האולפנה. לאחר האישור, התחברי באמצעות חשבון Google הרשום במערכת.',
      student: newStudent,
    };
  } catch (error: any) {
    console.info('[Registration] Direct Firestore registration attempt failed, trying fallback:', error);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(studentData),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return await parseJsonResponse(res);
      }
    } catch {
      // Ignore static Hosting HTML fallback failure
    }

    throw new Error('לא ניתן להשלים את ההרשמה. ייתכן שכבר קיימת בקשה לכתובת זו; התחברי באמצעות Google או פני למנהלת.');
  }
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
