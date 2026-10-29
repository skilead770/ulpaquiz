import React, { useState } from 'react';
import { Crown, Trophy, Plus, Trash2, RotateCcw, Save } from 'lucide-react';
import { PrizeMilestone, PrizeReportItem } from '../../../types';
import { DEFAULT_PRIZE_MILESTONES } from '../../../data/seedData';
import { getPrizeMilestones, savePrizeMilestonesApi } from '../../../lib/api';
import { renderAdminPrizeIcon } from '../prizeIcons';

interface PrizesTabProps {
  prizeReports: PrizeReportItem[];
  onRefreshData: () => void;
}

export const PrizesTab: React.FC<PrizesTabProps> = ({ prizeReports, onRefreshData }) => {
  const [prizeMilestones, setPrizeMilestones] = useState<PrizeMilestone[]>(DEFAULT_PRIZE_MILESTONES);
  const [prizeSaveError, setPrizeSaveError] = useState<string | null>(null);
  const [isSavingPrizes, setIsSavingPrizes] = useState(false);

  React.useEffect(() => {
    let active = true;
    getPrizeMilestones().then((milestones) => {
      if (active) {
        setPrizeMilestones(milestones.length > 0 ? milestones : DEFAULT_PRIZE_MILESTONES);
      }
    }).catch(() => {
      setPrizeMilestones(DEFAULT_PRIZE_MILESTONES);
    });
    return () => {
      active = false;
    };
  }, []);

  const handlePrizeMilestoneChange = (
    index: number,
    field: 'points' | 'title' | 'rewardDescription' | 'iconName',
    value: string | number
  ) => {
    setPrizeMilestones((prev) => prev.map((m, i) => {
      if (i !== index) return m;
      if (field === 'points') {
        return { ...m, points: Math.max(0, Number(value) || 0) };
      }
      return { ...m, [field]: String(value) };
    }));
  };

  const handleAddPrizeMilestone = () => {
    const maxPoints = prizeMilestones.length > 0
      ? Math.max(...prizeMilestones.map((m) => Number(m.points) || 0))
      : 0;
    const nextPoints = maxPoints > 0 ? maxPoints + 25 : 10;
    setPrizeMilestones((prev) => [
      ...prev,
      {
        points: nextPoints,
        title: '',
        rewardDescription: '',
        iconName: 'Gift',
      },
    ]);
  };

  const handleDeletePrizeMilestone = (index: number) => {
    if (prizeMilestones.length <= 1) {
      alert('חייב להישאר לפחות יעד פרס אחד מוגדר במערכת');
      return;
    }
    const target = prizeMilestones[index];
    const name = target.title || `${target.points} נקודות`;
    if (window.confirm(`האם את בטוחה שברצונך למחוק את יעד הפרס "${name}"?`)) {
      setPrizeMilestones((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleResetToDefaultPrizes = () => {
    if (window.confirm('האם לאפס את רשימת הפרסים לברירת המחדל של המערכת?')) {
      setPrizeMilestones(DEFAULT_PRIZE_MILESTONES);
    }
  };

  const handleSavePrizeMilestones = async () => {
    setIsSavingPrizes(true);
    setPrizeSaveError(null);
    try {
      const normalized = [...prizeMilestones]
        .map((m) => ({
          ...m,
          points: Math.max(0, Number(m.points) || 0),
          title: (m.title || '').trim(),
          rewardDescription: (m.rewardDescription || '').trim(),
          iconName: (m.iconName || 'Award').trim(),
        }))
        .filter((m) => m.title && m.rewardDescription)
        .sort((a, b) => a.points - b.points);

      if (normalized.length === 0) {
        throw new Error('יש להזין לפחות פרס אחד תקין עם כותרת ותיאור פרס');
      }

      await savePrizeMilestonesApi(normalized);
      setPrizeMilestones(normalized);
      await onRefreshData();
      alert('יעדי הפרסים נשמרו בהצלחה!');
    } catch (err: any) {
      setPrizeSaveError(err?.message || 'שגיאה בשמירת פרסים');
    } finally {
      setIsSavingPrizes(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 border border-amber-200/80 shadow-sm space-y-6">
        <div className="border-b border-amber-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-extrabold text-amber-950 font-['Heebo'] flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-600" />
              <span>ניהול והגדרת פרסים ויעדים</span>
            </h3>
            <p className="text-xs text-amber-800">
              הגדירי את רף הנקודות, שמות היעדים, תיאור הפרסים וסוגי האייקונים. הפרסים יוצגו לתלמידות בלוח האישי, בסיום חידון ובדוח הזכיות.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleResetToDefaultPrizes}
              className="px-3 py-2 rounded-xl text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="שחזור רשימת פרסי ברירת המחדל"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>שחזור ברירת מחדל</span>
            </button>

            <button
              type="button"
              onClick={handleAddPrizeMilestone}
              className="px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>הוסף יעד פרס חדש</span>
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {prizeMilestones.map((milestone, index) => (
            <div
              key={`milestone-${index}`}
              className="p-4 rounded-2xl border border-amber-200 bg-amber-50/50 hover:bg-amber-50/80 transition-all space-y-3 shadow-xs"
            >
              <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-500 text-white flex items-center justify-center font-black text-xs shadow-xs">
                    {renderAdminPrizeIcon(milestone.iconName || 'Award', 'w-4 h-4')}
                  </div>
                  <span className="text-xs font-extrabold text-amber-950 font-['Heebo']">
                    יעד פרס #{index + 1}: {milestone.title ? milestone.title : '(ללא כותרת)'} ({milestone.points} נק')
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeletePrizeMilestone(index)}
                  className="text-rose-600 hover:text-rose-800 hover:bg-rose-100 p-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
                  title="מחק יעד פרס זה"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">מחיקה</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">רף נקודות</label>
                  <input
                    type="number"
                    min={0}
                    value={milestone.points}
                    onChange={(e) => handlePrizeMilestoneChange(index, 'points', e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-bold focus:ring-2 focus:ring-amber-500 focus:outline-hidden bg-white"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">סוג סמל / אייקון</label>
                  <select
                    value={milestone.iconName || 'Award'}
                    onChange={(e) => handlePrizeMilestoneChange(index, 'iconName', e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-amber-500 focus:outline-hidden bg-white cursor-pointer"
                  >
                    <option value="Award">🏅 מדליה / הצטיינות</option>
                    <option value="Crown">👑 כתר תורה</option>
                    <option value="Trophy">🏆 גביע ניצחון</option>
                    <option value="Gift">🎁 מתנה / שי</option>
                    <option value="Star">⭐ כוכב הצטיינות</option>
                    <option value="Sparkles">✨ ניצוץ מיוחד</option>
                    <option value="BookOpen">📖 ספר קודש</option>
                    <option value="Bookmark">🔖 סימניה</option>
                    <option value="Heart">❤️ לב / הערכה</option>
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">כותרת היעד</label>
                  <input
                    type="text"
                    placeholder="למשל: אלופת ההלכה"
                    value={milestone.title}
                    onChange={(e) => handlePrizeMilestoneChange(index, 'title', e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-bold focus:ring-2 focus:ring-amber-500 focus:outline-hidden bg-white"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">תיאור הפרס והזכייה</label>
                  <input
                    type="text"
                    placeholder="למשל: ספר הלכה יוקרתי עם הקדשה אישית"
                    value={milestone.rewardDescription}
                    onChange={(e) => handlePrizeMilestoneChange(index, 'rewardDescription', e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-hidden bg-white"
                  />
                </div>
              </div>
            </div>
          ))}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleAddPrizeMilestone}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-extrabold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>הוסף יעד פרס נוסף</span>
            </button>

            <button
              type="button"
              onClick={handleSavePrizeMilestones}
              disabled={isSavingPrizes}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-black text-white bg-amber-700 hover:bg-amber-800 shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isSavingPrizes ? 'שומר שינויים...' : 'שמור שינויים בפרסים'}</span>
            </button>
          </div>

          {prizeSaveError && (
            <p className="text-xs font-bold text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-200">
              {prizeSaveError}
            </p>
          )}
        </div>

        <div className="border-t border-amber-100 pt-5 space-y-3">
          <h4 className="font-extrabold text-amber-950 text-sm flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-600" />
            <span>תלמידות שהגיעו ליעד פרס אישי:</span>
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(Array.isArray(prizeReports) ? prizeReports : [])
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
                        {renderAdminPrizeIcon(m.iconName, 'w-3.5 h-3.5 text-emerald-700 shrink-0')}
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
  );
};
