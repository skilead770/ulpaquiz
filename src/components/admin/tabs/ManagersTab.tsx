import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Sparkles,
  UserPlus,
  UserCheck,
  Users,
  Crown,
  Shield,
  Trash2,
  Mail,
} from 'lucide-react';
import { Manager } from '../../../types';
import { fetchManagersApi, addManagerApi, deleteManagerApi } from '../../../lib/api';
import { SUPER_ADMIN_EMAIL } from '../../../lib/config';

export const ManagersTab: React.FC = () => {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [newManagerEmail, setNewManagerEmail] = useState('');
  const [newManagerName, setNewManagerName] = useState('');
  const [isAddingManager, setIsAddingManager] = useState(false);
  const [managerMsg, setManagerMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-800 via-amber-900 to-slate-900 text-white p-6 sm:p-7 rounded-3xl shadow-sm relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-600/50 border border-amber-300/30 rounded-full text-xs font-bold text-amber-200">
              <Shield className="w-3.5 h-3.5 text-yellow-300" />
              <span>ניהול הרשאות וצוות</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black font-['Heebo']">
              מנהלי מערכת מורשים
            </h2>
            <p className="text-xs sm:text-sm text-amber-100/80 max-w-xl leading-relaxed">
              הוספה וניהול של אנשי צוות המורשים לאשר תלמידות, לערוך הלכות וחידונים, ולצפות בדו"חות הזוכים.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md border border-white/20 p-3.5 rounded-2xl text-right sm:min-w-[240px]">
            <span className="text-[11px] text-amber-200 font-medium block">מנהל ראשי נוכחי:</span>
            <span className="text-sm font-extrabold text-white font-mono dir-ltr block">
              {SUPER_ADMIN_EMAIL}
            </span>
            <span className="inline-block mt-1 px-2 py-0.5 bg-yellow-400/20 text-yellow-300 text-[10px] font-bold rounded-md border border-yellow-400/30">
              סופר-אדמין (קבוע)
            </span>
          </div>
        </div>
      </div>

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

      <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-5 text-amber-950 space-y-2">
        <h3 className="text-sm font-extrabold flex items-center gap-2 text-amber-900">
          <Sparkles className="w-4 h-4 text-amber-600" />
          <span>כיצד מנהל נכנס למערכת?</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs leading-relaxed text-amber-900/90">
          <div className="bg-white/80 p-3 rounded-xl border border-amber-200/60 space-y-1">
            <span className="font-extrabold text-amber-800 block">1. הזנת כתובת ה-Gmail</span>
            <p>במסך הכניסה, מזינים את כתובת ה-Gmail המורשית (למשל {SUPER_ADMIN_EMAIL}).</p>
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

      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-extrabold text-slate-800">
              רשימת מנהלי המערכת ({Array.isArray(managers) ? managers.length : 0})
            </h3>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {(Array.isArray(managers) ? managers : []).map((m) => {
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
  );
};
