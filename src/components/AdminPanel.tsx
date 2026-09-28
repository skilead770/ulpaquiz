import React, { useState } from 'react';
import { HDate, calendar, getHolidaysOnDate, months } from '@hebcal/core';
import {
  FileSpreadsheet,
  BookOpen,
  Award,
  Plus,
  Trash2,
  Edit,
  Sparkles,
  Search,
  CheckCircle2,
  Crown,
  Trophy,
  Users,
  GraduationCap,
  Calendar,
  Save,
  Wand2,
  AlertCircle,
  ClipboardCheck,
  UserPlus,
  UserCheck,
  Clock,
  Check,
  X,
  Mail,
} from 'lucide-react';
import {
  Student,
  DailyHalacha,
  PrizeReportItem,
  Question,
  GradeType,
  Manager,
  DEFAULT_CLASSES,
  inferGradeFromClass,
} from '../types';
import { SUPER_ADMIN_EMAIL, API_BASE_URL } from '../lib/config';
import { ExcelUploader } from './ExcelUploader';
import {
  bulkImportStudentsApi,
  saveHalachaApi,
  deleteHalachaApi,
  generateAiHalachaApi,
  bulkImportHalachotApi,
  parseDocContentApi,
  addStudentApi,
  deleteStudentApi,
  approveStudentApi,
  rejectStudentApi,
  fetchManagersApi,
  addManagerApi,
  deleteManagerApi,
  fetchClassesApi,
  addClassApi,
  deleteClassApi,
} from '../lib/api';
import { Shield, UserCog, ShieldCheck, RefreshCw, FileText, UploadCloud, ExternalLink, FileUp } from 'lucide-react';
import { signInWithGoogleSSO } from '../lib/authService';
import { ULPANA_LOGO_URL } from '../assets/logo';
import { getTodayInJerusalem } from '../lib/quizSchedule';

interface AdminPanelProps {
  students: Student[];
  halachot: DailyHalacha[];
  prizeReports: PrizeReportItem[];
  onRefreshData: () => void;
  onManagerQuiz: () => Promise<void>;
}

const hebrewWeekdays = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const halachaHebrewYear = 5787;
const halachaHebrewYearText = 'תשפ״ז';
const hebcalEventsByYear = new Map<number, ReturnType<typeof calendar>>();

function stripHebrewVowels(value: string) {
  return value.replace(/[\u0591-\u05C7]/g, '').trim();
}

function hebrewDayNumber(day: number) {
  const units = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  if (day === 15) return 'טו';
  if (day === 16) return 'טז';
  if (day < 10) return units[day];
  if (day < 20) return `י${units[day - 10]}`;
  if (day === 30) return 'ל';
  return `כ${units[day - 20]}`;
}

function getHebcalEventsForYear(year: number) {
  let events = hebcalEventsByYear.get(year);
  if (!events) {
    events = calendar({ year, isHebrewYear: true, il: true, sedrot: true });
    hebcalEventsByYear.set(year, events);
  }
  return events;
}

function makeHebrewCalendarEntry(date: HDate, halacha: DailyHalacha | null) {
  const parshaEvent = getHebcalEventsForYear(date.getFullYear()).find(
    (event) => event.getDate().abs() === date.abs() && event.getDesc().startsWith('Parashat ')
  );
  const holidayNames = (getHolidaysOnDate(date, true) || []).map((event) =>
    stripHebrewVowels(event.render('he'))
  );

  return {
    halacha,
    date,
    monthKey: `${date.getFullYear()}-${date.getMonth()}`,
    dayLabel: hebrewDayNumber(date.getDate()),
    weekday: hebrewWeekdays[date.getDay()],
    parsha: parshaEvent ? stripHebrewVowels(parshaEvent.render('he')) : '',
    holidayNames: Array.from(new Set(holidayNames)),
  };
}

function makeHebrewDateEntry(halacha: DailyHalacha) {
  try {
    const parsedHeading = parseDocumentHebrewHeading(halacha.hebrewDate || '');
    if (!parsedHeading || parsedHeading.date.getFullYear() !== halachaHebrewYear) return null;
    return makeHebrewCalendarEntry(parsedHeading.date, halacha);
  } catch {
    return null;
  }
}

function parseDocumentHebrewHeading(line: string) {
  const heading = line.replace(/\*/g, '').replace(/^[#*-]\s*/, '').trim();
  const weekdayMatch = heading.match(/^(?:יום\s+)?(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)(?:\s|$)/);
  const dateHeading = heading.replace(/^(?:יום\s+)?(?:ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)\s+/, '');
  const dateMatch = dateHeading.match(
    /^([א-ת][א-ת״׳"']*)\s+(?:ב)?(תשרי|מרחשוון|מרחשון|חשוון|חשון|כסלו|טבת|שבט|אדר\s*[אב](?:[״׳"']?)?|ניסן|אייר|סיון|סיוון|תמוז|אב|אלול)(?=$|[\s,])/u
  );

  if (!dateMatch) return null;

  const dateText = dateMatch[0].trim().replace(/"/g, '״').replace(/'/g, '׳');
  let date: HDate;
  try {
    date = HDate.fromGematriyaString(`${dateText} ${halachaHebrewYearText}`);
  } catch {
    return null;
  }

  const calendarWeekday = hebrewWeekdays[date.getDay()];
  const hasShabbatLabel = /(?:^|[\s,])שבת(?:\s|$)/.test(heading);
  if (hasShabbatLabel && calendarWeekday !== 'שבת') {
    throw new Error(
      `אי התאמה בכותרת "${heading}": התאריך לפי לוח תשפ״ז חל ביום ${calendarWeekday}, אך הכותרת מציינת שבת ופרשה.`
    );
  }

  const weekdayCorrection = weekdayMatch && weekdayMatch[1] !== calendarWeekday
    ? `${weekdayMatch[1]} → ${calendarWeekday}`
    : '';
  const normalizedHeading = weekdayCorrection
    ? heading.replace(/^(יום\s+)?(?:ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)(?=\s)/, (_, prefix = '') => `${prefix}${calendarWeekday}`)
    : heading;

  const gregorianParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date.greg());
  const gregorianDate = ['year', 'month', 'day']
    .map((part) => gregorianParts.find((value) => value.type === part)?.value)
    .join('-');

  return { date, gregorianDate, heading: normalizedHeading, weekdayCorrection };
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  students,
  halachot,
  prizeReports,
  onRefreshData,
  onManagerQuiz,
}) => {
  const [activeAdminTab, setActiveAdminTab] = useState<
    'halachot' | 'hebrew-date' | 'students' | 'prizes' | 'managers' | 'classes'
  >('halachot');

  const sortedHalachot = React.useMemo(
    () => [...halachot].sort((a, b) => a.date.localeCompare(b.date)),
    [halachot]
  );

  const hebrewDateEntries = React.useMemo(
    () => {
      const parsedEntries = sortedHalachot
        .map(makeHebrewDateEntry)
        .filter((entry) => entry !== null && entry.date.getFullYear() === halachaHebrewYear);
      const uniqueByHebrewDate = new Map<number, (typeof parsedEntries)[number]>();
      parsedEntries.forEach((entry) => uniqueByHebrewDate.set(entry.date.abs(), entry));
      return Array.from(uniqueByHebrewDate.values()).sort((a, b) => a.date.abs() - b.date.abs());
    },
    [sortedHalachot]
  );

  const monthOptions = React.useMemo(() => {
    const year = halachaHebrewYear;
    const monthOrder = [
      months.TISHREI,
      months.CHESHVAN,
      months.KISLEV,
      months.TEVET,
      months.SHVAT,
      months.ADAR_I,
      ...(HDate.isLeapYear(year) ? [months.ADAR_II] : []),
      months.NISAN,
      months.IYYAR,
      months.SIVAN,
      months.TAMUZ,
      months.AV,
      months.ELUL,
    ];

    return monthOrder.map((month) => {
      const firstDay = new HDate(1, month, year);
      return {
        key: `${year}-${month}`,
        label: stripHebrewVowels(
          new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { month: 'long' }).format(firstDay.greg())
        ).replace(/[׳״'\"]/g, ''),
      };
    });
  }, []);

  const currentHebrewDate = new HDate(new Date());
  const currentMonthKey = `${currentHebrewDate.getFullYear()}-${currentHebrewDate.getMonth()}`;
  const [selectedMonthKey, setSelectedMonthKey] = useState('');

  const [selectedHebrewDateAbs, setSelectedHebrewDateAbs] = useState<number | null>(null);

  React.useEffect(() => {
    if (!monthOptions.length) {
      setSelectedMonthKey('');
      return;
    }

    setSelectedMonthKey((current) => {
      if (current && monthOptions.some((month) => month.key === current)) return current;
      return monthOptions.find((month) => month.key === currentMonthKey)?.key || monthOptions[0].key;
    });
  }, [monthOptions, currentMonthKey]);

  const selectedMonthDays = React.useMemo(
    () => {
      const monthNumber = Number(selectedMonthKey.split('-')[1]);
      if (!monthNumber) return [];

      const halachotByHebrewDate = new Map<number, DailyHalacha>();
      hebrewDateEntries.forEach((entry) => halachotByHebrewDate.set(entry.date.abs(), entry.halacha));

      const firstDay = new HDate(1, monthNumber, halachaHebrewYear);
      return Array.from({ length: firstDay.daysInMonth() }, (_, index) => {
        const date = new HDate(index + 1, monthNumber, halachaHebrewYear);
        return makeHebrewCalendarEntry(date, halachotByHebrewDate.get(date.abs()) || null);
      });
    },
    [hebrewDateEntries, selectedMonthKey]
  );

  React.useEffect(() => {
    if (!selectedMonthDays.length) {
      setSelectedHebrewDateAbs(null);
      return;
    }

    setSelectedHebrewDateAbs((current) => {
      if (current !== null && selectedMonthDays.some((entry) => entry.date.abs() === current)) return current;
      const firstDayWithHalacha = selectedMonthDays.find((entry) => entry.halacha);
      return firstDayWithHalacha?.date.abs() ?? selectedMonthDays[0].date.abs();
    });
  }, [selectedMonthDays]);

  const selectedEntry = selectedMonthDays.find((entry) => entry.date.abs() === selectedHebrewDateAbs)
    || selectedMonthDays[0]
    || null;
  const selectedHalacha = selectedEntry?.halacha || null;

  // School Classes Management State
  const [classesList, setClassesList] = useState<string[]>(DEFAULT_CLASSES);
  const [newClassName, setNewClassName] = useState('');
  const [isAddingClass, setIsAddingClass] = useState(false);
  const [classMsg, setClassMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  React.useEffect(() => {
    fetchClassesApi().then((list) => {
      if (list && list.length > 0) setClassesList(list);
    });
  }, []);

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    setIsAddingClass(true);
    setClassMsg(null);
    try {
      const updated = await addClassApi(newClassName.trim());
      setClassesList(updated);
      setNewClassName('');
      setClassMsg({ type: 'success', text: `הכיתה "${newClassName.trim()}" נוספה בהצלחה!` });
    } catch (err: any) {
      setClassMsg({ type: 'error', text: err.message || 'שגיאה בהוספת כיתה' });
    } finally {
      setIsAddingClass(false);
    }
  };

  const handleDeleteClass = async (classNameToDelete: string) => {
    const studentsInClass = students.filter((s) => s.className === classNameToDelete).length;
    let confirmMsg = `האם למחוק את הכיתה "${classNameToDelete}" מרשימת הכיתות?`;
    if (studentsInClass > 0) {
      confirmMsg += `\nשים לב: ישנן ${studentsInClass} תלמידות המשויכות כרגע לכיתה זו.`;
    }
    if (confirm(confirmMsg)) {
      try {
        const updated = await deleteClassApi(classNameToDelete);
        setClassesList(updated);
        setClassMsg({ type: 'success', text: `הכיתה "${classNameToDelete}" הוסרה בהצלחה!` });
      } catch (err: any) {
        setClassMsg({ type: 'error', text: err.message || 'שגיאה במחיקת כיתה' });
      }
    }
  };

  // Managers State
  const [managers, setManagers] = useState<Manager[]>([]);
  const [newManagerEmail, setNewManagerEmail] = useState('');
  const [newManagerName, setNewManagerName] = useState('');
  const [isAddingManager, setIsAddingManager] = useState(false);
  const [managerMsg, setManagerMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isStartingManagerQuiz, setIsStartingManagerQuiz] = useState(false);
  const [managerQuizError, setManagerQuizError] = useState<string | null>(null);

  React.useEffect(() => {
    fetchManagersApi().then((list) => setManagers(list));
  }, []);

  const handleAddManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newManagerEmail.trim()) return;
    setIsAddingManager(true);
    setManagerMsg(null);
    try {
      const res = await addManagerApi(newManagerEmail.trim(), newManagerName.trim());
      setManagers(res.managers);
      setNewManagerEmail('');
      setNewManagerName('');
      setManagerMsg({ type: 'success', text: 'מנהל/ת חדש/ה נוסף/ה בהצלחה למערכת!' });
    } catch (err: any) {
      setManagerMsg({ type: 'error', text: err.message || 'שגיאה בהוספת מנהל' });
    } finally {
      setIsAddingManager(false);
    }
  };

  const handleDeleteManager = async (email: string) => {
    if (confirm(`האם להסיר את הרשאות הניהול מכתובת ${email}?`)) {
      try {
        const res = await deleteManagerApi(email);
        setManagers(res.managers);
        setManagerMsg({ type: 'success', text: 'הרשאות הניהול הוסרו בהצלחה' });
      } catch (err: any) {
        setManagerMsg({ type: 'error', text: err.message || 'שגיאה בהסרת מנהל' });
      }
    }
  };

  const handleStartManagerQuiz = async () => {
    setIsStartingManagerQuiz(true);
    setManagerQuizError(null);
    try {
      await onManagerQuiz();
    } catch (err: any) {
      setManagerQuizError(err?.message || 'לא ניתן לפתוח את החידון');
    } finally {
      setIsStartingManagerQuiz(false);
    }
  };

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshData();
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  React.useEffect(() => {
    if (activeAdminTab === 'students') {
      onRefreshData();
    }
  }, [activeAdminTab]);

  // Student Search / Filter State
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [studentFilterClass, setStudentFilterClass] = useState<string>('ALL');

  // Manual Add Student State
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [newStudent, setNewStudent] = useState<{
    fullName: string;
    grade: GradeType;
    className: string;
    username: string;
    points: number;
  }>({
    fullName: '',
    grade: 'ט',
    className: "ט'1",
    username: '',
    points: 0,
  });
  const [isSavingStudent, setIsSavingStudent] = useState(false);
  const [studentError, setStudentError] = useState<string | null>(null);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.fullName.trim() || !newStudent.className.trim()) {
      setStudentError('נא למלא שם מלא וכיתה');
      return;
    }
    setIsSavingStudent(true);
    setStudentError(null);
    try {
      await addStudentApi({
        fullName: newStudent.fullName.trim(),
        grade: newStudent.grade,
        className: newStudent.className.trim(),
        username: newStudent.username.trim() || undefined,
        points: Number(newStudent.points) || 0,
      });
      setIsAddStudentModalOpen(false);
      setNewStudent({
        fullName: '',
        grade: 'ט',
        className: "ט'1",
        username: '',
        points: 0,
      });
      onRefreshData();
    } catch (err: any) {
      console.error(err);
      setStudentError(err?.message || 'אירעה שגיאה בהוספת התלמידה');
    } finally {
      setIsSavingStudent(false);
    }
  };

  const handleDeleteStudent = async (studentId: string, studentName: string) => {
    if (confirm(`האם למחוק את התלמידה "${studentName}"?`)) {
      try {
        await deleteStudentApi(studentId);
        onRefreshData();
      } catch (err) {
        console.error(err);
        alert('נכשלה מחיקת התלמידה');
      }
    }
  };

  const handleApproveStudent = async (studentId: string) => {
    try {
      await approveStudentApi(studentId);
      onRefreshData();
    } catch (err) {
      console.error(err);
      alert('נכשל אישור התלמידה');
    }
  };

  const handleRejectStudent = async (studentId: string, studentName: string) => {
    if (confirm(`האם לדחות ולמחוק את בקשת ההרשמה של "${studentName}"?`)) {
      try {
        await rejectStudentApi(studentId);
        onRefreshData();
      } catch (err) {
        console.error(err);
        alert('נכשלה דחיית התלמידה');
      }
    }
  };

  const pendingStudents = students.filter((s) => s.status === 'pending');

  // Edit Student Modal State
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isUpdatingStudent, setIsUpdatingStudent] = useState(false);
  const [editStudentError, setEditStudentError] = useState<string | null>(null);

  const handleOpenEditStudent = (s: Student) => {
    setEditingStudent({ ...s });
    setEditStudentError(null);
  };

  const handleSaveEditedStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    if (!editingStudent.fullName.trim() || !editingStudent.className.trim()) {
      setEditStudentError('נא למלא שם מלא וכיתה');
      return;
    }
    setIsUpdatingStudent(true);
    setEditStudentError(null);
    try {
      await addStudentApi({
        id: editingStudent.id,
        fullName: editingStudent.fullName.trim(),
        email: editingStudent.email?.trim() || undefined,
        grade: editingStudent.grade,
        className: editingStudent.className.trim(),
        username: editingStudent.username,
        password: editingStudent.password,
        points: Number(editingStudent.points) || 0,
        status: editingStudent.status || 'approved',
      });
      setEditingStudent(null);
      onRefreshData();
    } catch (err: any) {
      console.error(err);
      setEditStudentError(err?.message || 'אירעה שגיאה בעדכון פרטי התלמידה');
    } finally {
      setIsUpdatingStudent(false);
    }
  };

  // AI Generation Form State
  const [aiTopic, setAiTopic] = useState('');
  const [aiDate, setAiDate] = useState('2026-08-01');
  const [aiHebrewDate, setAiHebrewDate] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiMsg, setAiMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // AI Questions from Content State
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [questionsAiError, setQuestionsAiError] = useState<string | null>(null);

  // Google Doc / Text Import for Jewish Year תשפ"ז Halachot
  const [docUrlInput, setDocUrlInput] = useState('https://docs.google.com/document/d/1bCtPEwggxRD_R8aOnlCe5HBGEDu09jCgSfZUnPVuazs/edit?usp=drive_link');
  const [docRawTextInput, setDocRawTextInput] = useState('');
  const [isImportingDoc, setIsImportingDoc] = useState(false);
  const [importDocMsg, setImportDocMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [showDocImportBox, setShowDocImportBox] = useState(true);

  // Function to extract Doc ID from URL
  const extractDocId = (url: string) => {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  };

  // Connect Google Drive and read document directly
  const handleFetchFromGoogleDrive = async () => {
    setIsImportingDoc(true);
    setImportDocMsg({ type: 'info', text: 'מתחבר ל-Google Drive ומאחזר את מסמך ההלכות...' });

    try {
      setImportDocMsg({ type: 'info', text: 'נא לאשר גישה ל-Google Drive בחלון של Google...' });
      const { accessToken } = await signInWithGoogleSSO(true);

      if (!accessToken) {
        throw new Error('לא התקבל טוקן גישה מ-Google. נא לנסות שוב או להדביק את הטקסט ישירות.');
      }

      const docId = extractDocId(docUrlInput) || '1bCtPEwggxRD_R8aOnlCe5HBGEDu09jCgSfZUnPVuazs';
      let extractedText = '';

      // 1. Try Google Docs export (FIXED: removed the broken charset string parameter)
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${docId}/export?mimeType=text/plain`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (res.ok) {
        // Safe cross-platform text decoding to prevent Hebrew layout distortion
        const buffer = await res.arrayBuffer();
        extractedText = new TextDecoder('utf-8').decode(buffer);
      } else if (res.status === 400) {
        // Uploaded Word documents cannot use the Google Docs export endpoint.
        const resAlt = await fetch(`https://www.googleapis.com/drive/v3/files/${docId}?alt=media`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!resAlt.ok) {
          const details = await resAlt.text();
          throw new Error(`שגיאה בטעינת הקובץ מ-Google Drive (קוד: ${resAlt.status}): ${details.slice(0, 300)}`);
        }

        const arrayBuf = await resAlt.arrayBuffer();
        setImportDocMsg({ type: 'info', text: 'מפענח את מסמך ה-Word/Docx העברי...' });
        const parseRes = await parseDocContentApi(arrayBuf);
        extractedText = parseRes.text || '';
      } else {
        const details = await res.text();
        throw new Error(`Google Drive לא הצליח לייצא את המסמך כטקסט (קוד: ${res.status}): ${details.slice(0, 300)}`);
      }

      if (!extractedText || !extractedText.trim()) {
        throw new Error('לא נמצא טקסט קריא במסמך. ניתן לפתוח את המסמך, לסמן הכל (Ctrl+A), להעתיק ולהדביק בתיבת הטקסט.');
      }

      setDocRawTextInput(extractedText);
      await parseAndImportHalachotText(extractedText);
    } catch (err: any) {
      console.error('Google Drive Doc error:', err);
      setImportDocMsg({
        type: 'error',
        text: err?.message || 'לא ניתן היה לקרוא ישירות את המסמך מ-Drive. באפשרותך להדביק את תוכן המסמך בתיבה למטה וללחוץ על יבוא.',
      });
    } finally {
      setIsImportingDoc(false);
    }
  };

  // Parser: takes doc text and converts sections into Halachot
  const parseAndImportHalachotText = async (text: string) => {
    if (!text || !text.trim()) {
      setImportDocMsg({ type: 'error', text: 'המסמך ריק או שלא זוהה טקסט' });
      return;
    }

    setIsImportingDoc(true);
    setImportDocMsg({ type: 'info', text: 'מנתח את ההלכות והתאריכים העבריים של שנת תשפ"ז מתוך המסמך...' });

    try {
      // Split into sections by Hebrew dates, day headers, or double newlines
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
      const parsedItems: Partial<DailyHalacha>[] = [];

      let currentHebrewDate = '';
      let currentTitle = '';
      let currentContent: string[] = [];
      const weekdayCorrections: string[] = [];

      const flushCurrent = () => {
        if (currentHebrewDate && (currentContent.length > 0 || currentTitle)) {
          const parsedHeading = parseDocumentHebrewHeading(currentHebrewDate);
          if (!parsedHeading) {
            throw new Error(`לא ניתן לזהות תאריך עברי בכותרת: "${currentHebrewDate}"`);
          }
          if (parsedHeading.weekdayCorrection) {
            weekdayCorrections.push(`${currentHebrewDate} (${parsedHeading.weekdayCorrection})`);
          }

          const finalTitle = currentTitle || `הלכה יומית - ${parsedHeading.heading}`;
          const existingHalacha = halachot.find(
            (halacha) => halacha.hebrewDate?.trim() === parsedHeading.heading
          );

          parsedItems.push({
            id: `halacha-doc-${parsedHeading.gregorianDate}`,
            date: parsedHeading.gregorianDate,
            hebrewDate: parsedHeading.heading,
            title: finalTitle,
            topic: 'הלכות תשפ"ז מתוך אהלי הלכה',
            source: 'סדרת אהלי הלכה - על פי פסקי הלכה של הגאון הרב יעקב אריאל שליט"א',
            content: currentContent.join('\n\n') || currentTitle,
            questions: existingHalacha?.questions || [
              {
                id: 'q1',
                text: `לפי המבואר ב${finalTitle}, מהי ההלכה העיקרית?`,
                options: ['כפי שנפסק להלכה באהלי הלכה', 'יש להחמיר מעבר לכך', 'אין חיוב כלל', 'תלוי במנהג המקום בלבד'],
                correctOptionIndex: 0,
                explanation: 'על פי פסקי הלכה של הגאון הרב יעקב אריאל שליט"א בספר אהלי הלכה.'
              },
              {
                id: 'q2',
                text: 'כיצד על בנות האולפנה לנהוג לכתחילה?',
                options: ['לשמור על ההלכה מתוך שמחה ודיוק', 'בדיעבד בלבד', 'אין צורך לדייק', 'רק בימי חג'],
                correctOptionIndex: 0,
                explanation: 'לימוד הלכה יומית מביא לידי מעשה נכון.'
              },
              {
                id: 'q3',
                text: 'מה המקור לפסק זה?',
                options: ['סדרת אהלי הלכה - הרב יעקב אריאל שליט"א', 'סברא בעלמא', 'דעת יחיד שנדחתה', 'מנהג שאינו מחייב'],
                correctOptionIndex: 0,
                explanation: 'פסקי מרן הרב יעקב אריאל שליט"א.'
              },
              {
                id: 'q4',
                text: 'מהי חשיבות הלימוד היומי לחידון תשפ"ז?',
                options: ['הבנת ההלכה וצבירת נקודות אישיות וכיתתיות', 'מבחן בלבד', 'קריאה ללא הבנה', 'שום דבר מיוחד'],
                correctOptionIndex: 0,
                explanation: 'החידון השנתי של האולפנה מעודד לימוד יומיומי והעמקה בהלכה.'
              }
            ]
          });
        }
        currentContent = [];
        currentTitle = '';
      };

      for (const line of lines) {
        if (parseDocumentHebrewHeading(line)) {
          flushCurrent();
          currentHebrewDate = line.replace(/\*/g, '').replace(/^[#*-]\s*/, '').trim();
        } else if (/^חודש\s+/.test(line)) {
          continue;
        } else if (!currentTitle && (line.length < 80 || line.startsWith('הלכה') || line.startsWith('נושא'))) {
          currentTitle = line.replace(/^[#*-]\s*/, '').trim();
        } else {
          currentContent.push(line);
        }
      }
      flushCurrent();

      if (parsedItems.length === 0) {
          throw new Error('לא זוהו במסמך כותרות תאריך עברי תקינות לשנת תשפ״ז. לא יובאו נתונים.');
      }

      // Save via API
      const res = await bulkImportHalachotApi(parsedItems);
      setImportDocMsg({
        type: 'success',
        text: `סונכרנו ${parsedItems.length} הלכות לשנת תשפ"ז: ${res.addedCount || 0} חדשות ו-${res.updatedCount || 0} עודכנו.${weekdayCorrections.length ? ` תוקנו ${weekdayCorrections.length} תוויות יום לפי הלוח, למשל: ${weekdayCorrections.slice(0, 3).join('; ')}.` : ''}`,
      });
      onRefreshData();
    } catch (e: any) {
      console.error(e);
      setImportDocMsg({
        type: 'error',
        text: e?.message || 'שגיאה בניתוח ויבוא תוכן ההלכות מתוך המסמך',
      });
    } finally {
      setIsImportingDoc(false);
    }
  };

  // Halacha Edit Modal / Form State
  const [editingHalacha, setEditingHalacha] = useState<DailyHalacha | null>(null);
  const [isSavingHalacha, setIsSavingHalacha] = useState(false);
  const [editingHebrewDateQuiz, setEditingHebrewDateQuiz] = useState<DailyHalacha | null>(null);
  const [isSavingHebrewDateQuiz, setIsSavingHebrewDateQuiz] = useState(false);
  const [hebrewDateQuizError, setHebrewDateQuizError] = useState<string | null>(null);

  const cloneHalachaForEditing = (halacha: DailyHalacha): DailyHalacha => ({
      ...halacha,
      questions: halacha.questions.map((question) => ({
        ...question,
        options: [...question.options] as Question['options'],
      })) as DailyHalacha['questions'],
  });

  const openHalachaEditor = (halacha: DailyHalacha) => {
    setEditingHalacha(cloneHalachaForEditing(halacha));
  };

  const updateHebrewDateQuestion = (
    questionIndex: number,
    update: (question: Question) => Question
  ) => {
    setEditingHebrewDateQuiz((current) => {
      if (!current) return current;
      const questions = current.questions.map((question, index) =>
        index === questionIndex
          ? update({ ...question, options: [...question.options] as Question['options'] })
          : question
      ) as DailyHalacha['questions'];
      return { ...current, questions };
    });
  };

  const handleSaveHebrewDateQuiz = async () => {
    if (!editingHebrewDateQuiz) return;
    setIsSavingHebrewDateQuiz(true);
    setHebrewDateQuizError(null);
    try {
      await saveHalachaApi(editingHebrewDateQuiz);
      setEditingHebrewDateQuiz(null);
      onRefreshData();
    } catch (error: any) {
      setHebrewDateQuizError(error?.message || 'שמירת השאלות והתשובות נכשלה');
    } finally {
      setIsSavingHebrewDateQuiz(false);
    }
  };

  // New Halacha Template
  const createBlankHalacha = (): DailyHalacha => ({
    id: `halacha-${Date.now()}`,
    date: getTodayInJerusalem(),
    quizEnabled: true,
    title: 'הלכה יומית חדשה מאהלי הלכה',
    topic: 'הלכות ברכות',
    source: 'אהלי הלכה - על פי פסקי הלכה של הגאון הרב יעקב אריאל שליט"א',
    content: 'תוכן ההלכה מתוך ספר אהלי הלכה לקריאה...',
    questions: [
      { id: 'q1', text: 'שאלה 1', options: ['תשובה 1', 'תשובה 2', 'תשובה 3', 'תשובה 4'], correctOptionIndex: 0, explanation: '' },
      { id: 'q2', text: 'שאלה 2', options: ['תשובה 1', 'תשובה 2', 'תשובה 3', 'תשובה 4'], correctOptionIndex: 0, explanation: '' },
      { id: 'q3', text: 'שאלה 3', options: ['תשובה 1', 'תשובה 2', 'תשובה 3', 'תשובה 4'], correctOptionIndex: 0, explanation: '' },
      { id: 'q4', text: 'שאלה 4', options: ['תשובה 1', 'תשובה 2', 'תשובה 3', 'תשובה 4'], correctOptionIndex: 0, explanation: '' },
    ],
  });

  const handleExcelImport = async (parsedStudents: Partial<Student>[]) => {
    try {
      await bulkImportStudentsApi(parsedStudents);
      onRefreshData();
    } catch (e) {
      console.error(e);
      alert('נכשלה שמירת רשימת התלמידות מהאקסל');
    }
  };

  const handleGenerateAiHalacha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiTopic.trim()) return;

    setIsGeneratingAi(true);
    setAiMsg(null);

    try {
      const res = await generateAiHalachaApi(aiTopic, aiDate, aiHebrewDate.trim() || undefined);
      setAiMsg({
        type: 'success',
        text: `ההלכה היומית והחידון בנושא "${aiTopic}" נוצרו בהצלחה לתאריך ${aiDate} ${aiHebrewDate ? `(${aiHebrewDate})` : ''}!`,
      });
      setAiTopic('');
      setAiHebrewDate('');
      onRefreshData();
    } catch (e: any) {
      console.error(e);
      setAiMsg({
        type: 'error',
        text: e?.message || 'אירעה שגיאה ביצירת ההלכה באמצעות AI',
      });
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleGenerateQuestionsFromContent = async (sourceType: 'manual' | 'hebrew-date' = 'manual') => {
    const targetHalacha = sourceType === 'hebrew-date' ? (editingHebrewDateQuiz || selectedHalacha) : editingHalacha;
    if (!targetHalacha || !targetHalacha.content || !targetHalacha.content.trim()) return;
    setIsGeneratingQuestions(true);
    setQuestionsAiError(null);
    try {
      let apiKey = localStorage.getItem('ULPAQUIZ_GEMINI_KEY');
      if (!apiKey) {
        const userKey = prompt(
          "אנא הזן את מפתח ה-Gemini API החופשי שלך.\n(ניתן לקבל מפתח בחינם לחלוטין ללא כרטיס אשראי ב-Google AI Studio).\nהמפתח יישמר באופן מאובטח בדפדפן שלך בלבד:"
        );
        if (userKey && userKey.trim()) {
          localStorage.setItem('ULPAQUIZ_GEMINI_KEY', userKey.trim());
          apiKey = userKey.trim();
        } else {
          throw new Error('פעולת ה-AI בוטלה - לא הוזן מפתח API.');
        }
      }

      const promptText = `Based on the following Jewish law (Halacha) content, generate exactly 4 multiple-choice questions (American questions) in Hebrew suitable for high school girls (Ulpana students).
Provide the output in JSON format ONLY, matching this structure:
{
  "questions": [
    {
      "id": "q1",
      "text": "Question 1 text?",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "correctOptionIndex": 0,
      "explanation": "Explanation for correct option in Hebrew..."
    },
    ...
  ]
}
Make sure correctOptionIndex is an integer between 0 and 3. The language must be clear, warm, and highly educational Hebrew. Do not wrap the JSON in markdown code blocks.

Halacha Content:
"""
${targetHalacha.content}
"""`;

          const fetchWithRetry = async (url: string, options: RequestInit, maxRetries = 3, delayMs = 1500): Promise<Response> => {
            for (let i = 0; i < maxRetries; i++) {
              try {
                const res = await fetch(url, options);
                if ((res.status === 503 || res.status === 429) && i < maxRetries - 1) {
                  await new Promise((resolve) => setTimeout(resolve, delayMs * Math.pow(2, i) + Math.random() * 500));
                  continue;
                }
                return res;
              } catch (err) {
                if (i === maxRetries - 1) throw err;
                await new Promise((resolve) => setTimeout(resolve, delayMs * Math.pow(2, i) + Math.random() * 500));
              }
            }
            return fetch(url, options);
          };

          const response = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: { responseMimeType: 'application/json' }
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        if (response.status === 400 || response.status === 403) {
          localStorage.removeItem('ULPAQUIZ_GEMINI_KEY');
          throw new Error('מפתח ה-API שהוזן אינו תקין או פג תוקף. המפתח הוסר, אנא לחץ שוב והזן מפתח תקין.');
        }
        throw new Error(errText || 'שגיאה בתקשורת ישירה מול שרתי Google Gemini');
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const parsedData = JSON.parse(rawText.trim());

      if (parsedData.questions && parsedData.questions.length === 4) {
        const mappedQuestions = parsedData.questions.map((q: any, idx: number) => ({
          id: q.id || `q${idx + 1}`,
          text: q.text,
          options: q.options,
          correctOptionIndex: Number(q.correctOptionIndex) ?? 0,
          explanation: q.explanation || '',
        }));

        if (sourceType === 'hebrew-date') {
          setEditingHebrewDateQuiz({
            ...(editingHebrewDateQuiz || selectedHalacha),
            questions: mappedQuestions,
          });
        } else {
          setEditingHalacha({
            ...targetHalacha,
            questions: mappedQuestions,
          });
        }
      } else {
        throw new Error('השרת לא החזיר פורמט שאלות תקין (נדרשות בדיוק 4 שאלות)');
      }
    } catch (err: any) {
      console.error('AI questions generation failed:', err);
      setQuestionsAiError(err.message || 'אירעה שגיאה ביצירת השאלות ב-AI. ודאי שהשרת פועל ומחובר ל-Gemini.');
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  const handleSaveHalacha = async () => {
    if (!editingHalacha) return;
    setIsSavingHalacha(true);
    try {
      await saveHalachaApi(editingHalacha);
      setEditingHalacha(null);
      onRefreshData();
    } catch (e) {
      console.error(e);
      alert('נכשלה שמירת ההלכה');
    } finally {
      setIsSavingHalacha(false);
    }
  };

  const handleDeleteHalacha = async (id: string) => {
    if (confirm('האם למחוק הלכה זו?')) {
      try {
        await deleteHalachaApi(id);
        onRefreshData();
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Filtered Students
  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.fullName.includes(studentSearchTerm) || s.username.includes(studentSearchTerm);
    const matchesClass = studentFilterClass === 'ALL' || s.className === studentFilterClass;
    return matchesSearch && matchesClass;
  });

  const uniqueClasses = Array.from(new Set([...classesList, ...students.map((s) => s.className)])).filter(Boolean).sort();

  return (
    <div className="space-y-6 pb-12 animate-in fade-in">
      {/* Top Admin Header */}
      <div className="bg-gradient-to-r from-amber-900 via-amber-800 to-amber-950 text-white p-4 sm:p-6 rounded-3xl shadow-xl flex flex-col gap-4 border border-amber-700/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="h-12 sm:h-14 px-2 sm:px-2.5 bg-white/95 rounded-2xl border border-amber-400/40 shadow-sm flex items-center justify-center shrink-0">
              <img
                src={ULPANA_LOGO_URL}
                alt="לוגו אולפנא"
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
                className="max-h-9 sm:max-h-11 w-auto object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
            <div className="min-w-0 truncate">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-amber-500/30 text-amber-200 text-xs font-bold px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full border border-amber-400/30">
                  צוות אולפנה
                </span>
                <span className="text-xs text-amber-200 font-semibold truncate">
                  אולפנת אבן שמואל • ממשק ניהול
                </span>
              </div>
              <h2 className="text-lg sm:text-2xl font-black font-['Heebo'] mt-1 truncate">
                ניהול מבצע "הלכה יומית"
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              onClick={handleStartManagerQuiz}
              disabled={isStartingManagerQuiz}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white border border-emerald-400/40 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60 disabled:cursor-wait"
            >
              {isStartingManagerQuiz ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ClipboardCheck className="w-3.5 h-3.5" />
              )}
              <span>{isStartingManagerQuiz ? 'פותח את החידון...' : 'השתתפות בחידון היומי'}</span>
            </button>
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 active:scale-95 text-amber-100 border border-white/20 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="רענן נתונים מהשרת"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-300' : ''}`} />
              <span>רענון נתונים</span>
            </button>
          </div>
        </div>

        {managerQuizError && (
          <p role="alert" className="rounded-xl border border-rose-300/50 bg-rose-950/40 px-3 py-2 text-xs font-bold text-rose-100">
            {managerQuizError}
          </p>
        )}

        {/* Admin Subtabs */}
        <div className="w-full overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
          <div className="flex items-center gap-1.5 bg-black/20 p-1.5 rounded-2xl border border-white/10 w-max sm:w-auto">
            <button
              onClick={() => setActiveAdminTab('halachot')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                activeAdminTab === 'halachot'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-amber-200 hover:bg-white/10'
              }`}
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              <span>הלכות וחידונים</span>
            </button>

            <button
              onClick={() => setActiveAdminTab('hebrew-date')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                activeAdminTab === 'hebrew-date'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-amber-200 hover:bg-white/10'
              }`}
            >
              <Calendar className="w-4 h-4 shrink-0" />
              <span>בחירת השאלה היומית</span>
            </button>

            <button
              onClick={() => setActiveAdminTab('students')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                activeAdminTab === 'students'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-amber-200 hover:bg-white/10'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span>תלמידות ואקסל</span>
              {pendingStudents.length > 0 && (
                <span className="bg-rose-500 text-white font-black text-[10px] px-1.5 py-0.2 rounded-full animate-pulse">
                  {pendingStudents.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveAdminTab('prizes')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                activeAdminTab === 'prizes'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-amber-200 hover:bg-white/10'
              }`}
            >
              <Award className="w-4 h-4 shrink-0" />
              <span>דו"ח פרסים וזוכים</span>
            </button>

            <button
              onClick={() => setActiveAdminTab('managers')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                activeAdminTab === 'managers'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-amber-200 hover:bg-white/10'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-yellow-300 shrink-0" />
              <span>מנהלים ({managers.length || 1})</span>
            </button>

            <button
              onClick={() => setActiveAdminTab('classes')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                activeAdminTab === 'classes'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-amber-200 hover:bg-white/10'
              }`}
            >
              <GraduationCap className="w-4 h-4 text-amber-300 shrink-0" />
              <span>כיתות ({classesList.length})</span>
            </button>
          </div>
        </div>
      </div>

      {activeAdminTab === 'hebrew-date' && (
        <div className="bg-white border border-amber-200 rounded-3xl shadow-lg p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-100">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-600 text-white flex items-center justify-center shadow-sm">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-amber-950 font-['Heebo']">בחירת השאלה היומית</h3>
                <p className="text-xs text-amber-800">בחרי יום בלוח העברי לצפייה ולעריכת החידון היומי</p>
              </div>
            </div>

            <div className="min-w-[260px]">
              <label className="block text-[11px] font-black text-slate-700 mb-1">בחרי חודש</label>
              <select
                value={selectedMonthKey}
                onChange={(e) => setSelectedMonthKey(e.target.value)}
                className="w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                {monthOptions.length === 0 ? (
                  <option value="">אין תאריכים עבריים זמינים</option>
                ) : (
                  monthOptions.map((month) => (
                    <option key={month.key} value={month.key}>
                      {month.label}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-amber-200">
            <div className="flex items-center justify-between gap-3 bg-amber-50 px-4 py-3 border-b border-amber-200">
              <h4 className="text-sm font-black text-amber-950">
                {monthOptions.find((month) => month.key === selectedMonthKey)?.label || 'תאריכים בחודש'}
              </h4>
              <span className="text-xs font-bold text-amber-800">
                {selectedMonthDays.length} ימים
              </span>
            </div>

            {selectedMonthDays.length === 0 ? (
              <p className="p-5 text-center text-sm font-bold text-slate-600">לא ניתן להציג את ימי החודש.</p>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-right text-sm">
                  <thead className="sticky top-0 bg-white text-[11px] font-black text-slate-600 shadow-sm">
                    <tr>
                      <th className="px-4 py-2">תאריך</th>
                      <th className="px-4 py-2">יום בשבוע</th>
                      <th className="px-4 py-2">פרשה / חג</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedMonthDays.map((entry) => {
                      const annotations = [entry.parsha, ...entry.holidayNames].filter(Boolean);
                      const isSelected = entry.date.abs() === selectedHebrewDateAbs;

                      return (
                        <tr
                          key={entry.date.abs()}
                          role="button"
                          tabIndex={0}
                          aria-pressed={isSelected}
                          onClick={() => setSelectedHebrewDateAbs(entry.date.abs())}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setSelectedHebrewDateAbs(entry.date.abs());
                            }
                          }}
                          className={`border-t border-amber-100 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500 ${
                            isSelected ? 'bg-amber-100' : 'hover:bg-amber-50'
                          }`}
                        >
                          <td className="px-4 py-3 font-black text-amber-950">{entry.dayLabel}</td>
                          <td className="px-4 py-3 font-semibold text-slate-700">
                            {entry.weekday}{entry.weekday === 'שבת' ? ' קודש' : ''}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {annotations.length > 0 ? annotations.join(' • ') : entry.halacha ? '—' : 'אין הלכה שמורה'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {!selectedHalacha ? (
            <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-900 font-bold">
              אין הלכה שמורה ליום {selectedEntry?.dayLabel} בחודש {monthOptions.find((month) => month.key === selectedMonthKey)?.label}.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                  <span className="inline-flex items-center rounded-full bg-amber-600 px-2.5 py-1 text-[10px] font-black text-white shadow-sm">
                    {selectedHalacha.hebrewDate || 'ללא תאריך עברי'}
                  </span>
                  <span className="text-xs text-slate-600 font-bold">{selectedHalacha.date}</span>
                </div>

                <h4 className="text-xl sm:text-2xl font-black text-amber-950 font-['Heebo']">{selectedHalacha.title}</h4>

                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-700">
                  {selectedHalacha.topic && (
                    <span className="rounded-full bg-white border border-amber-200 px-2.5 py-1 font-bold">נושא: {selectedHalacha.topic}</span>
                  )}
                  {selectedHalacha.source && (
                    <span className="rounded-full bg-white border border-amber-200 px-2.5 py-1 font-bold">מקור: {selectedHalacha.source}</span>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                <h5 className="text-sm font-black text-slate-800 mb-3">תוכן ההלכה</h5>
                <div className="whitespace-pre-wrap text-sm leading-7 text-slate-800 font-medium">
                  {selectedHalacha.content || 'לא הוזן תוכן להלכה זו.'}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <h5 className="text-sm font-black text-slate-800">שאלות החידון</h5>
                  {editingHebrewDateQuiz?.id !== selectedHalacha.id && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setHebrewDateQuizError(null);
                          setEditingHebrewDateQuiz(cloneHalachaForEditing(selectedHalacha));
                        }}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950 hover:bg-amber-100 cursor-pointer transition-all"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        עריכה ידנית
                      </button>
                      <button
                        type="button"
                        disabled={isGeneratingQuestions || !selectedHalacha.content || !selectedHalacha.content.trim()}
                        onClick={() => handleGenerateQuestionsFromContent('hebrew-date')}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-black text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 px-3.5 py-2 disabled:opacity-50 cursor-pointer shadow-xs transition-all"
                      >
                        {isGeneratingQuestions ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Wand2 className="w-3.5 h-3.5 text-yellow-300" />
                        )}
                        <span>{isGeneratingQuestions ? 'מייצר שאלות...' : 'חולל שאלות ב-AI ✨'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {questionsAiError && editingHebrewDateQuiz?.id !== selectedHalacha.id && (
                  <p role="alert" className="text-xs font-bold text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-200 mb-4">
                    {questionsAiError}
                  </p>
                )}

                {editingHebrewDateQuiz?.id === selectedHalacha.id ? (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-600">עדכני את נוסח השאלות והאפשרויות, וסמני בעיגול את התשובה הנכונה.</p>

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mt-1 bg-amber-50/50 p-3 rounded-2xl border border-amber-200">
                      <span className="text-[11px] text-amber-900 font-medium">
                        ניתן לחולל אוטומטית 4 שאלות חכמות מתוכן ההלכה המוצג באמצעות ה-AI.
                      </span>
                      <button
                        type="button"
                        disabled={isGeneratingQuestions || !editingHebrewDateQuiz.content.trim()}
                        onClick={() => handleGenerateQuestionsFromContent('hebrew-date')}
                        className="px-4 py-2 rounded-xl text-xs font-black text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition-all shrink-0 self-end sm:self-auto"
                      >
                        {isGeneratingQuestions ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Wand2 className="w-3.5 h-3.5 text-yellow-300" />
                        )}
                        <span>{isGeneratingQuestions ? 'מייצר שאלות...' : 'חולל שאלות מהתוכן ✨'}</span>
                      </button>
                    </div>
                    {questionsAiError && (
                      <p className="text-xs font-bold text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-200 mt-2">
                        {questionsAiError}
                      </p>
                    )}
                    {editingHebrewDateQuiz.questions.map((question, questionIndex) => (
                      <fieldset key={question.id} className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-3">
                        <legend className="px-1 text-xs font-black text-amber-950">שאלה {questionIndex + 1}</legend>
                        <label className="block text-xs font-bold text-slate-700">
                          נוסח השאלה
                          <input
                            type="text"
                            value={question.text}
                            onChange={(event) => updateHebrewDateQuestion(questionIndex, (current) => ({ ...current, text: event.target.value }))}
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium"
                          />
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {question.options.map((option, optionIndex) => (
                            <label key={`${question.id}-${optionIndex}`} className={`flex items-center gap-2 rounded-lg border p-2 ${question.correctOptionIndex === optionIndex ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                              <input
                                type="radio"
                                name={`hebrew-date-correct-${editingHebrewDateQuiz.id}-${question.id}`}
                                checked={question.correctOptionIndex === optionIndex}
                                onChange={() => updateHebrewDateQuestion(questionIndex, (current) => ({ ...current, correctOptionIndex: optionIndex }))}
                                aria-label={`סמני אפשרות ${optionIndex + 1} כתשובה הנכונה`}
                              />
                              <input
                                type="text"
                                value={option}
                                onChange={(event) => updateHebrewDateQuestion(questionIndex, (current) => {
                                  const options = [...current.options] as Question['options'];
                                  options[optionIndex] = event.target.value;
                                  return { ...current, options };
                                })}
                                aria-label={`אפשרות ${optionIndex + 1} לשאלה ${questionIndex + 1}`}
                                className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
                              />
                            </label>
                          ))}
                        </div>
                        <label className="block text-xs font-bold text-slate-700">
                          הסבר לתשובה הנכונה
                          <input
                            type="text"
                            value={question.explanation || ''}
                            onChange={(event) => updateHebrewDateQuestion(questionIndex, (current) => ({ ...current, explanation: event.target.value }))}
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium"
                          />
                        </label>
                      </fieldset>
                    ))}
                    {hebrewDateQuizError && (
                      <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800">
                        {hebrewDateQuizError}
                      </p>
                    )}
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingHebrewDateQuiz(null)}
                        disabled={isSavingHebrewDateQuiz}
                        className="rounded-lg px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                      >
                        ביטול
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveHebrewDateQuiz}
                        disabled={isSavingHebrewDateQuiz}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-700 px-4 py-2 text-xs font-bold text-white hover:bg-amber-800 disabled:opacity-50"
                      >
                        <Save className="h-4 w-4" />
                        {isSavingHebrewDateQuiz ? 'שומר...' : 'שמור שאלות ותשובות'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedHalacha.questions?.map((question, index) => (
                      <div key={question.id} className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <p className="text-sm font-black text-slate-800">שאלה {index + 1}</p>
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-1 rounded-full">
                            תשובה נכונה: {question.correctOptionIndex + 1}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-slate-800 mb-3">{question.text}</p>
                        <div className="space-y-2">
                          {question.options.map((option, optionIndex) => (
                            <div
                              key={`${question.id}-${optionIndex}`}
                              className={`rounded-xl border px-3 py-2 text-sm ${
                                optionIndex === question.correctOptionIndex
                                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900 font-bold'
                                  : 'border-slate-200 bg-white text-slate-700'
                              }`}
                            >
                              <span className="font-black ml-2">{String.fromCharCode(65 + optionIndex)}.</span>
                              {option}
                            </div>
                          ))}
                        </div>
                        {question.explanation && (
                          <div className="mt-3 rounded-xl bg-white border border-amber-200 px-3 py-2 text-xs text-slate-700">
                            <span className="font-black text-amber-900">הסבר:</span> {question.explanation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ====================================================
          TAB 1: HALACHOT & QUIZZES MANAGEMENT (+ AI GENERATION)
      ==================================================== */}
      {activeAdminTab === 'halachot' && (
        <div className="space-y-6">
          {/* Google Doc Import Card for תשפ"ז */}
          <div className="bg-white border-2 border-emerald-300 rounded-3xl p-6 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-emerald-950 text-lg font-['Heebo']">
                      יבוא והגדרת הלכות שנת תשפ"ז מתוך Google Docs
                    </h3>
                    <span className="bg-emerald-100 text-emerald-800 text-[11px] font-black px-2.5 py-0.5 rounded-full border border-emerald-200">
                      חידון שנת תשפ"ז
                    </span>
                  </div>
                  <p className="text-xs text-emerald-800 font-medium">
                    טעינת קובץ ההלכות השנתי - התאריכים נקבעים לפי התאריך העברי שמופיע ככותרת משנה לכל הלכה!
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={docUrlInput}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-xl border border-emerald-300 text-emerald-800 hover:bg-emerald-50 text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>פתח מסמך ב-Drive</span>
                </a>
                <button
                  type="button"
                  onClick={() => setShowDocImportBox(!showDocImportBox)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold transition-colors"
                >
                  {showDocImportBox ? 'הסתר הגדרות' : 'הצג הגדרות'}
                </button>
              </div>
            </div>

            {showDocImportBox && (
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-8">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      קישור Google Doc (קובץ שנת תשפ"ז ב-Google Drive):
                    </label>
                    <input
                      type="text"
                      value={docUrlInput}
                      onChange={(e) => setDocUrlInput(e.target.value)}
                      placeholder="https://docs.google.com/document/d/.../edit"
                      className="w-full px-4 py-2.5 rounded-xl border border-emerald-300 bg-white text-xs font-mono font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <button
                      type="button"
                      onClick={handleFetchFromGoogleDrive}
                      disabled={isImportingDoc}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2.5 px-4 rounded-xl shadow-md transition-all text-xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      <UploadCloud className="w-4 h-4" />
                      <span>{isImportingDoc ? 'טוען ומנתח...' : 'סנכרן ישירות מ-Google Drive'}</span>
                    </button>
                  </div>
                </div>

                <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/80 pb-2">
                    <label className="block text-xs font-bold text-emerald-950">
                      העלאת קובץ Word (.docx) ישירות מהמחשב או הדבקת טקסט:
                    </label>
                    <label className="inline-flex items-center gap-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 font-bold px-3 py-1.5 rounded-xl text-xs cursor-pointer transition-colors shadow-2xs">
                      <FileUp className="w-4 h-4 text-emerald-700" />
                      <span>העלי קובץ Word (.docx / .doc)</span>
                      <input
                        type="file"
                        accept=".docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setIsImportingDoc(true);
                          setImportDocMsg({ type: 'info', text: `מפענח את הקובץ "${file.name}"...` });
                          try {
                            const buffer = await file.arrayBuffer();
                            const parseRes = await parseDocContentApi(buffer);
                            if (parseRes.text) {
                              setDocRawTextInput(parseRes.text);
                              await parseAndImportHalachotText(parseRes.text);
                            } else {
                              throw new Error('לא זוהה טקסט בקובץ.');
                            }
                          } catch (err: any) {
                            console.error('File upload error:', err);
                            setImportDocMsg({ type: 'error', text: err?.message || 'שגיאה בקריאת הקובץ' });
                          } finally {
                            setIsImportingDoc(false);
                            e.target.value = '';
                          }
                        }}
                      />
                    </label>
                  </div>

                  <textarea
                    rows={4}
                    value={docRawTextInput}
                    onChange={(e) => setDocRawTextInput(e.target.value)}
                    placeholder="הדביקי כאן את תוכן מסמך ההלכות... המערכת תזהה אוטומטית כותרות תאריכים עבריים (לדוגמה: כ&quot;ד אלול תשפ&quot;ז, א&quot; תשרי תשפ&quot;ז) ותפצל לחידונים יומיים."
                    className="w-full p-3 rounded-xl border border-emerald-300 bg-white text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => parseAndImportHalachotText(docRawTextInput)}
                      disabled={isImportingDoc || !docRawTextInput.trim()}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2 px-5 rounded-xl text-xs flex items-center gap-2 disabled:opacity-50 shadow-xs cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>יבא וצור חידונים מטקסט זה</span>
                    </button>
                  </div>
                </div>

                {importDocMsg && (
                  <div
                    className={`p-3 rounded-xl text-xs font-bold ${
                      importDocMsg.type === 'success'
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : importDocMsg.type === 'error'
                        ? 'bg-rose-100 text-rose-900 border border-rose-300'
                        : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}
                  >
                    {importDocMsg.text}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* AI Generator Box (Gemini API) */}
          <div className="bg-gradient-to-r from-amber-50 via-amber-100/50 to-orange-50 border border-amber-300 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold shadow-xs">
                <Wand2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-amber-950 text-lg font-['Heebo']">
                  מחולל AI אוטומטי להלכה וחידון יומי (Gemini API)
                </h3>
                <p className="text-xs text-amber-800">
                  הזיני נושא הלכתי, תאריך ותאריך עברי - והמערכת תיצור אוטומטית הלכה קריאה ו-4 שאלות אמריקאיות עם הסברים!
                </p>
              </div>
            </div>

            <form onSubmit={handleGenerateAiHalacha} className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2">
              <div className="sm:col-span-5">
                <input
                  type="text"
                  placeholder="לדוגמה: הלכות שבת - הדלקת נרות, הלכות תפילה, ברכת האילנות..."
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-amber-300 bg-white text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <input
                  type="text"
                  placeholder='תאריך עברי (למשל: א&apos; תשרי)'
                  value={aiHebrewDate}
                  onChange={(e) => setAiHebrewDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-amber-300 bg-white text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="sm:col-span-2">
                <input
                  type="date"
                  value={aiDate}
                  onChange={(e) => setAiDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-amber-300 bg-white text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div className="sm:col-span-3">
                <button
                  type="submit"
                  disabled={isGeneratingAi || !aiTopic.trim()}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white font-extrabold py-2.5 px-4 rounded-xl shadow-md transition-all text-xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-yellow-300" />
                  <span>{isGeneratingAi ? 'מייצר הלכה ב-AI...' : 'צור הלכה וחידון ב-AI'}</span>
                </button>
              </div>
            </form>

            {aiMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  aiMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {aiMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{aiMsg.text}</span>
              </div>
            )}
          </div>

          {/* Existing Halachot List & Add Manual Button */}
          <div className="bg-white rounded-3xl p-6 border border-amber-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-amber-100 pb-4">
              <div>
                <h3 className="text-xl font-extrabold text-amber-950 font-['Heebo']">
                  מאגר ההלכות והחידונים המתוזמנים ({halachot.length})
                </h3>
                <p className="text-xs text-amber-800">
                  כל הלכה מוצגת לתלמידות לפי התאריך המוגדר.
                </p>
              </div>

              <button
                onClick={() => setEditingHalacha(createBlankHalacha())}
                className="bg-amber-600 text-white hover:bg-amber-700 font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>הוסף הלכה ידנית</span>
              </button>
            </div>

            <div className="space-y-3">
              {halachot.map((h) => (
                <div
                  key={h.id}
                  className="p-4 rounded-2xl border border-amber-200 bg-amber-50/20 hover:bg-amber-50/60 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-amber-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                        {h.date}
                      </span>
                      {h.hebrewDate && (
                        <span className="bg-amber-700 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-xs">
                          {h.hebrewDate}
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${h.quizEnabled === false ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-800'}`}>
                        {h.quizEnabled === false ? 'חידון מושבת' : 'חידון פעיל'}
                      </span>
                      <span className="text-xs font-bold text-amber-900">
                        {h.topic}
                      </span>
                    </div>
                    <h4 className="font-extrabold text-slate-900 text-base font-['Heebo']">
                      {h.title}
                    </h4>
                    <p className="text-xs text-slate-600 line-clamp-1 max-w-xl">
                      {h.content}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => openHalachaEditor(h)}
                      className="p-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs flex items-center gap-1 transition-colors"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>שאלות ותשובות</span>
                    </button>
                    <button
                      onClick={() => handleDeleteHalacha(h.id)}
                      className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center gap-1 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>מחק</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Edit / Create Halacha Modal */}
          {editingHalacha && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
              <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-amber-200 p-4 sm:p-8 space-y-4 sm:space-y-6 my-auto max-h-[92vh] flex flex-col">
                <div className="flex items-center justify-between border-b border-amber-100 pb-3 sm:pb-4 shrink-0">
                  <h3 className="text-lg sm:text-xl font-extrabold text-amber-950 font-['Heebo']">
                    עריכת הלכה, שאלות ותשובות
                  </h3>
                  <button
                    onClick={() => setEditingHalacha(null)}
                    className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer"
                  >
                    סגור ✕
                  </button>
                </div>

                <div className="space-y-4 overflow-y-auto flex-1 pl-1">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">תאריך לתצוגה</label>
                      <input
                        type="date"
                        value={editingHalacha.date}
                        onChange={(e) =>
                          setEditingHalacha({ ...editingHalacha, date: e.target.value })
                        }
                        className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">תאריך עברי (לדוגמה: א' אלול תשפ"ז)</label>
                      <input
                        type="text"
                        placeholder='לדוגמה: כ"ד אלול תשפ"ז'
                        value={editingHalacha.hebrewDate || ''}
                        onChange={(e) =>
                          setEditingHalacha({ ...editingHalacha, hebrewDate: e.target.value })
                        }
                        className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">נושא ההלכה</label>
                      <input
                        type="text"
                        value={editingHalacha.topic}
                        onChange={(e) =>
                          setEditingHalacha({ ...editingHalacha, topic: e.target.value })
                        }
                        className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-semibold"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-bold text-amber-950">
                    <input
                      type="checkbox"
                      checked={editingHalacha.quizEnabled !== false}
                      onChange={(e) => setEditingHalacha({ ...editingHalacha, quizEnabled: e.target.checked })}
                      className="h-4 w-4 accent-amber-700"
                    />
                    לאפשר לתלמידות להיבחן בתאריך הזה
                  </label>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">מקור בספר "אהלי הלכה" (לדוגמה: אהלי הלכה - חלק א', פרק כ')</label>
                    <input
                      type="text"
                      value={editingHalacha.source || ''}
                      onChange={(e) =>
                        setEditingHalacha({ ...editingHalacha, source: e.target.value })
                      }
                      placeholder='סדרת אהלי הלכה - על פי פסקי הלכה של הגאון הרב יעקב אריאל שליט"א'
                      className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">כותרת ההלכה</label>
                    <input
                      type="text"
                      value={editingHalacha.title}
                      onChange={(e) =>
                        setEditingHalacha({ ...editingHalacha, title: e.target.value })
                      }
                      className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">תוכן ההלכה לקריאה</label>
                    <textarea
                      rows={5}
                      value={editingHalacha.content}
                      onChange={(e) =>
                        setEditingHalacha({ ...editingHalacha, content: e.target.value })
                      }
                      className="w-full p-3 rounded-xl border border-slate-300 text-sm leading-relaxed"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mt-1 bg-amber-50/50 p-3 rounded-2xl border border-amber-200">
                    <span className="text-[11px] text-amber-900 font-medium">
                      ניתן להזין או לערוך את תוכן ההלכה למעלה, ואז לחולל אוטומטית 4 שאלות חכמות מהתוכן באמצעות ה-AI.
                    </span>
                    <button
                      type="button"
                      disabled={isGeneratingQuestions || !editingHalacha.content.trim()}
                      onClick={() => handleGenerateQuestionsFromContent('manual')}
                      className="px-4 py-2 rounded-xl text-xs font-black text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition-all shrink-0 self-end sm:self-auto"
                    >
                      {isGeneratingQuestions ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Wand2 className="w-3.5 h-3.5 text-yellow-300" />
                      )}
                      <span>{isGeneratingQuestions ? 'מייצר שאלות...' : 'חולל שאלות מהתוכן ✨'}</span>
                    </button>
                  </div>
                  {questionsAiError && (
                    <p className="text-xs font-bold text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-200 mt-2">
                      {questionsAiError}
                    </p>
                  )}

                  {/* Questions Edit Block */}
                  <div className="pt-4 border-t border-amber-100 space-y-4">
                    <h4 className="font-extrabold text-amber-950 text-base">
                      4 שאלות החידון היומי:
                    </h4>
                    <p className="text-xs text-slate-600">
                      ערכי את השאלות והאפשרויות, וסמני בעיגול את התשובה הנכונה לכל שאלה.
                    </p>

                    {editingHalacha.questions.map((q, qIdx) => (
                      <div key={q.id} className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200 space-y-3">
                        <label className="block text-xs font-bold text-amber-950">
                          שאלה {qIdx + 1}:
                        </label>
                        <input
                          type="text"
                          value={q.text}
                          onChange={(e) => {
                            const newQs = [...editingHalacha.questions] as [Question, Question, Question, Question];
                            newQs[qIdx].text = e.target.value;
                            setEditingHalacha({ ...editingHalacha, questions: newQs });
                          }}
                          className="w-full p-2 rounded-xl border border-amber-300 text-xs font-semibold bg-white"
                        />

                        {/* Options */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {q.options.map((opt, optIdx) => (
                            <div key={optIdx} className="flex items-center gap-1.5">
                              <input
                                type="radio"
                                name={`correct-${q.id}`}
                                checked={q.correctOptionIndex === optIdx}
                                onChange={() => {
                                  const newQs = [...editingHalacha.questions] as [Question, Question, Question, Question];
                                  newQs[qIdx].correctOptionIndex = optIdx;
                                  setEditingHalacha({ ...editingHalacha, questions: newQs });
                                }}
                              />
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => {
                                  const newQs = [...editingHalacha.questions] as [Question, Question, Question, Question];
                                  newQs[qIdx].options[optIdx] = e.target.value;
                                  setEditingHalacha({ ...editingHalacha, questions: newQs });
                                }}
                                className={`w-full p-2 rounded-lg border text-xs ${
                                  q.correctOptionIndex === optIdx
                                    ? 'border-emerald-500 bg-emerald-50/80 font-bold'
                                    : 'border-slate-200 bg-white'
                                }`}
                              />
                            </div>
                          ))}
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-0.5">הסבר לתשובה הנכונה:</label>
                          <input
                            type="text"
                            value={q.explanation || ''}
                            onChange={(e) => {
                              const newQs = [...editingHalacha.questions] as [Question, Question, Question, Question];
                              newQs[qIdx].explanation = e.target.value;
                              setEditingHalacha({ ...editingHalacha, questions: newQs });
                            }}
                            className="w-full p-2 rounded-lg border border-slate-200 text-xs bg-white"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-amber-100">
                  <button
                    onClick={() => setEditingHalacha(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                  >
                    ביטול
                  </button>
                  <button
                    onClick={handleSaveHalacha}
                    disabled={isSavingHalacha}
                    className="px-6 py-2.5 rounded-xl text-xs font-extrabold text-white bg-amber-600 hover:bg-amber-700 shadow-md flex items-center gap-1.5"
                  >
                    <Save className="w-4 h-4" />
                    <span>שמור הלכה וחידון</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ====================================================
          TAB 2: STUDENTS & EXCEL UPLOADER
      ==================================================== */}
      {activeAdminTab === 'students' && (
        <div className="space-y-6">
          {/* Pending Registrations Card */}
          {pendingStudents.length > 0 ? (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-3xl p-6 border-2 border-amber-400 shadow-md space-y-4">
              <div className="flex items-center justify-between border-b border-amber-200 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2.5 bg-amber-600 text-white rounded-2xl shadow-xs">
                    <Clock className="w-5 h-5 animate-spin" />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-amber-950 font-['Heebo'] flex items-center gap-2">
                      <span>בקשות הרשמה הממתינות לאישור</span>
                      <span className="bg-rose-500 text-white font-extrabold text-xs px-2.5 py-0.5 rounded-full">
                        {pendingStudents.length}
                      </span>
                    </h3>
                    <p className="text-xs text-amber-800">
                      תלמידות שנרשמו עצמאית במערכת וממתינות לאישורך כדי להתחיל ללמוד ולהופיע בלוח המובילים
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {pendingStudents.map((s) => (
                  <div
                    key={s.id}
                    className="bg-white p-4 rounded-2xl border border-amber-300 shadow-xs flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-900 text-sm">{s.fullName}</span>
                        <span className="bg-amber-100 text-amber-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                          כיתה {s.className}
                        </span>
                      </div>
                      {s.email ? (
                        <div className="flex items-center gap-1 text-xs text-amber-950 font-mono bg-amber-50/80 px-2.5 py-1 rounded-xl border border-amber-200 truncate" dir="ltr">
                          <Mail className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          <span className="truncate">{s.email}</span>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-600 font-mono">
                          משתמש: <strong className="text-amber-900">{s.username}</strong>
                        </p>
                      )}
                      <p className="text-[11px] text-slate-400">
                        שכבה {s.grade}' {s.registeredAt ? `• ${new Date(s.registeredAt).toLocaleDateString('he-IL')}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => handleApproveStudent(s.id)}
                        className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        title="אישור הרשמה מיידי"
                      >
                        <Check className="w-4 h-4" />
                        <span>אישור</span>
                      </button>
                      <button
                        onClick={() => handleOpenEditStudent(s)}
                        className="py-2 px-3 bg-amber-100 hover:bg-amber-200 text-amber-950 font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                        title="עריכת פרטים וכיתה"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>עריכה</span>
                      </button>
                      <button
                        onClick={() => handleRejectStudent(s.id, s.fullName)}
                        className="py-2 px-2.5 bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                        title="דחה הרשמה"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm">
                    אין כרגע תלמידות הממתינות לאישור
                  </h4>
                  <p className="text-xs text-slate-500">
                    כאשר תלמידה תירשם עם ה-Gmail שלה, פרטיה יופיעו כאן מיידית לאישורך.
                  </p>
                </div>
              </div>
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="px-3 py-1.5 bg-white border border-amber-300 text-amber-900 rounded-xl text-xs font-bold hover:bg-amber-100/50 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-600' : ''}`} />
                <span>רענן כעת</span>
              </button>
            </div>
          )}

          <ExcelUploader onStudentsLoaded={handleExcelImport} />

          {/* Student Search & Table */}
          <div className="bg-white rounded-3xl p-6 border border-amber-200/80 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-100 pb-4">
              <div>
                <h3 className="text-xl font-extrabold text-amber-950 font-['Heebo']">
                  רשימת התלמידות הרשומות ({students.length})
                </h3>
                <p className="text-xs text-amber-800">
                  סינון, חיפוש, הוספת תלמידות בודדות ובדק ניקוד.
                </p>
              </div>

              {/* Filters & Add Manual Button */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setIsAddStudentModalOpen(true)}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-xs shrink-0"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>הוספת תלמידה ידנית</span>
                </button>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="חיפוש לפי שם..."
                    value={studentSearchTerm}
                    onChange={(e) => setStudentSearchTerm(e.target.value)}
                    className="pr-9 pl-3 py-1.5 rounded-xl border border-amber-300 text-xs bg-amber-50/40"
                  />
                </div>

                <select
                  value={studentFilterClass}
                  onChange={(e) => setStudentFilterClass(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-amber-300 text-xs bg-amber-50/40 font-bold text-amber-950"
                >
                  <option value="ALL">כל הכיתות</option>
                  {uniqueClasses.map((cls) => (
                    <option key={cls} value={cls}>
                      כיתה {cls}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Students Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-amber-200 bg-amber-50 text-amber-950 font-extrabold">
                    <th className="p-3">שם מלא</th>
                    <th className="p-3">Gmail / מייל</th>
                    <th className="p-3">כיתה</th>
                    <th className="p-3">שכבה</th>
                    <th className="p-3">סטטוס הרשמה</th>
                    <th className="p-3">ניקוד מצטבר</th>
                    <th className="p-3">חידונים שהושלמו</th>
                    <th className="p-3 text-center">פעולות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {filteredStudents.map((s) => (
                    <tr key={s.id} className="hover:bg-amber-50/50">
                      <td className="p-3 font-bold text-slate-900">{s.fullName}</td>
                      <td className="p-3 text-slate-600 font-mono text-[11px]" dir="ltr">
                        {s.email || s.username}
                      </td>
                      <td className="p-3 font-semibold text-amber-900">{s.className}</td>
                      <td className="p-3 font-semibold text-slate-700">{s.grade}'</td>
                      <td className="p-3">
                        {s.status === 'pending' ? (
                          <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 w-fit">
                            <Clock className="w-3 h-3 text-amber-700" />
                            ממתינה לאישור
                          </span>
                        ) : s.status === 'rejected' ? (
                          <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            נדחתה
                          </span>
                        ) : (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 w-fit">
                            <UserCheck className="w-3 h-3 text-emerald-600" />
                            מאושרת
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-black text-amber-950 font-['Heebo']">{s.points} נק'</td>
                      <td className="p-3">
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {s.completedDates.length} ימים
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {s.status === 'pending' && (
                            <button
                              onClick={() => handleApproveStudent(s.id)}
                              className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-100 transition-colors"
                              title="אישור תלמידה"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenEditStudent(s)}
                            className="p-1.5 rounded-lg text-amber-700 hover:bg-amber-100 transition-colors"
                            title="עריכת פרטי תלמידה"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteStudent(s.id, s.fullName)}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
                            title="מחק תלמידה"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add Student Modal */}
          {isAddStudentModalOpen && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
              <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-amber-200 p-4 sm:p-6 space-y-4 sm:space-y-5 my-auto max-h-[92vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-amber-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                      <UserPlus className="w-5 h-5" />
                    </div>
                    <h3 className="text-base sm:text-lg font-extrabold text-amber-950 font-['Heebo']">
                      הוספת תלמידה חדשה
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsAddStudentModalOpen(false)}
                    className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleAddStudent} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      שם מלא <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="לדוגמה: תמר שפירא"
                      value={newStudent.fullName}
                      onChange={(e) => setNewStudent({ ...newStudent, fullName: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        כיתה <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={newStudent.className}
                        onChange={(e) => {
                          const cls = e.target.value;
                          setNewStudent({
                            ...newStudent,
                            className: cls,
                            grade: inferGradeFromClass(cls),
                          });
                        }}
                        className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-hidden bg-white"
                      >
                        {classesList.map((c) => (
                          <option key={c} value={c}>
                            כיתה {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        שכבה <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={newStudent.grade}
                        onChange={(e) => setNewStudent({ ...newStudent, grade: e.target.value as GradeType })}
                        className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-hidden bg-white"
                      >
                        <option value="ט">שכבת ט'</option>
                        <option value="י">שכבת י'</option>
                        <option value="יא">שכבת יא'</option>
                        <option value="יב">שכבת יב'</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        שם משתמש
                      </label>
                      <input
                        type="text"
                        placeholder="ייווצר אוטומטית אם ריק"
                        value={newStudent.username}
                        onChange={(e) => setNewStudent({ ...newStudent, username: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        ניקוד התחלתי במבצע
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={newStudent.points}
                        onChange={(e) => setNewStudent({ ...newStudent, points: Number(e.target.value) })}
                        className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  {studentError && (
                    <p className="text-xs font-bold text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                      {studentError}
                    </p>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsAddStudentModalOpen(false)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      ביטול
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingStudent}
                      className="px-5 py-2 rounded-xl text-xs font-extrabold text-white bg-amber-600 hover:bg-amber-700 shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      <span>{isSavingStudent ? 'שומר...' : 'שמור תלמידה'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Edit Student Modal */}
          {editingStudent && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
              <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-amber-200 p-4 sm:p-6 space-y-4 sm:space-y-5 my-auto max-h-[92vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-amber-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                      <Edit className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-amber-950 font-['Heebo']">
                        עריכת פרטי תלמידה
                      </h3>
                      <p className="text-xs text-slate-500">
                        עדכון פרטים אישיים, כתובת Gmail, כיתה וסטטוס הרשמה
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setEditingStudent(null)}
                    className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveEditedStudent} className="space-y-4 text-right">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      שם מלא <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editingStudent.fullName}
                      onChange={(e) =>
                        setEditingStudent({ ...editingStudent, fullName: e.target.value })
                      }
                      className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>כתובת Gmail</span>
                      <span className="text-[11px] text-amber-700 font-normal">
                        משמשת לכניסת התלמידה
                      </span>
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      placeholder="student@gmail.com"
                      value={editingStudent.email || ''}
                      onChange={(e) =>
                        setEditingStudent({ ...editingStudent, email: e.target.value })
                      }
                      className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-mono font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        כיתה <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={editingStudent.className}
                        onChange={(e) => {
                          const cls = e.target.value;
                          setEditingStudent({
                            ...editingStudent,
                            className: cls,
                            grade: inferGradeFromClass(cls),
                          });
                        }}
                        className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-hidden bg-white"
                      >
                        {classesList.map((c) => (
                          <option key={c} value={c}>
                            כיתה {c}
                          </option>
                        ))}
                        {!classesList.includes(editingStudent.className) && (
                          <option value={editingStudent.className}>
                            כיתה {editingStudent.className} (מותאם אישית)
                          </option>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        שכבה <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={editingStudent.grade}
                        onChange={(e) =>
                          setEditingStudent({
                            ...editingStudent,
                            grade: e.target.value as GradeType,
                          })
                        }
                        className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-hidden bg-white"
                      >
                        <option value="ט">שכבת ט'</option>
                        <option value="י">שכבת י'</option>
                        <option value="יא">שכבת י"א</option>
                        <option value="יב">שכבת י"ב</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        סטטוס במערכת
                      </label>
                      <select
                        value={editingStudent.status || 'approved'}
                        onChange={(e) =>
                          setEditingStudent({
                            ...editingStudent,
                            status: e.target.value as 'approved' | 'pending' | 'rejected',
                          })
                        }
                        className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-amber-500 focus:outline-hidden bg-white"
                      >
                        <option value="approved">✓ מאושרת ללימוד</option>
                        <option value="pending">⏳ ממתינה לאישור</option>
                        <option value="rejected">✕ נדחתה</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        ניקוד מצטבר במבצע
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={editingStudent.points}
                        onChange={(e) =>
                          setEditingStudent({
                            ...editingStudent,
                            points: Number(e.target.value),
                          })
                        }
                        className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Quick approve button if currently pending */}
                  {editingStudent.status === 'pending' && (
                    <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-950">
                        התלמידה ממתינה לאישור
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingStudent({ ...editingStudent, status: 'approved' })
                        }
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>שני למאושרת</span>
                      </button>
                    </div>
                  )}

                  {editStudentError && (
                    <p className="text-xs font-bold text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                      {editStudentError}
                    </p>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setEditingStudent(null)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      ביטול
                    </button>
                    <button
                      type="submit"
                      disabled={isUpdatingStudent}
                      className="px-5 py-2 rounded-xl text-xs font-extrabold text-white bg-amber-600 hover:bg-amber-700 shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>{isUpdatingStudent ? 'שומר שינויים...' : 'שמור שינויים'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ====================================================
          TAB 3: PRIZE REPORT & WINNERS SUMMARY
      ==================================================== */}
      {activeAdminTab === 'prizes' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-amber-200/80 shadow-sm space-y-6">
            <div className="border-b border-amber-100 pb-3">
              <h3 className="text-xl font-extrabold text-amber-950 font-['Heebo'] flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-600" />
                <span>סיכום מנצחות ומקומות ראשונים בסיום המבצע</span>
              </h3>
              <p className="text-xs text-amber-800">
                דוח מרוכז למתן פרסים כיתתיים, שכבתיים ואישיים באולפנה.
              </p>
            </div>

            {/* Qualifying Students Table */}
            <div className="space-y-3">
              <h4 className="font-extrabold text-amber-950 text-sm">
                תלמידות שהגיעו ליעד פרס אישי:
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {prizeReports
                  .filter((r) => r.qualifyingMilestones.length > 0)
                  .map((report) => (
                    <div
                      key={report.student.id}
                      className="p-4 rounded-2xl border border-amber-200 bg-amber-50/40 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-extrabold text-slate-900 text-base font-['Heebo']">
                            {report.student.fullName}
                          </p>
                          <p className="text-xs text-amber-800 font-semibold">
                            כיתה {report.student.className} (שכבה {report.student.grade}')
                          </p>
                        </div>

                        <span className="bg-amber-600 text-white font-black text-sm px-3 py-1 rounded-xl">
                          {report.student.points} נק'
                        </span>
                      </div>

                      <div className="pt-2 border-t border-amber-200/60 flex flex-wrap gap-1.5">
                        {report.qualifyingMilestones.map((m) => (
                          <span
                            key={m.points}
                            className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>
                              {m.title} ({m.points} נק')
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================
          TAB 5: MANAGERS & ADMINISTRATORS MANAGEMENT
      ==================================================== */}
      {activeAdminTab === 'managers' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-amber-800 via-amber-900 to-slate-900 text-white p-6 sm:p-7 rounded-3xl shadow-sm relative overflow-hidden">
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-600/50 border border-amber-300/30 rounded-full text-xs font-bold text-amber-200">
                  <ShieldCheck className="w-3.5 h-3.5 text-yellow-300" />
                  <span>ניהול הרשאות וצוות</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black font-['Heebo']">
                  מנהלי מערכת מורשים
                </h2>
                <p className="text-xs sm:text-sm text-amber-100/80 max-w-xl leading-relaxed">
                  הוספה וניהול של אנשי צוות המורשים לאשר תלמידות, לערוך הלכות וחידונים, ולצפות בדו"חות הזוכים.
                </p>
              </div>

              {/* Quick Status for Primary Manager */}
              <div className="bg-white/10 backdrop-blur-md border border-white/20 p-3.5 rounded-2xl text-right sm:min-w-[240px]">
                <span className="text-[11px] text-amber-200 font-medium block">מנהל ראשי נוכחי:</span>
                <span className="text-sm font-extrabold text-white font-mono dir-ltr block">
                  ${SUPER_ADMIN_EMAIL}

                </span>
                <span className="inline-block mt-1 px-2 py-0.5 bg-yellow-400/20 text-yellow-300 text-[10px] font-bold rounded-md border border-yellow-400/30">
                  סופר-אדמין (קבוע)
                </span>
              </div>
            </div>
          </div>

          {/* Feedback Message */}
          {managerMsg && (
            <div
              className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in ${
                managerMsg.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {managerMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{managerMsg.text}</span>
              </div>
              <button
                onClick={() => setManagerMsg(null)}
                className="text-xs opacity-70 hover:opacity-100 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* How It Works Guide Card */}
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-5 text-amber-950 space-y-2">
            <h3 className="text-sm font-extrabold flex items-center gap-2 text-amber-900">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>כיצד מנהל נכנס למערכת?</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs leading-relaxed text-amber-900/90">
              <div className="bg-white/80 p-3 rounded-xl border border-amber-200/60 space-y-1">
                <span className="font-extrabold text-amber-800 block">1. הזנת כתובת ה-Gmail</span>
                <p>במסך הכניסה, מזינים את כתובת ה-Gmail המורשית (למשל ${SUPER_ADMIN_EMAIL}).</p>
              </div>
              <div className="bg-white/80 p-3 rounded-xl border border-amber-200/60 space-y-1">
                <span className="font-extrabold text-amber-800 block">2. זיהוי אוטומטי כמנהל</span>
                <p>המערכת מזהה אוטומטית שמדובר במנהל ומעבירה ישירות למסך הניהול ללא המתנה.</p>
              </div>
              <div className="bg-white/80 p-3 rounded-xl border border-amber-200/60 space-y-1">
                <span className="font-extrabold text-amber-800 block">3. כניסה ישירה לניהול</span>
                <p>ניתן גם ללחוץ על הכפתור "כניסה ישירה לניהול" בתחתית מסך הכניסה בכל עת.</p>
              </div>
            </div>
          </div>

          {/* Add New Manager Form Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                <UserPlus className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-800">
                  הוספת מנהל/ת חדש/ה
                </h3>
                <p className="text-xs text-slate-500">
                  הזינו שם וכתובת Gmail להענקת הרשאות ניהול מלאות
                </p>
              </div>
            </div>

            <form onSubmit={handleAddManager} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    שם מלא או תפקיד *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="לדוגמה: רבקה כהן - רכזת שכבה"
                    value={newManagerName}
                    onChange={(e) => setNewManagerName(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    כתובת Gmail *
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      placeholder="teacher@gmail.com"
                      value={newManagerEmail}
                      onChange={(e) => setNewManagerEmail(e.target.value)}
                      className="w-full p-2.5 pl-8 rounded-xl border border-slate-300 text-xs font-semibold font-mono dir-ltr focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    />
                    <Mail className="w-4 h-4 text-slate-400 absolute left-2.5 top-3 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-slate-500">
                  כתובת המייל חייבת להיות כתובת Gmail תקינה.
                </span>
                <button
                  type="submit"
                  disabled={isAddingManager || !newManagerEmail.trim()}
                  className="px-5 py-2.5 rounded-xl text-xs font-extrabold text-white bg-amber-700 hover:bg-amber-800 disabled:opacity-50 shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>{isAddingManager ? 'מוסיף מנהל...' : 'הוסף מנהל/ת'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Current Managers List */}
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-extrabold text-slate-800">
                  רשימת מנהלי המערכת ({managers.length})
                </h3>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {managers.map((m) => {
                const isSuperadmin = m.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
                return (
                  <div
                    key={m.email}
                    className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm shadow-xs ${
                          isSuperadmin
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {isSuperadmin ? <Crown className="w-5 h-5 text-amber-200" /> : <Shield className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                            {m.name || m.email.split('@')[0]}
                          </span>
                          {isSuperadmin ? (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-[10px] font-extrabold">
                              מנהל ראשי (Superadmin)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-[10px] font-bold">
                              מנהל
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                          <span className="font-mono dir-ltr font-semibold text-slate-700">
                            {m.email}
                          </span>
                          {m.addedAt && (
                            <span className="text-[11px] text-slate-400">
                              • נוסף בתאריך: {new Date(m.addedAt).toLocaleDateString('he-IL')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {isSuperadmin ? (
                        <span className="text-[11px] text-amber-800/80 font-bold bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/60">
                          מוגן ממחיקה
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDeleteManager(m.email)}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 transition-colors flex items-center gap-1 cursor-pointer"
                          title="הסרת הרשאות ניהול"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>הסר מנהל</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ====================================================
          TAB 6: SCHOOL CLASSES MANAGEMENT
      ==================================================== */}
      {activeAdminTab === 'classes' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-white rounded-3xl p-6 border border-amber-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-500 text-white flex items-center justify-center font-bold shadow-sm">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-amber-950 font-['Heebo'] flex items-center gap-2">
                    <span>ניהול כיתות האולפנה</span>
                    <span className="bg-amber-100 text-amber-900 border border-amber-300 text-xs px-2.5 py-0.5 rounded-full font-bold">
                      {classesList.length} כיתות פעילות
                    </span>
                  </h3>
                  <p className="text-xs text-amber-800">
                    הכיתות המוגדרות כאן מופיעות ישירות בטופס ההרשמה של התלמידות, במסכי הסינון, בלוח המובילים וביצירת קודי הזמנה.
                  </p>
                </div>
              </div>
            </div>

            {/* Add New Class Form */}
            <form onSubmit={handleAddClass} className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200/80 space-y-3">
              <h4 className="text-xs font-extrabold text-amber-900 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-amber-700" />
                <span>הוספת כיתה חדשה</span>
              </h4>
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <input
                  type="text"
                  placeholder="לדוגמה: ט'3, י'3, ח'1, כיתה מדעית..."
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="w-full sm:flex-1 p-2.5 rounded-xl border border-amber-300 bg-white text-sm font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
                <button
                  type="submit"
                  disabled={isAddingClass || !newClassName.trim()}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-extrabold text-white bg-amber-600 hover:bg-amber-700 transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isAddingClass ? 'מוסיף...' : 'הוסף כיתה'}</span>
                </button>
              </div>

              {classMsg && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                    classMsg.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {classMsg.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{classMsg.text}</span>
                </div>
              )}
            </form>
          </div>

          {/* Classes Grid */}
          <div className="bg-white rounded-3xl p-6 border border-amber-200/80 shadow-xs space-y-4">
            <h4 className="text-sm font-extrabold text-amber-950 font-['Heebo']">
              רשימת הכיתות הפעילות
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {classesList.map((cls) => {
                const count = students.filter((s) => s.className === cls).length;
                const derivedGrade = inferGradeFromClass(cls);
                return (
                  <div
                    key={cls}
                    className="bg-amber-50/30 hover:bg-amber-50/70 border border-amber-200/80 p-4 rounded-2xl transition-all flex flex-col justify-between space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
                          {derivedGrade}
                        </div>
                        <div>
                          <span className="font-black text-slate-900 text-base">
                            כיתה {cls}
                          </span>
                          <span className="block text-[11px] text-amber-800 font-bold">
                            שכבת {derivedGrade}'
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteClass(cls)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title={`מחיקת כיתה ${cls}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-amber-100 text-xs">
                      <span className="text-slate-500 font-semibold flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-amber-700" />
                        <span>{count} תלמידות</span>
                      </span>

                      {count > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setStudentFilterClass(cls);
                            setActiveAdminTab('students');
                          }}
                          className="text-[11px] font-bold text-amber-700 hover:text-amber-900 hover:underline"
                        >
                          צפה בתלמידות ←
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
