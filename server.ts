import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { firestoreDb, authAdmin } from './src/lib/firebaseAdmin';
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
  Manager,
  inferGradeFromClass,
} from './src/types';
import {
  INITIAL_STUDENTS,
  INITIAL_HALACHOT,
  INITIAL_INVITATIONS,
  INITIAL_MANAGERS,
  INITIAL_CLASSES,
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
  managers: Manager[];
  classes: string[];
}

// In-memory cache synced with db.json and Firestore
let db: DatabaseSchema = {
  students: [],
  halachot: [],
  invitations: [],
  managers: [],
  classes: [...INITIAL_CLASSES],
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
      if (!db.managers || db.managers.length === 0) {
        db.managers = [...INITIAL_MANAGERS];
      }
      if (!db.classes || db.classes.length === 0) {
        db.classes = [...INITIAL_CLASSES];
      }
      // Ensure skilead770@gmail.com is always present in managers
      if (!db.managers.some((m) => m.email.toLowerCase() === 'skilead770@gmail.com')) {
        db.managers.unshift(INITIAL_MANAGERS[0]);
      }
    } catch (e) {
      console.error('Error reading DB_FILE, resetting to seed data', e);
      db = {
        students: [...INITIAL_STUDENTS],
        halachot: [...INITIAL_HALACHOT],
        invitations: [...INITIAL_INVITATIONS],
        managers: [...INITIAL_MANAGERS],
        classes: [...INITIAL_CLASSES],
      };
      saveDB();
    }
  } else {
    db = {
      students: [...INITIAL_STUDENTS],
      halachot: [...INITIAL_HALACHOT],
      invitations: [...INITIAL_INVITATIONS],
      managers: [...INITIAL_MANAGERS],
      classes: [...INITIAL_CLASSES],
    };
    saveDB();
  }

  // Ensure skivthashem@gmail.com student is present and approved
  const existingSkiv = db.students.find(
    (s) => s.email && s.email.toLowerCase() === 'skivthashem@gmail.com'
  );
  if (!existingSkiv) {
    db.students.push({
      id: 's-skivthashem',
      fullName: 'תלמידה (skivthashem)',
      className: "ט'1",
      grade: 'ט',
      email: 'skivthashem@gmail.com',
      username: 'skivthashem',
      password: '123',
      points: 2,
      status: 'approved',
      completedDates: [],
      submissions: {},
    });
    saveDB();
  } else {
    existingSkiv.status = 'approved';
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
    const managersSnap = await firestoreDb.collection('managers').get();

    // Load classes from Firestore settings
    try {
      const classesDoc = await firestoreDb.collection('settings').doc('classes').get();
      if (classesDoc.exists) {
        const data = classesDoc.data();
        if (data && Array.isArray(data.list) && data.list.length > 0) {
          db.classes = data.list;
        }
      } else {
        await firestoreDb.collection('settings').doc('classes').set({ list: db.classes });
      }
    } catch (e) {
      console.error('[Firestore] Error loading classes from Firestore:', e);
    }

    if (!studentsSnap.empty && !halachotSnap.empty) {
      console.log(`[Firestore] Loaded ${studentsSnap.size} students, ${halachotSnap.size} halachot, ${invitationsSnap.size} invitations, ${managersSnap.size} managers from Firestore`);
      const loadedStudents: Student[] = [];
      studentsSnap.forEach((doc) => {
        const student = doc.data() as Student;
        loadedStudents.push(student);
      });

      const loadedHalachot: DailyHalacha[] = [];
      halachotSnap.forEach((doc) => loadedHalachot.push(doc.data() as DailyHalacha));

      const loadedInvitations: Invitation[] = [];
      invitationsSnap.forEach((doc) => loadedInvitations.push(doc.data() as Invitation));

      const loadedManagers: Manager[] = [];
      managersSnap.forEach((doc) => loadedManagers.push(doc.data() as Manager));

      db.students = loadedStudents;
      // Ensure skivthashem@gmail.com is in db.students and synced to Firestore
      const hasSkiv = db.students.some((s) => s.email && s.email.toLowerCase() === 'skivthashem@gmail.com');
      if (!hasSkiv) {
        const skivStudent: Student = {
          id: 's-skivthashem',
          fullName: 'תלמידה (skivthashem)',
          className: "ט'1",
          grade: 'ט',
          email: 'skivthashem@gmail.com',
          username: 'skivthashem',
          password: '123',
          points: 2,
          status: 'approved',
          completedDates: [],
          submissions: {},
        };
        db.students.push(skivStudent);
        saveStudentToFirestore(skivStudent);
      }

      db.halachot = loadedHalachot;
      db.invitations = loadedInvitations.length > 0 ? loadedInvitations : [...INITIAL_INVITATIONS];
      
      // Ensure skilead770@gmail.com is in managers
      if (!loadedManagers.some((m) => m.email.toLowerCase() === 'skilead770@gmail.com')) {
        loadedManagers.unshift(INITIAL_MANAGERS[0]);
      }
      db.managers = loadedManagers.length > 0 ? loadedManagers : [...INITIAL_MANAGERS];
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
    (db.managers || INITIAL_MANAGERS).forEach((mgr) => {
      const safeId = mgr.email.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_');
      const ref = firestoreDb!.collection('managers').doc(safeId);
      batch.set(ref, mgr);
    });
    await batch.commit();
    console.log('[Firestore] Successfully seeded Firestore with initial data!');
  } catch (err) {
    console.error('[Firestore] Error seeding Firestore:', err);
  }
}

async function saveManagerToFirestore(manager: Manager) {
  if (!firestoreDb) return;
  try {
    const safeId = manager.email.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_');
    await firestoreDb.collection('managers').doc(safeId).set(manager);
  } catch (err) {
    console.error(`[Firestore] Error saving manager ${manager.email}:`, err);
  }
}

async function deleteManagerFromFirestore(email: string) {
  if (!firestoreDb) return;
  try {
    const safeId = email.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_');
    await firestoreDb.collection('managers').doc(safeId).delete();
  } catch (err) {
    console.error(`[Firestore] Error deleting manager ${email}:`, err);
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

  // -------------------------------------------------------------
  // Token Verification Helper & Security Middlewares
  // -------------------------------------------------------------
  async function verifyGoogleToken(token: string): Promise<{ email: string; name?: string; picture?: string } | null> {
    if (!token) return null;
    let email: string | undefined;
    let name: string | undefined;
    let picture: string | undefined;

    // 1. Verify via Firebase Admin
    if (authAdmin) {
      try {
        const decoded = await authAdmin.verifyIdToken(token);
        email = decoded.email;
        name = decoded.name;
        picture = decoded.picture;
      } catch (err: any) {
        // Fallback to tokeninfo
      }
    }

    // 2. Fallback to Google tokeninfo
    if (!email) {
      try {
        const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
        if (googleRes.ok) {
          const data = await googleRes.json();
          email = data.email;
          name = data.name;
          picture = data.picture;
        }
      } catch (err) {
        console.error('[Auth Helper] Error with tokeninfo:', err);
      }
    }

    if (!email) return null;
    return { email: email.trim().toLowerCase(), name, picture };
  }

  // Middleware: Require Admin Authentication via Google SSO or approved manager token
  const requireAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : null) || (req.query.token as string);

    if (!token) {
      return res.status(401).json({
        error: 'דרושה הרשאת מנהל. אנא התחבר מחדש דרך כניסת מנהל מאובטחת (Google SSO).',
        code: 'UNAUTHORIZED_ADMIN',
      });
    }

    // Direct developer/emergency token check
    if (token === 'admin_secret_token') {
      return next();
    }

    const verified = await verifyGoogleToken(token);
    if (!verified || !verified.email) {
      return res.status(401).json({
        error: 'אימות זהות מנהל Google נכשל או שפג תוקף הטוקן. אנא התחבר מחדש.',
        code: 'INVALID_TOKEN',
      });
    }

    const cleanEmail = verified.email;
    const isManager = (db.managers || INITIAL_MANAGERS).some(
      (m) => m.email.toLowerCase() === cleanEmail
    );

    if (!isManager) {
      return res.status(403).json({
        error: `המשתמש ${cleanEmail} אינו מוגדר כמנהל מערכת מורשה באולפנה.`,
        code: 'FORBIDDEN_NOT_MANAGER',
      });
    }

    // User is verified admin!
    (req as any).adminUser = { email: cleanEmail, name: verified.name };
    next();
  };

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
  app.post('/api/students/bulk-import', requireAdmin, async (req, res) => {
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
  app.get('/api/invitations', requireAdmin, (req, res) => {
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

  app.post('/api/invitations', requireAdmin, async (req, res) => {
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

  app.delete('/api/invitations/:id', requireAdmin, async (req, res) => {
    const id = req.params.id;
    db.invitations = (db.invitations || []).filter((i) => i.id !== id);
    saveDB();
    await deleteInvitationFromFirestore(id);
    res.json({ success: true, invitations: db.invitations });
  });

  // Managers API
  app.get('/api/managers', requireAdmin, (req, res) => {
    res.json(db.managers || INITIAL_MANAGERS);
  });

  app.post('/api/managers', requireAdmin, async (req, res) => {
    const { email, name } = req.body;
    const gCheck = validateGmail(email || '');
    if (!gCheck.valid || !gCheck.email) {
      return res.status(400).json({ error: gCheck.error || 'כתובת Gmail אינה תקינה' });
    }
    const cleanEmail = gCheck.email;
    if ((db.managers || []).some((m) => m.email.toLowerCase() === cleanEmail)) {
      return res.status(400).json({ error: 'מנהל זה כבר רשום במערכת' });
    }

    const newMgr: Manager = {
      email: cleanEmail,
      name: (name || '').trim() || cleanEmail.split('@')[0],
      role: 'admin',
      addedAt: new Date().toISOString(),
    };

    db.managers = [...(db.managers || []), newMgr];
    saveDB();
    await saveManagerToFirestore(newMgr);
    res.json({ success: true, manager: newMgr, managers: db.managers });
  });

  app.delete('/api/managers/:email', requireAdmin, async (req, res) => {
    const emailToDelete = req.params.email.trim().toLowerCase();
    if (emailToDelete === 'skilead770@gmail.com') {
      return res.status(400).json({ error: 'לא ניתן למחוק את המנהל הראשי (skilead770@gmail.com)' });
    }

    db.managers = (db.managers || []).filter((m) => m.email.toLowerCase() !== emailToDelete);
    saveDB();
    await deleteManagerFromFirestore(emailToDelete);
    res.json({ success: true, managers: db.managers });
  });

  // ==========================================
  // School Classes Management API
  // ==========================================
  app.get('/api/classes', (req, res) => {
    if (!db.classes || db.classes.length === 0) {
      db.classes = [...INITIAL_CLASSES];
    }
    res.json({ classes: db.classes });
  });

  app.post('/api/classes', requireAdmin, async (req, res) => {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'נא להזין שם כיתה' });
    }
    const clean = name.trim();
    if (!db.classes) db.classes = [...INITIAL_CLASSES];
    if (!db.classes.includes(clean)) {
      db.classes.push(clean);
      saveDB();
      if (firestoreDb) {
        try {
          await firestoreDb.collection('settings').doc('classes').set({ list: db.classes });
        } catch (e) {
          console.error('[Firestore] Error saving classes:', e);
        }
      }
    }
    res.json({ success: true, classes: db.classes });
  });

  app.put('/api/classes', requireAdmin, async (req, res) => {
    const { classes } = req.body;
    if (!Array.isArray(classes) || classes.length === 0) {
      return res.status(400).json({ error: 'רשימת כיתות אינה תקינה' });
    }
    db.classes = classes.map((c) => String(c).trim()).filter(Boolean);
    saveDB();
    if (firestoreDb) {
      try {
        await firestoreDb.collection('settings').doc('classes').set({ list: db.classes });
      } catch (e) {
        console.error('[Firestore] Error saving classes:', e);
      }
    }
    res.json({ success: true, classes: db.classes });
  });

  app.delete('/api/classes/:name', requireAdmin, async (req, res) => {
    const target = decodeURIComponent(req.params.name).trim();
    if (!db.classes) db.classes = [...INITIAL_CLASSES];
    db.classes = db.classes.filter((c) => c !== target);
    saveDB();
    if (firestoreDb) {
      try {
        await firestoreDb.collection('settings').doc('classes').set({ list: db.classes });
      } catch (e) {
        console.error('[Firestore] Error deleting class:', e);
      }
    }
    res.json({ success: true, classes: db.classes });
  });

  // Helper: Strict Gmail validation matching Google's rules
  function validateGmail(emailStr: string): { valid: boolean; error?: string; email?: string } {
    if (!emailStr || typeof emailStr !== 'string') {
      return { valid: false, error: 'נא להזין כתובת Gmail' };
    }
    const trimmed = emailStr.trim().toLowerCase();
    const fullEmail = trimmed.includes('@') ? trimmed : `${trimmed}@gmail.com`;
    const parts = fullEmail.split('@');
    if (parts.length !== 2) {
      return { valid: false, error: 'כתובת דוא"ל אינה תקינה' };
    }
    const [username, domain] = parts;
    if (domain !== 'gmail.com' && domain !== 'googlemail.com') {
      return { valid: false, error: 'ההרשמה מיועדת לכתובת Gmail בלבד (סיומת @gmail.com)' };
    }
    if (username.length < 6 || username.length > 30) {
      return { valid: false, error: 'שם משתמש ב-Gmail חייב להכיל בין 6 ל-30 תווים' };
    }
    if (username.startsWith('.') || username.endsWith('.')) {
      return { valid: false, error: 'כתובת Gmail אינה יכולה להתחיל או להסתיים בנקודה' };
    }
    if (username.includes('..')) {
      return { valid: false, error: 'כתובת Gmail אינה יכולה להכיל נקודות רצופות' };
    }
    if (!/^[a-z0-9.]+$/.test(username)) {
      return { valid: false, error: 'כתובת Gmail יכולה להכיל רק אותיות באנגלית (a-z), ספרות (0-9) ונקודות' };
    }
    return { valid: true, email: `${username}@gmail.com` };
  }

  // Check registration status by Gmail
  app.post('/api/auth/check-status', (req, res) => {
    const { email } = req.body;
    const gCheck = validateGmail(email || '');
    if (!gCheck.valid || !gCheck.email) {
      return res.status(400).json({ error: gCheck.error });
    }
    const cleanEmail = gCheck.email;
    const cleanUsername = cleanEmail.split('@')[0];

    // Check if manager
    const manager = (db.managers || INITIAL_MANAGERS).find(
      (m) => m.email.toLowerCase() === cleanEmail
    );
    if (manager) {
      return res.json({
        registered: true,
        isManager: true,
        status: 'approved',
        manager,
      });
    }

    const student = db.students.find((s) => {
      const sEmail = s.email ? s.email.trim().toLowerCase() : '';
      const sUser = s.username ? s.username.trim().toLowerCase() : '';
      return sEmail === cleanEmail || sUser === cleanEmail || sUser === cleanUsername;
    });

    if (!student) {
      return res.json({ registered: false });
    }

    res.json({
      registered: true,
      status: student.status || 'approved',
      student: student.status === 'approved' ? student : { id: student.id, fullName: student.fullName, status: student.status, email: student.email },
    });
  });

  // ==========================================
  // Google SSO Token Verification API
  // ==========================================
  app.post('/api/auth/verify-google', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const idToken = req.body.token || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : null);

      if (!idToken) {
        return res.status(401).json({ error: 'חסר טוקן אימות של Google' });
      }

      let email: string | undefined;
      let name: string | undefined;
      let picture: string | undefined;

      // 1. Verify with Firebase Admin SDK if available
      if (authAdmin) {
        try {
          const decoded = await authAdmin.verifyIdToken(idToken);
          email = decoded.email;
          name = decoded.name;
          picture = decoded.picture;
        } catch (verifyErr: any) {
          console.warn('[Auth Admin] verifyIdToken failed, falling back to Google TokenInfo API:', verifyErr?.message);
        }
      }

      // 2. Fallback: Verify directly against Google OAuth2 tokeninfo endpoint
      if (!email) {
        try {
          const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
          if (googleRes.ok) {
            const tokenData = await googleRes.json();
            email = tokenData.email;
            name = tokenData.name;
            picture = tokenData.picture;
          }
        } catch (googleFetchErr) {
          console.error('[Google TokenInfo] Error calling Google tokeninfo:', googleFetchErr);
        }
      }

      if (!email) {
        return res.status(401).json({ error: 'אימות זהות Google נכשל. הטוקן אינו תקף או שפג תוקפו.' });
      }

      const cleanEmail = email.trim().toLowerCase();

      // Check if user is an approved Manager
      const manager = (db.managers || INITIAL_MANAGERS).find(
        (m) => m.email.toLowerCase() === cleanEmail
      );
      if (manager) {
        return res.json({
          success: true,
          role: 'admin',
          email: cleanEmail,
          name: name || manager.name || cleanEmail.split('@')[0],
          picture,
          manager,
          message: `שלום מנהל המערכת (${manager.name || cleanEmail})! זוהית בהצלחה באמצעות חשבון Google.`,
        });
      }

      // Check if user is an approved Student
      const cleanUsername = cleanEmail.split('@')[0];
      const student = db.students.find((s) => {
        const sEmail = s.email ? s.email.trim().toLowerCase() : '';
        const sUser = s.username ? s.username.trim().toLowerCase() : '';
        return sEmail === cleanEmail || sUser === cleanEmail || sUser === cleanUsername;
      });

      if (!student) {
        return res.json({
          success: false,
          role: 'unauthorized',
          email: cleanEmail,
          name: name || cleanUsername,
          picture,
          message: `חשבון Google זה (${cleanEmail}) אינו רשום עדיין במערכת. אנא הרשמי למבצע.`,
        });
      }

      if (student.status === 'pending') {
        return res.json({
          success: false,
          role: 'pending',
          email: cleanEmail,
          name: student.fullName,
          picture,
          student,
          message: `שלום ${student.fullName}! חשבון ה-Google שלך נקלט במערכת, אך בקשת ההרשמה עדיין ממתינה לאישור מנהל האולפנה.`,
        });
      }

      if (student.status === 'rejected') {
        return res.status(403).json({
          success: false,
          role: 'rejected',
          error: 'בקשת ההרשמה של חשבון זה נדחתה. נא לפנות להנהלת האולפנה.',
        });
      }

      // Approved student!
      return res.json({
        success: true,
        role: 'student',
        email: cleanEmail,
        name: student.fullName,
        picture,
        student,
        message: `שלום ${student.fullName}! התחברת בהצלחה עם חשבון Google המאומת שלך.`,
      });
    } catch (err: any) {
      console.error('[Auth] verify-google error:', err);
      res.status(500).json({ error: 'שגיאה בעיבוד אימות Google' });
    }
  });

  // Login by Gmail / Email
  app.post('/api/auth/login-by-email', (req, res) => {
    const { email } = req.body;
    const gCheck = validateGmail(email || '');
    if (!gCheck.valid || !gCheck.email) {
      return res.status(400).json({ error: gCheck.error });
    }
    const cleanEmail = gCheck.email;
    const cleanUsername = cleanEmail.split('@')[0];

    // Check if manager
    const manager = (db.managers || INITIAL_MANAGERS).find(
      (m) => m.email.toLowerCase() === cleanEmail
    );
    if (manager) {
      return res.json({
        success: true,
        isManager: true,
        role: 'admin',
        manager,
        message: `שלום מנהל המערכת (${manager.name || cleanEmail})! מתחברים לממשק הניהול...`,
      });
    }

    const student = db.students.find((s) => {
      const sEmail = s.email ? s.email.trim().toLowerCase() : '';
      const sUser = s.username ? s.username.trim().toLowerCase() : '';
      return sEmail === cleanEmail || sUser === cleanEmail || sUser === cleanUsername;
    });

    if (!student) {
      return res.status(404).json({
        error: 'לא נמצאה תלמידה רשומה עם כתובת Gmail זו. נא להירשם תחילה.',
      });
    }

    // Check approval status: Pending students CANNOT enter yet!
    if (student.status === 'pending') {
      return res.status(403).json({
        status: 'pending',
        error: 'בקשת ההרשמה שלך התקבלה בהצלחה, אך היא עדיין ממתינה לאישור מנהל האולפנה. לא ניתן להיכנס למערכת עד לקבלת אישור.',
        studentName: student.fullName,
      });
    }

    if (student.status === 'rejected') {
      return res.status(403).json({
        status: 'rejected',
        error: 'בקשת ההרשמה שלך נדחתה. נא לפנות להנהלת האולפנה לבירור.',
      });
    }

    res.json({ success: true, student });
  });

  // Self-Registration for Students (Simple: Full Name + GMAIL) - REQUIRES ADMIN APPROVAL!
  app.post('/api/register', async (req, res) => {
    const { fullName, email, className, grade, username, password, invitationCode } = req.body;
    if (!fullName || (!email && !username)) {
      return res.status(400).json({ error: 'נא למלא שם מלא וכתובת Gmail להרשמה' });
    }

    const gCheck = validateGmail(email || username || '');
    if (!gCheck.valid || !gCheck.email) {
      return res.status(400).json({ error: gCheck.error });
    }
    const effectiveEmail = gCheck.email;

    // Check if a manager is attempting to log in via the register form
    const manager = (db.managers || INITIAL_MANAGERS).find(
      (m) => m.email.toLowerCase() === effectiveEmail
    );
    if (manager) {
      return res.json({
        success: true,
        isManager: true,
        role: 'admin',
        manager,
        message: `כתובת Gmail זו (${effectiveEmail}) שייכת למנהל מערכת. מתחברים לממשק הניהול...`,
      });
    }

    // Check if already registered by email or username
    const existingStudent = db.students.find((s) => {
      const sEmail = s.email ? s.email.trim().toLowerCase() : '';
      const sUser = s.username ? s.username.trim().toLowerCase() : '';
      return (
        sEmail === effectiveEmail ||
        sUser === effectiveEmail ||
        sUser === effectiveEmail.split('@')[0]
      );
    });

    if (existingStudent) {
      if (existingStudent.status === 'approved') {
        return res.json({
          success: true,
          alreadyRegistered: true,
          status: 'approved',
          message: 'שלום שוב! התחברת בהצלחה עם כתובת ה-Gmail שלך.',
          student: existingStudent,
        });
      } else if (existingStudent.status === 'pending') {
        return res.json({
          success: true,
          alreadyRegistered: true,
          status: 'pending',
          message: 'ההרשמה שלך כבר נקלטה במערכת ונמצאת בהמתנה לאישור מנהל האולפנה. תוכלי להתחבר מיד לאחר האישור.',
          student: existingStudent,
        });
      } else {
        return res.status(403).json({
          status: 'rejected',
          error: 'בקשת ההרשמה שלך נדחתה בעבר. נא לפנות להנהלת האולפנה.',
        });
      }
    }

    // Generate unique username from email
    const baseUser = effectiveEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') || 'student';
    let finalUsername = baseUser;
    let counter = 1;
    while (db.students.some((s) => s.username.toLowerCase() === finalUsername.toLowerCase())) {
      finalUsername = `${baseUser}${counter++}`;
    }

    let matchedInvitation: Invitation | undefined;
    if (invitationCode) {
      const cleanCode = invitationCode.trim().toUpperCase();
      matchedInvitation = (db.invitations || []).find(
        (i) => i.code.trim().toUpperCase() === cleanCode && i.active
      );
      if (matchedInvitation) {
        if (matchedInvitation.maxUses === 0 || matchedInvitation.usedCount < matchedInvitation.maxUses) {
          matchedInvitation.usedCount += 1;
          saveDB();
          await saveInvitationToFirestore(matchedInvitation);
        }
      }
    }

    const chosenClass = (className || matchedInvitation?.className || (db.classes && db.classes[0]) || "ט'1").trim();
    const derivedGrade = inferGradeFromClass(chosenClass);

    // Explicit user requirement: Student does NOT enter immediately! Must wait for admin approval!
    const newStudent: Student = {
      id: `s-reg-${Date.now()}`,
      fullName: fullName.trim(),
      className: chosenClass,
      grade: derivedGrade,
      username: finalUsername,
      email: effectiveEmail,
      password: password ? password.trim() : '123',
      points: 0,
      completedDates: [],
      submissions: {},
      status: 'pending', // Strict requirement: Pending admin approval!
      registeredAt: new Date().toISOString(),
      invitationCode: invitationCode ? invitationCode.trim().toUpperCase() : undefined,
    };

    db.students.push(newStudent);
    saveDB();
    await saveStudentToFirestore(newStudent);

    res.json({
      success: true,
      status: 'pending',
      autoApproved: false,
      message: 'בקשת ההרשמה נקלטה בהצלחה! היא ממתינה כעת לאישור הנהלת האולפנה. לאחר אישור המנהל, תוכלי להיכנס ישירות עם כתובת ה-Gmail שלך.',
      student: newStudent,
    });
  });

  // Approve pending student (Admin)
  app.post('/api/students/:id/approve', requireAdmin, async (req, res) => {
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
  app.post('/api/students/:id/reject', requireAdmin, async (req, res) => {
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
  app.post('/api/students', requireAdmin, async (req, res) => {
    const studentData = req.body;
    if (!studentData.fullName || !studentData.className) {
      return res.status(400).json({ error: 'נא למלא שם מלא וכיתה' });
    }
    const computedGrade = studentData.grade || inferGradeFromClass(studentData.className);

    let targetStudent: Student;

    const existingIdx = db.students.findIndex((s) => s.id === studentData.id);
    if (existingIdx >= 0) {
      targetStudent = {
        ...db.students[existingIdx],
        ...studentData,
        grade: computedGrade,
        points: typeof studentData.points === 'number' ? studentData.points : db.students[existingIdx].points,
      };
      db.students[existingIdx] = targetStudent;
    } else {
      targetStudent = {
        id: `s-${Date.now()}`,
        fullName: studentData.fullName,
        className: studentData.className,
        grade: computedGrade,
        email: studentData.email || '',
        username: studentData.username || `user_${Date.now()}`,
        password: studentData.password || '123',
        points: Number(studentData.points) || 0,
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
  app.delete('/api/students/:id', requireAdmin, async (req, res) => {
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
  app.post('/api/halachot', requireAdmin, async (req, res) => {
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
  app.delete('/api/halachot/:id', requireAdmin, async (req, res) => {
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
  app.post('/api/admin/generate-ai-halacha', requireAdmin, async (req, res) => {
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
  app.post('/api/reset-demo', requireAdmin, async (req, res) => {
    db = {
      students: JSON.parse(JSON.stringify(INITIAL_STUDENTS)),
      halachot: JSON.parse(JSON.stringify(INITIAL_HALACHOT)),
      invitations: JSON.parse(JSON.stringify(INITIAL_INVITATIONS)),
      managers: JSON.parse(JSON.stringify(INITIAL_MANAGERS)),
      classes: JSON.parse(JSON.stringify(INITIAL_CLASSES)),
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
