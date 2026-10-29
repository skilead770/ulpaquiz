import React, { useState } from 'react';
import { GraduationCap, Plus, CheckCircle2, AlertCircle, Trophy, RotateCcw, Trash2 } from 'lucide-react';
import { Student, GradeType, inferGradeFromClass } from '../../../types';
import { addClassApi, deleteClassApi } from '../../../lib/api';

interface ClassesTabProps {
  classesList: string[];
  uniqueClasses: string[];
  availableGrades: string[];
  students: Student[];
  onClassesChange: (updated: string[]) => void;
  onOpenScoreResetModal: (type: 'class' | 'grade', value: string) => void;
  onNavigateToStudents: (filterClass: string) => void;
}

export const ClassesTab: React.FC<ClassesTabProps> = ({
  classesList,
  uniqueClasses,
  availableGrades,
  students,
  onClassesChange,
  onOpenScoreResetModal,
  onNavigateToStudents,
}) => {
  const [newClassName, setNewClassName] = useState('');
  const [isAddingClass, setIsAddingClass] = useState(false);
  const [classMsg, setClassMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    setIsAddingClass(true);
    setClassMsg(null);
    try {
      const updated = await addClassApi(newClassName.trim());
      onClassesChange(updated);
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
    if (studentsInClass > 0) {
      setClassMsg({
        type: 'error',
        text: `לא ניתן למחוק את הכיתה "${classNameToDelete}" כל עוד משויכות אליה ${studentsInClass} תלמידות רשומות.`,
      });
      return;
    }
    const confirmMsg = `האם למחוק את הכיתה "${classNameToDelete}" מרשימת הכיתות?`;
    if (confirm(confirmMsg)) {
      try {
        const updated = await deleteClassApi(classNameToDelete);
        onClassesChange(updated);
        setClassMsg({ type: 'success', text: `הכיתה "${classNameToDelete}" הוסרה בהצלחה!` });
      } catch (err: any) {
        setClassMsg({ type: 'error', text: err.message || 'שגיאה במחיקת כיתה' });
      }
    }
  };

  return (
    <div className="space-y-6">
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
                  {uniqueClasses.length} כיתות פעילות
                </span>
              </h3>
              <p className="text-xs text-amber-800">
                הכיתות המוגדרות כאן מופיעות ישירות בטופס ההרשמה של התלמידות, במסכי הסינון, בלוח המובילים וביצירת קודי הזמנה.
              </p>
            </div>
          </div>
        </div>

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

      <div className="bg-white rounded-3xl p-6 border border-amber-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-100 pb-3">
          <div>
            <h4 className="text-base font-extrabold text-amber-950 font-['Heebo'] flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-600" />
              <span>שכבות האולפנה ואיפוס ניקוד שכבתי</span>
            </h4>
            <p className="text-xs text-amber-800">
              ניהול הניקוד המצטבר לפי שכבה (ט', י', י״א, י״ב). ניתן לאפס את ניקוד כל השכבה לתחילת תקופת מבצע חדשה.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(availableGrades as GradeType[]).map((g) => {
            const gStudents = students.filter(
              (s) => !s.managerParticipation && ((s.grade || '').trim() === g || inferGradeFromClass(s.className || '') === g)
            );
            const gPoints = gStudents.reduce((sum, s) => sum + (s.points || 0), 0);
            const gClasses = uniqueClasses.filter((cls) => inferGradeFromClass(cls) === g);

            return (
              <div
                key={g}
                className="bg-gradient-to-br from-amber-50/60 to-orange-50/40 border border-amber-200/80 p-4 rounded-2xl flex flex-col justify-between space-y-3 shadow-2xs hover:shadow-xs transition-all"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center font-black text-sm shadow-2xs">
                        {g}'
                      </div>
                      <div>
                        <span className="font-extrabold text-slate-900 text-base block">
                          שכבת {g}'
                        </span>
                        <span className="text-[11px] text-slate-500 font-semibold">
                          {gClasses.length > 0 ? gClasses.join(', ') : 'אין כיתות מוגדרות'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-amber-100 text-xs">
                    <div className="bg-white/80 p-2 rounded-xl border border-amber-200/50">
                      <span className="text-[10px] text-slate-500 block font-bold">תלמידות</span>
                      <span className="text-sm font-black text-slate-800">{gStudents.length}</span>
                    </div>
                    <div className="bg-white/80 p-2 rounded-xl border border-amber-200/50">
                      <span className="text-[10px] text-amber-700 block font-bold">ניקוד שכבה</span>
                      <span className="text-sm font-black text-amber-950 font-['Heebo']">{gPoints} נק׳</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-amber-100">
                  <button
                    type="button"
                    onClick={() => onOpenScoreResetModal('grade', g)}
                    className="w-full py-2 px-3 rounded-xl text-xs font-extrabold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                    title={`איפוס ניקוד שכבת ${g}' ל-0`}
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                    <span>איפוס ניקוד שכבה</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-amber-200/80 shadow-xs space-y-4">
        <h4 className="text-sm font-extrabold text-amber-950 font-['Heebo']">
          רשימת הכיתות הפעילות
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {uniqueClasses.map((cls) => {
            const clsStudents = students.filter((s) => s.className === cls && !s.managerParticipation);
            const count = clsStudents.length;
            const clsPoints = clsStudents.reduce((sum, s) => sum + (s.points || 0), 0);
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

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-amber-100 text-xs">
                  <div className="bg-white/80 p-2 rounded-xl border border-amber-200/50">
                    <span className="text-[10px] text-slate-500 block font-bold">תלמידות</span>
                    <span className="text-sm font-black text-slate-800">{count}</span>
                  </div>
                  <div className="bg-white/80 p-2 rounded-xl border border-amber-200/50">
                    <span className="text-[10px] text-amber-700 block font-bold">ניקוד כיתתי</span>
                    <span className="text-sm font-black text-amber-950 font-['Heebo']">{clsPoints} נק׳</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-amber-100 text-xs gap-1.5">
                  <button
                    type="button"
                    onClick={() => onOpenScoreResetModal('class', cls)}
                    className="py-1.5 px-2.5 rounded-lg text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/70 transition-colors flex items-center gap-1 cursor-pointer"
                    title={`איפוס ניקוד כיתה ${cls}`}
                  >
                    <RotateCcw className="w-3 h-3 text-rose-600" />
                    <span>איפוס ניקוד</span>
                  </button>

                  {count > 0 && (
                    <button
                      type="button"
                      onClick={() => onNavigateToStudents(cls)}
                      className="text-[11px] font-bold text-amber-700 hover:text-amber-900 hover:underline flex items-center gap-0.5"
                    >
                      <span>תלמידות</span>
                      <span>←</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
