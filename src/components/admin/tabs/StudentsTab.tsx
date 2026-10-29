import React from 'react';
import {
  Search, Edit, Trash2, Check, X, Mail, Clock, UserCheck, RotateCcw, Eye,
  AlertCircle, CheckCircle2, RefreshCw, Save,
} from 'lucide-react';
import { Student, GradeType, inferGradeFromClass } from '../../../types';

interface StudentsTabProps {
  students: Student[];
  studentsLoadError: string | null;
  isRefreshing: boolean;
  handleManualRefresh: () => Promise<void>;
  pendingStudents: Student[];
  handleApproveStudent: (studentId: string) => Promise<void>;
  handleOpenEditStudent: (s: Student) => void;
  handleRejectStudent: (studentId: string, studentName: string) => Promise<void>;
  editingStudent: Student | null;
  setEditingStudent: (s: Student | null) => void;
  editStudentError: string | null;
  isUpdatingStudent: boolean;
  isResettingQuiz: boolean;
  handleSaveEditedStudent: (e: React.FormEvent) => Promise<void>;
  handleResetQuiz: (studentId: string, date: string) => Promise<void>;
  handleDeleteStudent: (studentId: string, studentName: string) => Promise<void>;
  handleOpenScoreResetModal: (type: 'class' | 'grade', value: string) => void;
  studentSearchTerm: string;
  setStudentSearchTerm: (value: string) => void;
  studentFilterClass: string;
  setStudentFilterClass: (value: string) => void;
  studentSortOrder: 'class' | 'name' | 'points';
  setStudentSortOrder: (order: 'class' | 'name' | 'points') => void;
  filteredStudents: Student[];
  uniqueClasses: string[];
  classesList: string[];
  setInspectingStudentHistory: (student: Student | null) => void;
}

export const StudentsTab: React.FC<StudentsTabProps> = ({
  students,
  studentsLoadError,
  isRefreshing,
  handleManualRefresh,
  pendingStudents,
  handleApproveStudent,
  handleOpenEditStudent,
  handleRejectStudent,
  editingStudent,
  setEditingStudent,
  editStudentError,
  isUpdatingStudent,
  isResettingQuiz,
  handleSaveEditedStudent,
  handleResetQuiz,
  handleDeleteStudent,
  handleOpenScoreResetModal,
  studentSearchTerm,
  setStudentSearchTerm,
  studentFilterClass,
  setStudentFilterClass,
  studentSortOrder,
  setStudentSortOrder,
  filteredStudents,
  uniqueClasses,
  classesList,
  setInspectingStudentHistory,
}) => {
  return (
<div className="space-y-6">
  {studentsLoadError && (
    <div role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm font-bold text-rose-800">
      <p>לא ניתן לטעון את רשימת התלמידות או בקשות ההרשמה.</p>
      <p className="mt-1 text-xs font-medium">{studentsLoadError}</p>
      <button
        type="button"
        onClick={handleManualRefresh}
        disabled={isRefreshing}
        className="mt-3 rounded-xl border border-rose-300 bg-white px-3 py-1.5 text-xs font-bold text-rose-800 disabled:opacity-50"
      >
        {isRefreshing ? 'מרענן...' : 'נסי לרענן'}
      </button>
    </div>
  )}

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

  {/* Student Search & Table */}
  <div className="bg-white rounded-3xl p-6 border border-amber-200/80 shadow-sm space-y-4">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-100 pb-4">
      <div>
        <h3 className="text-xl font-extrabold text-amber-950 font-['Heebo']">
          רשימת התלמידות הרשומות ({filteredStudents.length} מתוך {students.length})
        </h3>
        <p className="text-xs text-amber-800">
          חיפוש תלמידה, סינון לפי כיתה ומיון הרשימה.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            aria-label="חיפוש תלמידה לפי שם, Gmail או שם משתמש"
            placeholder="חיפוש לפי שם או Gmail..."
            value={studentSearchTerm}
            onChange={(e) => setStudentSearchTerm(e.target.value)}
            className="pr-9 pl-3 py-1.5 rounded-xl border border-amber-300 text-xs bg-amber-50/40"
          />
        </div>

        <select
          aria-label="סינון לפי כיתה"
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

        {studentFilterClass !== 'ALL' && (
          <button
            type="button"
            onClick={() => handleOpenScoreResetModal('class', studentFilterClass)}
            className="px-2.5 py-1.5 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
            title={`איפוס ניקוד כיתה ${studentFilterClass}`}
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
            <span>איפוס ניקוד כיתה</span>
          </button>
        )}

        <select
          aria-label="מיון רשימת התלמידות"
          value={studentSortOrder}
          onChange={(e) => setStudentSortOrder(e.target.value as typeof studentSortOrder)}
          className="px-3 py-1.5 rounded-xl border border-amber-300 text-xs bg-amber-50/40 font-bold text-amber-950"
        >
          <option value="class">מיון לפי כיתה</option>
          <option value="name">מיון לפי שם</option>
          <option value="points">מיון לפי ניקוד</option>
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
          {filteredStudents.length === 0 ? (
            <tr>
              <td colSpan={8} className="p-6 text-center text-sm font-semibold text-slate-500">
                לא נמצאו תלמידות לפי החיפוש והסינון שנבחרו.
              </td>
            </tr>
          ) : filteredStudents.map((s) => (
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
                    onClick={() => setInspectingStudentHistory(s)}
                    className="p-1.5 rounded-lg text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer"
                    title="צפייה בהגשות וחידונים של התלמידה"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
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

          {/* Quiz Submissions & Reset */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-700">
              הגשות חידונים של התלמידה ({editingStudent.completedDates?.length || 0})
            </label>
            {(!editingStudent.completedDates || editingStudent.completedDates.length === 0) ? (
              <p className="text-xs text-slate-400 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                אין הגשות חידונים לתלמידה זו עדיין.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {editingStudent.completedDates.map((date) => {
                  const sub = editingStudent.submissions?.[date];
                  return (
                    <div
                      key={date}
                      className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-800">{date}</span>
                        {sub && (
                          <span className="text-slate-500 mr-2">
                            ({sub.score}/4 נכון • +{sub.earnedPoints} נק')
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={isResettingQuiz}
                        onClick={() => handleResetQuiz(editingStudent.id, date)}
                        className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-bold flex items-center gap-1 transition-colors disabled:opacity-50"
                      >
                        <RotateCcw className={`w-3 h-3 ${isResettingQuiz ? 'animate-spin' : ''}`} />
                        <span>אפס הגשה</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
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
  );
};
