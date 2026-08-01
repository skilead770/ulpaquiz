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
} from 'lucide-react';
import { Student, DailyHalacha, PrizeReportItem, Question, GradeType } from '../types';
import { ExcelUploader } from './ExcelUploader';
import {
  bulkImportStudentsApi,
  saveHalachaApi,
  deleteHalachaApi,
  generateAiHalachaApi,
} from '../lib/api';

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
    'halachot' | 'students' | 'prizes'
  >('halachot');

  // Student Search / Filter State
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [studentFilterClass, setStudentFilterClass] = useState<string>('ALL');

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
          <ExcelUploader onStudentsLoaded={handleExcelImport} />

          {/* Student Search & Table */}
          <div className="bg-white rounded-3xl p-6 border border-amber-200/80 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-100 pb-4">
              <div>
                <h3 className="text-xl font-extrabold text-amber-950 font-['Heebo']">
                  רשימת התלמידות הרשומות ({students.length})
                </h3>
                <p className="text-xs text-amber-800">
                  סינון, חיפוש ובדק של מאזן הניקוד האישי.
                </p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
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
                    <th className="p-3">ניקוד מצטבר</th>
                    <th className="p-3">חידונים שהושלמו</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {filteredStudents.map((s) => (
                    <tr key={s.id} className="hover:bg-amber-50/50">
                      <td className="p-3 font-bold text-slate-900">{s.fullName}</td>
                      <td className="p-3 font-semibold text-amber-900">{s.className}</td>
                      <td className="p-3 font-semibold text-slate-700">{s.grade}'</td>
                      <td className="p-3 text-slate-500 font-mono">{s.username}</td>
                      <td className="p-3 font-black text-amber-950 font-['Heebo']">{s.points} נק'</td>
                      <td className="p-3">
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {s.completedDates.length} ימים
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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
    </div>
  );
};
