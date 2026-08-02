import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { firestoreDb } from './src/lib/firebaseAdmin';
import {
  Student,
  DailyHalacha,
  QuizSubmission,
  LeaderboardData,
  ClassLeaderboardItem,
  GradeLeaderboardItem,
  StudentLeaderboardItem,
  PrizeReportItem,
  GradeType,
  Invitation,
} from './src/types';
import {
  INITIAL_STUDENTS,
  INITIAL_HALACHOT,
  INITIAL_INVITATIONS,
  DEFAULT_PRIZE_MILESTONES,
} from './src/data/seedData';

const PORT = 3000;
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Interface for DB file
interface DatabaseSchema {
  students: Student[];
  halachot: DailyHalacha[];
  invitations: Invitation[];
}

// In-memory cache synced with db.json and Firestore
let db: DatabaseSchema = {
  students: [],
  halachot: [],
  invitations: [],
};

// Ensure data directory and file exist
function initDB() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      db = JSON.parse(content);
      if (!db.invitations) db.invitations = [...INITIAL_INVITATIONS];
    } catch (e) {
      console.error('Error reading DB_FILE, resetting to seed data', e);
      db = {
        students: [...INITIAL_STUDENTS],
        halachot: [...INITIAL_HALACHOT],
        invitations: [...INITIAL_INVITATIONS],
      };
      saveDB();
    }
  } else {
    db = {
      students: [...INITIAL_STUDENTS],
      halachot: [...INITIAL_HALACHOT],
      invitations: [...INITIAL_INVITATIONS],
    };
    saveDB();
  }
}

function saveDB() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving DB_FILE', e);
  }
}

initDB();

async function initFirestore() {
  if (!firestoreDb) return;
  try {
    const studentsSnap = await firestoreDb.collection('students').get();
    const halachotSnap = await firestoreDb.collection('halachot').get();
    const invitationsSnap = await firestoreDb.collection('invitations').get();

    if (!studentsSnap.empty && !halachotSnap.empty) {
      console.log(`[Firestore] Loaded ${studentsSnap.size} students, ${halachotSnap.size} halachot, ${invitationsSnap.size} invitations from Firestore`);
      const loadedStudents: Student[] = [];
      studentsSnap.forEach((doc) => loadedStudents.push(doc.data() as Student));

      const loadedHalachot: DailyHalacha[] = [];
      halachotSnap.forEach((doc) => loadedHalachot.push(doc.data() as DailyHalacha));

      const loadedInvitations: Invitation[] = [];
      invitationsSnap.forEach((doc) => loadedInvitations.push(doc.data() as Invitation));

      db.students = loadedStudents;
      db.halachot = loadedHalachot;
      db.invitations = loadedInvitations.length > 0 ? loadedInvitations : [...INITIAL_INVITATIONS];
      saveDB();
    } else {
      console.log('[Firestore] Firestore collections empty, seeding initial data...');
      await seedFirestore();
    }
  } catch (err) {
    console.error('[Firestore] Sync error on init:', err);
  }
}

async function seedFirestore() {
  if (!firestoreDb) return;
  try {
    const batch = firestoreDb.batch();
    db.students.forEach((student) => {
      const ref = firestoreDb!.collection('students').doc(student.id);
      batch.set(ref, student);
    });
    db.halachot.forEach((halacha) => {
      const ref = firestoreDb!.collection('halachot').doc(halacha.id);
      batch.set(ref, halacha);
    });
    (db.invitations || INITIAL_INVITATIONS).forEach((inv) => {
      const ref = firestoreDb!.collection('invitations').doc(inv.id);
      batch.set(ref, inv);
    });
    await batch.commit();
    console.log('[Firestore] Successfully seeded Firestore with initial data!');
  } catch (err) {
    console.error('[Firestore] Error seeding Firestore:', err);
  }
}

async function saveStudentToFirestore(student: Student) {
  if (!firestoreDb) return;
  try {
    await firestoreDb.collection('students').doc(student.id).set(student);
  } catch (err) {
    console.error(`[Firestore] Error saving student ${student.id}:`, err);
  }
}

async function deleteStudentFromFirestore(id: string) {
  if (!firestoreDb) return;
  try {
    await firestoreDb.collection('students').doc(id).delete();
  } catch (err) {
    console.error(`[Firestore] Error deleting student ${id}:`, err);
  }
}

async function saveHalachaToFirestore(halacha: DailyHalacha) {
  if (!firestoreDb) return;
  try {
    await firestoreDb.collection('halachot').doc(halacha.id).set(halacha);
  } catch (err) {
    console.error(`[Firestore] Error saving halacha ${halacha.id}:`, err);
  }
}

async function deleteHalachaFromFirestore(id: string) {
  if (!firestoreDb) return;
  try {
    await firestoreDb.collection('halachot').doc(id).delete();
  } catch (err) {
    console.error(`[Firestore] Error deleting halacha ${id}:`, err);
  }
}

async function saveInvitationToFirestore(invitation: Invitation) {
  if (!firestoreDb) return;
  try {
    await firestoreDb.collection('invitations').doc(invitation.id).set(invitation);
  } catch (err) {
    console.error(`[Firestore] Error saving invitation ${invitation.id}:`, err);
  }
}

async function deleteInvitationFromFirestore(id: string) {
  if (!firestoreDb) return;
  try {
    await firestoreDb.collection('invitations').doc(id).delete();
  } catch (err) {
    console.error(`[Firestore] Error deleting invitation ${id}:`, err);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Initialize Firestore on startup
  await initFirestore();

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Get all students
  app.get('/api/students', (req, res) => {
    res.json(db.students);
  });

  // Get single student
  app.get('/api/students/:id', (req, res) => {
    const student = db.students.find((s) => s.id === req.params.id);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json(student);
  });

  // Bulk import / edit students (Admin)
  app.post('/api/students/bulk-import', async (req, res) => {
    const { students } = req.body;
    if (!Array.isArray(students)) {
      return res.status(400).json({ error: 'Invalid students array' });
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

    db.students = imported;
    saveDB();
    await seedFirestore();
    res.json({ success: true, count: imported.length, students: db.students });
  });

  // Invitations Management API
  app.get('/api/invitations', (req, res) => {
    res.json(db.invitations || []);
  });

  app.get('/api/invitations/validate/:code', (req, res) => {
    const code = req.params.code.trim().toUpperCase();
    const invitation = (db.invitations || []).find(
      (i) => i.code.trim().toUpperCase() === code && i.active
    );
    if (!invitation) {
      return res.status(404).json({ valid: false, error: 'קוד הזמנה לא קיים או שאינו פעיל' });
    }
    if (invitation.maxUses > 0 && invitation.usedCount >= invitation.maxUses) {
      return res.status(400).json({ valid: false, error: 'קוד ההזמנה הגיע למכסת השימושים המרבית' });
    }
    res.json({ valid: true, invitation });
  });

  app.post('/api/invitations', async (req, res) => {
    const { className, grade, maxUses, code } = req.body;
    if (!className || !grade || !code) {
      return res.status(400).json({ error: 'נא למלא כיתה, שכבה וקוד הזמנה' });
    }

    const cleanCode = code.trim().toUpperCase();
    let invitation: Invitation;

    const existingIdx = (db.invitations || []).findIndex(
      (i) => i.code.trim().toUpperCase() === cleanCode
    );

    if (existingIdx >= 0) {
      invitation = {
        ...db.invitations[existingIdx],
        className: className.trim(),
        grade: grade as GradeType,
        maxUses: Number(maxUses) || 50,
      };
      db.invitations[existingIdx] = invitation;
    } else {
      invitation = {
        id: `inv-${Date.now()}`,
        code: cleanCode,
        className: className.trim(),
        grade: grade as GradeType,
        maxUses: Number(maxUses) || 50,
        usedCount: 0,
        createdAt: new Date().toISOString().split('T')[0],
        active: true,
      };
      if (!db.invitations) db.invitations = [];
      db.invitations.unshift(invitation);
    }

    saveDB();
    await saveInvitationToFirestore(invitation);
    res.json({ success: true, invitation, invitations: db.invitations });
  });

  app.delete('/api/invitations/:id', async (req, res) => {
    const id = req.params.id;
    db.invitations = (db.invitations || []).filter((i) => i.id !== id);
    saveDB();
    await deleteInvitationFromFirestore(id);
    res.json({ success: true, invitations: db.invitations });
  });

  // Self-Registration for Students (Pending Admin Approval or Auto-Approved via Invitation)
  app.post('/api/register', async (req, res) => {
    const { fullName, className, grade, username, password, invitationCode } = req.body;
    if (!fullName || !className || !grade || !username || !password) {
      return res.status(400).json({ error: 'נא למלא את כל שדות החובה להרשמה' });
    }

    const trimmedUsername = username.trim().toLowerCase();
    const existingUser = db.students.find(
      (s) => s.username.trim().toLowerCase() === trimmedUsername
    );
    if (existingUser) {
      return res.status(400).json({ error: 'שם המשתמש כבר תפוס, נא לבחור שם משתמש אחר' });
    }

    let isAutoApproved = false;
    let matchedInvitation: Invitation | undefined;

    if (invitationCode) {
      const cleanCode = invitationCode.trim().toUpperCase();
      matchedInvitation = (db.invitations || []).find(
        (i) => i.code.trim().toUpperCase() === cleanCode && i.active
      );
      if (matchedInvitation) {
        if (matchedInvitation.maxUses === 0 || matchedInvitation.usedCount < matchedInvitation.maxUses) {
          isAutoApproved = true;
          matchedInvitation.usedCount += 1;
          saveDB();
          await saveInvitationToFirestore(matchedInvitation);
        }
      }
    }

    const newStudent: Student = {
      id: `s-reg-${Date.now()}`,
      fullName: fullName.trim(),
      className: className.trim(),
      grade: grade as GradeType,
      username: username.trim(),
      password: password.trim(),
      points: 0,
      completedDates: [],
      submissions: {},
      status: isAutoApproved ? 'approved' : 'pending',
      registeredAt: new Date().toISOString(),
      invitationCode: invitationCode ? invitationCode.trim().toUpperCase() : undefined,
    };

    db.students.push(newStudent);
    saveDB();
    await saveStudentToFirestore(newStudent);

    res.json({
      success: true,
      autoApproved: isAutoApproved,
      message: isAutoApproved
        ? 'הרשמתך אושרה אוטומטית באמצעות קוד ההזמנה! הרי אנו מברכים אותך בהצטרפות למבצע.'
        : 'בקשת ההרשמה נקלטה בהצלחה וממתינה לאישור הנהלת האולפנה',
      student: newStudent,
    });
  });

  // Approve pending student (Admin)
  app.post('/api/students/:id/approve', async (req, res) => {
    const student = db.students.find((s) => s.id === req.params.id);
    if (!student) {
      return res.status(404).json({ error: 'תלמידה לא נמצאה' });
    }
    student.status = 'approved';
    saveDB();
    await saveStudentToFirestore(student);
    res.json({ success: true, student, students: db.students });
  });

  // Reject / delete pending student (Admin)
  app.post('/api/students/:id/reject', async (req, res) => {
    const student = db.students.find((s) => s.id === req.params.id);
    if (!student) {
      return res.status(404).json({ error: 'תלמידה לא נמצאה' });
    }
    student.status = 'rejected';
    saveDB();
    await saveStudentToFirestore(student);
    res.json({ success: true, student, students: db.students });
  });

  // Add / edit individual student (Admin)
  app.post('/api/students', async (req, res) => {
    const studentData = req.body;
    if (!studentData.fullName || !studentData.className || !studentData.grade) {
      return res.status(400).json({ error: 'Missing required student fields' });
    }

    let targetStudent: Student;

    const existingIdx = db.students.findIndex((s) => s.id === studentData.id);
    if (existingIdx >= 0) {
      targetStudent = {
        ...db.students[existingIdx],
        ...studentData,
      };
      db.students[existingIdx] = targetStudent;
    } else {
      targetStudent = {
        id: `s-${Date.now()}`,
        fullName: studentData.fullName,
        className: studentData.className,
        grade: studentData.grade,
        username: studentData.username || `user_${Date.now()}`,
        password: studentData.password || '123',
        points: studentData.points || 0,
        completedDates: [],
        submissions: {},
        status: studentData.status || 'approved',
      };
      db.students.push(targetStudent);
    }
    saveDB();
    await saveStudentToFirestore(targetStudent);
    res.json({ success: true, students: db.students });
  });

  // Delete student
  app.delete('/api/students/:id', async (req, res) => {
    const studentId = req.params.id;
    db.students = db.students.filter((s) => s.id !== studentId);
    saveDB();
    await deleteStudentFromFirestore(studentId);
    res.json({ success: true });
  });

  // Get halachot list
  app.get('/api/halachot', (req, res) => {
    res.json(db.halachot);
  });

  // Get halacha for specific date
  app.get('/api/halachot/:date', (req, res) => {
    const requestedDate = req.params.date;
    let item = db.halachot.find((h) => h.date === requestedDate);
    if (!item && db.halachot.length > 0) {
      // Fallback to latest available if requested date doesn't exist
      item = db.halachot[0];
    }
    if (!item) {
      return res.status(404).json({ error: 'No halacha found' });
    }
    res.json(item);
  });

  // Create or Update Halacha (Admin)
  app.post('/api/halachot', async (req, res) => {
    const halacha: DailyHalacha = req.body;
    if (!halacha.date || !halacha.title || !halacha.content || !halacha.questions) {
      return res.status(400).json({ error: 'Missing required halacha fields' });
    }

    const existingIdx = db.halachot.findIndex((h) => h.date === halacha.date || h.id === halacha.id);
    if (existingIdx >= 0) {
      db.halachot[existingIdx] = halacha;
    } else {
      db.halachot.unshift(halacha); // newest first
    }
    saveDB();
    await saveHalachaToFirestore(halacha);
    res.json({ success: true, halacha });
  });

  // Delete Halacha
  app.delete('/api/halachot/:id', async (req, res) => {
    const halachaId = req.params.id;
    db.halachot = db.halachot.filter((h) => h.id !== halachaId);
    saveDB();
    await deleteHalachaFromFirestore(halachaId);
    res.json({ success: true });
  });

  // Submit Quiz endpoint (Part 2 Scoring Mechanism)
  app.post('/api/submit-quiz', async (req, res) => {
    const { studentId, date, answers } = req.body; // answers: { q1: 0, q2: 1, ... }
    if (!studentId || !date || !answers) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    const student = db.students.find((s) => s.id === studentId);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const halacha = db.halachot.find((h) => h.date === date);
    if (!halacha) {
      return res.status(404).json({ error: 'Halacha not found for this date' });
    }

    // Check if already completed today
    if (student.completedDates.includes(date)) {
      return res.status(400).json({
        error: 'כבר הגשת את החידון היומי להיום!',
        alreadyCompleted: true,
        submission: student.submissions[date],
      });
    }

    // Calculate score out of 4
    let correctCount = 0;
    halacha.questions.forEach((q) => {
      const selectedOption = answers[q.id];
      if (selectedOption !== undefined && Number(selectedOption) === q.correctOptionIndex) {
        correctCount++;
      }
    });

    // Scoring Engine Rule (Part 2):
    // Base participation: +1 point to student, class, grade
    // Bonus for 4/4 ("מצטיינת יומית"): +1 extra point to student, class, grade
    // Total: 2 points if perfect, 1 point if participation
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
    student.submissions[date] = submission;

    saveDB();
    await saveStudentToFirestore(student);

    // Check Milestone Alerts
    const milestonesReached: typeof DEFAULT_PRIZE_MILESTONES = [];
    DEFAULT_PRIZE_MILESTONES.forEach((m) => {
      if (previousPoints < m.points && newPoints >= m.points) {
        milestonesReached.push(m);
      }
    });

    res.json({
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
    });
  });

  // Leaderboard Calculation with Tie Handling
  app.get('/api/leaderboard', (req, res) => {
    const today = (req.query.date as string) || '2026-07-31';

    // 1. Student Leaderboard
    const studentItems: StudentLeaderboardItem[] = db.students.map((s) => ({
      id: s.id,
      fullName: s.fullName,
      className: s.className,
      grade: s.grade,
      points: s.points,
      completedToday: s.completedDates.includes(today),
    }));

    studentItems.sort((a, b) => b.points - a.points);

    const maxStudentPoints = studentItems.length > 0 ? studentItems[0].points : 0;
    const leadingStudents = studentItems.filter((s) => s.points === maxStudentPoints && maxStudentPoints > 0);
    leadingStudents.forEach((s) => (s.isLeading = true));

    // 2. Class League
    const classMap: Record<string, { grade: GradeType; totalPoints: number; count: number; completedToday: number }> = {};

    db.students.forEach((s) => {
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
      if (s.completedDates.includes(today)) {
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
    const leadingClasses = classLeague.filter((c) => c.totalPoints === maxClassPoints && maxClassPoints > 0);
    leadingClasses.forEach((c) => (c.isLeading = true));

    // 3. Grade League
    const gradeMap: Record<GradeType, { totalPoints: number; count: number; completedToday: number }> = {
      'ט': { totalPoints: 0, count: 0, completedToday: 0 },
      'י': { totalPoints: 0, count: 0, completedToday: 0 },
      'יא': { totalPoints: 0, count: 0, completedToday: 0 },
      'יב': { totalPoints: 0, count: 0, completedToday: 0 },
    };

    db.students.forEach((s) => {
      if (gradeMap[s.grade]) {
        gradeMap[s.grade].totalPoints += s.points;
        gradeMap[s.grade].count += 1;
        if (s.completedDates.includes(today)) {
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
    const leadingGrades = gradeLeague.filter((g) => g.totalPoints === maxGradePoints && maxGradePoints > 0);
    leadingGrades.forEach((g) => (g.isLeading = true));

    const result: LeaderboardData = {
      topStudents: studentItems,
      classLeague,
      gradeLeague,
      leadingStudents,
      leadingClasses,
      leadingGrades,
    };

    res.json(result);
  });

  // Prize Report API
  app.get('/api/prizes', (req, res) => {
    const reports: PrizeReportItem[] = db.students.map((student) => {
      const qualifyingMilestones = DEFAULT_PRIZE_MILESTONES.filter((m) => student.points >= m.points);
      const nextMilestone = DEFAULT_PRIZE_MILESTONES.find((m) => student.points < m.points) || null;
      const pointsNeeded = nextMilestone ? nextMilestone.points - student.points : 0;

      return {
        student,
        qualifyingMilestones,
        nextMilestone,
        pointsNeeded,
      };
    });

    // Sort by points descending
    reports.sort((a, b) => b.student.points - a.student.points);

    res.json({
      reports,
      milestones: DEFAULT_PRIZE_MILESTONES,
    });
  });

  // AI Halacha Generator (Gemini Integration)
  app.post('/api/admin/generate-ai-halacha', async (req, res) => {
    const { topic, date } = req.body;
    if (!topic || !date) {
      return res.status(400).json({ error: 'Topic and date are required' });
    }

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: 'GEMINI_API_KEY is not configured in process.env',
        });
      }

      const ai = new GoogleGenAI({ apiKey });
      const prompt = `צור תוכן הלכתי יומי חגיגי, קריא, קולע ומעורר השראה עבור אולפנה (תלמידות תיכון) המבוסס באופן מובהק על סדרת הספרים "אהלי הלכה" (מאת הרב מאיר בראלי שליט"א, בנשיאות מרן הרב יעקב אריאל שליט"א).
הנושא המבוקש: "${topic}" לתאריך: ${date}.

הפלט חייב להיות בפורמט JSON בלבד במבנה הבא:
{
  "title": "כותרת קולעת ומזמינה להלכה",
  "topic": "${topic}",
  "source": "סדרת אהלי הלכה - מאת הרב מאיר בראלי (בנשיאות הרב יעקב אריאל)",
  "content": "תוכן ההלכה היומית מתוך ספר אהלי הלכה בעברית יפה, בהירה, מותאמת לבנות אולפנה (3-4 פסקאות קצרות)",
  "questions": [
    {
      "id": "q1",
      "text": "שאלה אמריקאית 1 בודקת הבנה לפי אהלי הלכה",
      "options": ["תשובה 1", "תשובה 2", "תשובה 3", "תשובה 4"],
      "correctOptionIndex": 0,
      "explanation": "הסבר קצר מדוע תשובה זו נכונה לפי ספר אהלי הלכה"
    },
    {
      "id": "q2",
      "text": "שאלה אמריקאית 2 בודקת הבנה",
      "options": ["תשובה 1", "תשובה 2", "תשובה 3", "תשובה 4"],
      "correctOptionIndex": 1,
      "explanation": "הסבר קצר מדוע תשובה זו נכונה לפי ספר אהלי הלכה"
    },
    {
      "id": "q3",
      "text": "שאלה אמריקאית 3 בודקת הבנה",
      "options": ["תשובה 1", "תשובה 2", "תשובה 3", "תשובה 4"],
      "correctOptionIndex": 2,
      "explanation": "הסבר קצר מדוע תשובה זו נכונה לפי ספר אהלי הלכה"
    },
    {
      "id": "q4",
      "text": "שאלה אמריקאית 4 בודקת הבנה",
      "options": ["תשובה 1", "תשובה 2", "תשובה 3", "תשובה 4"],
      "correctOptionIndex": 3,
      "explanation": "הסבר קצר מדוע תשובה זו נכונה לפי ספר אהלי הלכה"
    }
  ]
}

ודא שכל 4 השאלות מכילות בדיוק 4 אפשרויות בתשובות, והאינדקס correctOptionIndex הוא בין 0 ל-3. אל תוסיף שום טקסט מחוץ ל-JSON.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const responseText = response.text || '';
      // Clean possible markdown code blocks ```json ... ```
      const cleanedJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedData = JSON.parse(cleanedJson);

      const newHalacha: DailyHalacha = {
        id: `halacha-${date}-${Date.now()}`,
        date,
        title: parsedData.title,
        topic: parsedData.topic || topic,
        source: parsedData.source || 'סדרת אהלי הלכה - מאת הרב מאיר בראלי (בנשיאות הרב יעקב אריאל שליט"א)',
        content: parsedData.content,
        questions: parsedData.questions,
      };

      // Upsert into DB
      const existingIdx = db.halachot.findIndex((h) => h.date === date);
      if (existingIdx >= 0) {
        db.halachot[existingIdx] = newHalacha;
      } else {
        db.halachot.unshift(newHalacha);
      }
      saveDB();
      await saveHalachaToFirestore(newHalacha);

      res.json({ success: true, halacha: newHalacha });
    } catch (e: any) {
      console.error('Gemini AI Generation Error:', e);
      res.status(500).json({ error: e?.message || 'נכשלה יצירת ההלכה באמצעות AI' });
    }
  });

  // Reset Demo Data
  app.post('/api/reset-demo', async (req, res) => {
    db = {
      students: JSON.parse(JSON.stringify(INITIAL_STUDENTS)),
      halachot: JSON.parse(JSON.stringify(INITIAL_HALACHOT)),
      invitations: JSON.parse(JSON.stringify(INITIAL_INVITATIONS)),
    };
    saveDB();
    await seedFirestore();
    res.json({ success: true, message: 'הנתונים אופסו בהצלחה למצב ההתחלתי!' });
  });

  // Vite Development / Static Production Setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
