import React, { useState } from 'react';
import {
  School,
  Plus,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  Trash2,
  Users,
  GraduationCap,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  Edit3,
} from 'lucide-react';
import { SchoolConfig } from '../../types';
import { useSchool } from '../../lib/schoolContext';
import { SchoolBuilderModal } from './SchoolBuilderModal';
import { deleteSchoolApi } from '../../lib/api';
import { SUPER_ADMIN_EMAIL } from '../../lib/config';

interface SchoolNetworkAdminProps {
  onSelectSchool?: (schoolId: string) => void;
}

export const SchoolNetworkAdmin: React.FC<SchoolNetworkAdminProps> = ({ onSelectSchool }) => {
  const { allSchools, school: currentSchool, setSchoolId, refreshSchools } = useSchool();
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [copiedSchoolId, setCopiedSchoolId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCopyLink = (schoolId: string) => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}?school=${schoolId}`;
    navigator.clipboard.writeText(url);
    setCopiedSchoolId(schoolId);
    setTimeout(() => setCopiedSchoolId(null), 2000);
  };

  const handleSwitchSchool = (schoolId: string) => {
    setSchoolId(schoolId);
    if (onSelectSchool) {
      onSelectSchool(schoolId);
    }
  };

  const handleDelete = async (schoolId: string) => {
    if (schoolId === 'even-shmuel' || schoolId === 'default') {
      alert('לא ניתן למחוק את מוסד ברירת המחדל');
      return;
    }
    setIsDeleting(true);
    try {
      await deleteSchoolApi(schoolId);
      await refreshSchools();
      setDeleteConfirmId(null);
    } catch (err: any) {
      alert(err?.message || 'שגיאה במחיקת המוסד');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Banner / Actions */}
      <div className="bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-indigo-900/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-md">
              <School className="w-5 h-5" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black font-['Heebo']">
              רשת מוסדות הלימוד (ישיבות ואולפנות)
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
            ניהול כלל בתי הספר המשתמשים במערכת. כל מוסד נהנה ממרחב משתמשים וניהול מבודד, תוך שימוש במאגר ההלכות והשאלות המרכזי.
          </p>
        </div>

        <button
          onClick={() => setIsBuilderOpen(true)}
          className="self-start sm:self-auto px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all cursor-pointer hover:scale-105 active:scale-95 shrink-0"
        >
          <Plus className="w-5 h-5" />
          <span>הקמת מוסד חדש</span>
        </button>
      </div>

      {/* Schools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {allSchools.map((s) => {
          const isActiveCurrent = currentSchool.id === s.id;
          const isBoys = s.gender === 'boys';

          return (
            <div
              key={s.id}
              className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between shadow-xs ${
                isActiveCurrent
                  ? 'border-indigo-600 ring-2 ring-indigo-500/20 shadow-md'
                  : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              {/* Card Header */}
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-xs shrink-0"
                      style={{ backgroundColor: s.primaryColor || (isBoys ? '#1d4ed8' : '#7c3aed') }}
                    >
                      {s.logoUrl ? (
                        <img
                          src={s.logoUrl}
                          alt={s.name}
                          className="w-10 h-10 object-contain rounded-xl"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : isBoys ? (
                        '👨‍🎓'
                      ) : (
                        '👩‍🎓'
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-slate-900 text-base truncate font-['Heebo']">
                        {s.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isBoys
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {isBoys ? 'ישיבה תיכונית (בנים)' : 'אולפנא (בנות)'}
                        </span>
                        {isActiveCurrent && (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>מוסד פעיל כעת</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* School Details */}
                <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">מזהה (Slug):</span>
                    <span className="font-mono font-bold text-slate-800" dir="ltr">{s.id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">רכז/ת אחראי/ת:</span>
                    <span className="font-medium text-slate-800 truncate max-w-[170px]" dir="ltr">
                      {s.mainManagerEmail}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">כיתות פעילות:</span>
                    <span className="font-bold text-slate-800">
                      {s.defaultClasses ? s.defaultClasses.length : 8} כיתות
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Footer / Actions */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleCopyLink(s.id)}
                  title="העתק קישור למוסד"
                  className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-all cursor-pointer flex items-center gap-1 text-xs font-bold shrink-0"
                >
                  {copiedSchoolId === s.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">הועתק!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>קישור</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-2">
                  {s.id !== 'even-shmuel' && s.id !== 'default' && (
                    <button
                      onClick={() => setDeleteConfirmId(s.id)}
                      title="מחק מוסד"
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    onClick={() => handleSwitchSchool(s.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                      isActiveCurrent
                        ? 'bg-slate-200 text-slate-700 cursor-default'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                    }`}
                  >
                    <span>{isActiveCurrent ? 'מוצג כעת' : 'צפה במוסד'}</span>
                    {!isActiveCurrent && <ArrowRight className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* Delete Confirmation Modal */}
              {deleteConfirmId === s.id && (
                <div className="p-4 bg-rose-50 border-t border-rose-200 space-y-2 animate-in fade-in duration-150">
                  <p className="text-xs font-bold text-rose-900">
                    האם אתה בטוח שברצונך למחוק את {s.name}?
                  </p>
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                    >
                      ביטול
                    </button>
                    <button
                      disabled={isDeleting}
                      onClick={() => handleDelete(s.id)}
                      className="px-2.5 py-1 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
                    >
                      {isDeleting ? 'מוחק...' : 'אישור מחיקה'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Builder Modal */}
      <SchoolBuilderModal
        isOpen={isBuilderOpen}
        onClose={() => setIsBuilderOpen(false)}
        onSchoolCreated={(newSchool) => {
          setIsBuilderOpen(false);
          handleSwitchSchool(newSchool.id);
        }}
      />
    </div>
  );
};

