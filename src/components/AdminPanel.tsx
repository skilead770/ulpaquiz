import React, { useState } from 'react';
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
  UserPlus,
  UserCheck,
  Clock,
  Check,
  X,
} from 'lucide-react';
import { Student, DailyHalacha, PrizeReportItem, Question, GradeType, Invitation } from '../types';
import { ExcelUploader } from './ExcelUploader';
import {
  bulkImportStudentsApi,
  saveHalachaApi,
  deleteHalachaApi,
  generateAiHalachaApi,
  addStudentApi,
  deleteStudentApi,
  approveStudentApi,
  rejectStudentApi,
  fetchInvitationsApi,
  createInvitationApi,
  deleteInvitationApi,
} from '../lib/api';
import { Key, Share2, Copy } from 'lucide-react';

interface AdminPanelProps {
  students: Student[];
  halachot: DailyHalacha[];
  prizeReports: PrizeReportItem[];
  onRefreshData: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  students,
  halachot,
  prizeReports,
  onRefreshData,
}) => {
  const [activeAdminTab, setActiveAdminTab] = useState<
    'halachot' | 'students' | 'prizes' | 'invitations'
  >('halachot');

  // Invitations State
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isNewInvModalOpen, setIsNewInvModalOpen] = useState(false);
  const [copiedInvId, setCopiedInvId] = useState<string | null>(null);
  const [newInv, setNewInv] = useState<{
    className: string;
    grade: GradeType;
    maxUses: number;
    code: string;
  }>({
    className: "ט'1",
    grade: 'ט',
    maxUses: 50,
    code: '',
  });

  React.useEffect(() => {
    fetchInvitationsApi().then((list) => setInvitations(list));
  }, []);

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInv.code.trim() || !newInv.className.trim()) {
      alert('נא למלא קוד וכיתה');
      return;
    }
    try {
      const res = await createInvitationApi({
        className: newInv.className,
        grade: newInv.grade,
        maxUses: newInv.maxUses,
        code: newInv.code.trim().toUpperCase(),
      });
      setInvitations(res.invitations);
      setIsNewInvModalOpen(false);
      setNewInv({ className: "ט'1", grade: 'ט', maxUses: 50, code: '' });
    } catch (e) {
      console.error(e);
      alert('שגיאה ביצירת קוד הזמנה');
    }
  };

  const handleDeleteInvitation = async (id: string) => {
    if (confirm('האם למחוק קוד הזמנה זה?')) {
      try {
        const res = await deleteInvitationApi(id);
        setInvitations(res.invitations);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const copyInviteLink = (code: string, invId: string) => {
    const origin = window.location.origin;
    const url = `${origin}/#register?invite=${encodeURIComponent(code)}`;
    navigator.clipboard.writeText(url);
    setCopiedInvId(invId);
    setTimeout(() => setCopiedInvId(null), 2500);
  };

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
    password: string;
    points: number;
  }>({
    fullName: '',
    grade: 'ט',
    className: "ט'1",
    username: '',
    password: '123',
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
        password: newStudent.password.trim() || '123',
        points: Number(newStudent.points) || 0,
      });
      setIsAddStudentModalOpen(false);
      setNewStudent({
        fullName: '',
        grade: 'ט',
        className: "ט'1",
        username: '',
        password: '123',
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

  // AI Generation Form State
  const [aiTopic, setAiTopic] = useState('');
  const [aiDate, setAiDate] = useState('2026-08-01');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiMsg, setAiMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Halacha Edit Modal / Form State
  const [editingHalacha, setEditingHalacha] = useState<DailyHalacha | null>(null);
  const [isSavingHalacha, setIsSavingHalacha] = useState(false);

  // New Halacha Template
  const createBlankHalacha = (): DailyHalacha => ({
    id: `halacha-${Date.now()}`,
    date: new Date().toISOString().split('T')[0],
    title: 'הלכה יומית חדשה מאהלי הלכה',
    topic: 'הלכות ברכות',
    source: 'אהלי הלכה - מאת הרב מאיר בראלי (בנשיאות הרב יעקב אריאל שליט"א)',
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
      const res = await generateAiHalachaApi(aiTopic, aiDate);
      setAiMsg({
        type: 'success',
        text: `ההלכה היומית והחידון בנושא "${aiTopic}" נוצרו בהצלחה לתאריך ${aiDate}!`,
      });
      setAiTopic('');
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

  const uniqueClasses = Array.from(new Set(students.map((s) => s.className))).sort();

  return (
    <div className="space-y-6 pb-12 animate-in fade-in">
      {/* Top Admin Header */}
      <div className="bg-gradient-to-r from-amber-900 via-amber-800 to-amber-950 text-white p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-amber-700/50">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-amber-500/30 text-amber-200 text-xs font-bold px-3 py-1 rounded-full border border-amber-400/30">
              צוות אולפנה
            </span>
            <span className="text-xs text-amber-200 font-semibold">
              ממשק ניהול אחורי
            </span>
          </div>
          <h2 className="text-2xl font-black font-['Heebo'] mt-1">
            ניהול מבצע "הלכה יומית"
          </h2>
        </div>

        {/* Admin Subtabs */}
        <div className="flex items-center gap-1.5 bg-black/20 p-1.5 rounded-2xl border border-white/10">
          <button
            onClick={() => setActiveAdminTab('halachot')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeAdminTab === 'halachot'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-amber-200 hover:bg-white/10'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>הלכות וחידונים</span>
          </button>

          <button
            onClick={() => setActiveAdminTab('students')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeAdminTab === 'students'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-amber-200 hover:bg-white/10'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>תלמידות ואקסל</span>
            {pendingStudents.length > 0 && (
              <span className="bg-rose-500 text-white font-black text-[10px] px-1.5 py-0.2 rounded-full animate-pulse">
                {pendingStudents.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveAdminTab('prizes')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeAdminTab === 'prizes'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-amber-200 hover:bg-white/10'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>דו"ח פרסים וזוכים</span>
          </button>

          <button
            onClick={() => setActiveAdminTab('invitations')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeAdminTab === 'invitations'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-amber-200 hover:bg-white/10'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>הזמנות וקודים</span>
          </button>
        </div>
      </div>

      {/* ====================================================
          TAB 1: HALACHOT & QUIZZES MANAGEMENT (+ AI GENERATION)
      ==================================================== */}
      {activeAdminTab === 'halachot' && (
        <div className="space-y-6">
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
                  הזיני נושא הלכתי ותאריך, והמערכת תיצור אוטומטית הלכה קריאה ו-4 שאלות אמריקאיות עם הסברים!
                </p>
              </div>
            </div>

            <form onSubmit={handleGenerateAiHalacha} className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2">
              <div className="sm:col-span-6">
                <input
                  type="text"
                  placeholder="לדוגמה: הלכות שבת - הדלקת נרות, הלכות תפילה, ברכת האילנות..."
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-amber-300 bg-white text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div className="sm:col-span-3">
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
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white font-extrabold py-2.5 px-4 rounded-xl shadow-md transition-all text-xs flex items-center justify-center gap-2 disabled:opacity-50"
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
                      onClick={() => setEditingHalacha(h)}
                      className="p-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs flex items-center gap-1 transition-colors"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>ערוך</span>
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
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
              <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-amber-200 p-6 sm:p-8 space-y-6 my-8">
                <div className="flex items-center justify-between border-b border-amber-100 pb-4">
                  <h3 className="text-xl font-extrabold text-amber-950 font-['Heebo']">
                    עריכת הלכה יומית וחידון
                  </h3>
                  <button
                    onClick={() => setEditingHalacha(null)}
                    className="text-slate-400 hover:text-slate-600 font-bold"
                  >
                    סגור ✕
                  </button>
                </div>

                <div className="space-y-4 max-h-[65vh] overflow-y-auto pl-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">מקור בספר "אהלי הלכה" (לדוגמה: אהלי הלכה - חלק א', פרק כ')</label>
                    <input
                      type="text"
                      value={editingHalacha.source || ''}
                      onChange={(e) =>
                        setEditingHalacha({ ...editingHalacha, source: e.target.value })
                      }
                      placeholder='אהלי הלכה - מאת הרב מאיר בראלי (בנשיאות הרב יעקב אריאל שליט"א)'
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

                  {/* Questions Edit Block */}
                  <div className="pt-4 border-t border-amber-100 space-y-4">
                    <h4 className="font-extrabold text-amber-950 text-base">
                      4 שאלות החידון היומי:
                    </h4>

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
          {pendingStudents.length > 0 && (
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
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-900 text-sm">{s.fullName}</span>
                        <span className="bg-amber-100 text-amber-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                          כיתה {s.className}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-mono">
                        שם משתמש: <strong className="text-amber-900">{s.username}</strong>
                      </p>
                      <p className="text-[11px] text-slate-400">
                        שכבה {s.grade}' {s.registeredAt ? `• ${new Date(s.registeredAt).toLocaleDateString('he-IL')}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => handleApproveStudent(s.id)}
                        className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        <span>אישור הרשמה</span>
                      </button>
                      <button
                        onClick={() => handleRejectStudent(s.id, s.fullName)}
                        className="py-2 px-3 bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                        title="דחה הרשמה"
                      >
                        <X className="w-4 h-4" />
                        <span>דחייה</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
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
                    <th className="p-3">כיתה</th>
                    <th className="p-3">שכבה</th>
                    <th className="p-3">שם משתמש</th>
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
                      <td className="p-3 font-semibold text-amber-900">{s.className}</td>
                      <td className="p-3 font-semibold text-slate-700">{s.grade}'</td>
                      <td className="p-3 text-slate-500 font-mono">{s.username}</td>
                      <td className="p-3">
                        {s.status === 'pending' ? (
                          <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 w-fit">
                            <Clock className="w-3 h-3 text-amber-700" />
                            ממתינה לאישור
                          </span>
                        ) : s.status === 'rejected' ? (
                          <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            נגנזה
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
                              className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 transition-colors"
                              title="אישור תלמידה"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
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
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
              <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-amber-200 p-6 space-y-5 my-8">
                <div className="flex items-center justify-between border-b border-amber-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                      <UserPlus className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-extrabold text-amber-950 font-['Heebo']">
                      הוספת תלמידה חדשה
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsAddStudentModalOpen(false)}
                    className="text-slate-400 hover:text-slate-600 font-bold"
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

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        שכבה <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={newStudent.grade}
                        onChange={(e) => setNewStudent({ ...newStudent, grade: e.target.value as GradeType })}
                        className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                      >
                        <option value="ט">שכבת ט'</option>
                        <option value="י">שכבת י'</option>
                        <option value="יא">שכבת יא'</option>
                        <option value="יב">שכבת יב'</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        כיתה <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="לדוגמה: ט'1"
                        value={newStudent.className}
                        onChange={(e) => setNewStudent({ ...newStudent, className: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
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
                        סיסמה ראשונית
                      </label>
                      <input
                        type="text"
                        placeholder="123"
                        value={newStudent.password}
                        onChange={(e) => setNewStudent({ ...newStudent, password: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                      />
                    </div>
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
          TAB 4: INVITATIONS & CLASS CODES MANAGEMENT
      ==================================================== */}
      {activeAdminTab === 'invitations' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-amber-200/80 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-100 pb-4">
              <div>
                <h3 className="text-xl font-extrabold text-amber-950 font-['Heebo'] flex items-center gap-2">
                  <Key className="w-5 h-5 text-amber-600" />
                  <span>ניהול קודי הזמנה וקישורי הרשמה לתלמידות</span>
                </h3>
                <p className="text-xs text-amber-800">
                  צרו קודי הזמנה ייעודיים לכל כיתה ושכבה באולפנה. תלמידות שיירשמו עם הקוד יאושרו אוטומטית למבצע!
                </p>
              </div>

              <button
                onClick={() => setIsNewInvModalOpen(true)}
                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>יצירת קוד הזמנה חדש</span>
              </button>
            </div>

            {/* Invitations List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {invitations.map((inv) => {
                const isCopied = copiedInvId === inv.id;
                const percent = inv.maxUses > 0 ? Math.min(100, Math.round((inv.usedCount / inv.maxUses) * 100)) : 0;

                return (
                  <div
                    key={inv.id}
                    className="bg-amber-50/50 border border-amber-200/90 rounded-2xl p-5 space-y-4 hover:shadow-md transition-shadow relative"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="bg-amber-200/80 text-amber-950 text-[11px] font-extrabold px-2.5 py-0.5 rounded-md">
                          כיתה {inv.className} (שכבה {inv.grade}')
                        </span>
                        <h4 className="text-xl font-black font-mono text-amber-900 tracking-wider mt-2">
                          {inv.code}
                        </h4>
                      </div>

                      <button
                        onClick={() => handleDeleteInvitation(inv.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="מחק קוד"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Progress Uses */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                        <span>שימושים: {inv.usedCount} מתוך {inv.maxUses}</span>
                        <span>{percent}%</span>
                      </div>
                      <div className="w-full h-2 bg-amber-200/60 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-600 rounded-full transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    {/* Copy Link Button */}
                    <button
                      onClick={() => copyInviteLink(inv.code, inv.id)}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
                        isCopied
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-white border border-amber-300 text-amber-900 hover:bg-amber-100/50'
                      }`}
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-4 h-4 text-white" />
                          <span>הקישור הועתק בהצלחה!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-amber-700" />
                          <span>העתק קישור הרשמה ישיר</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* New Invitation Modal */}
          {isNewInvModalOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl p-6 border border-amber-200 shadow-2xl max-w-md w-full space-y-4 animate-in zoom-in-95">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-extrabold text-amber-950 text-base flex items-center gap-2 font-['Heebo']">
                    <Key className="w-5 h-5 text-amber-600" />
                    <span>יצירת קוד הזמנה חדש</span>
                  </h3>
                  <button
                    onClick={() => setIsNewInvModalOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCreateInvitation} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      קוד הזמנה (לדוגמה: ULPA-2026-T1) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="ULPA-2026-T1"
                      value={newInv.code}
                      onChange={(e) => setNewInv({ ...newInv, code: e.target.value.toUpperCase() })}
                      className="w-full p-2.5 rounded-xl border border-slate-300 font-mono text-xs font-bold text-amber-900 uppercase focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        שכבה *
                      </label>
                      <select
                        value={newInv.grade}
                        onChange={(e) => {
                          const g = e.target.value as GradeType;
                          setNewInv({ ...newInv, grade: g, className: `${g}'1` });
                        }}
                        className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                      >
                        <option value="ט">שכבת ט'</option>
                        <option value="י">שכבת י'</option>
                        <option value="יא">שכבת יא'</option>
                        <option value="יב">שכבת יב'</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        כיתה *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="ט'1"
                        value={newInv.className}
                        onChange={(e) => setNewInv({ ...newInv, className: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      מכסת שימושים מרבית
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={newInv.maxUses}
                      onChange={(e) => setNewInv({ ...newInv, maxUses: Number(e.target.value) })}
                      className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsNewInvModalOpen(false)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                    >
                      ביטול
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl text-xs font-extrabold text-white bg-amber-600 hover:bg-amber-700 shadow-sm"
                    >
                      צור קוד הזמנה
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
