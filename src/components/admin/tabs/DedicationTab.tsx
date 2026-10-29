import React, { useState } from 'react';
import { Heart, Save } from 'lucide-react';
import { getDailyQuizDedicationApi, saveDailyQuizDedicationApi } from '../../../lib/api';

interface DedicationTabProps {
  onDailyDedicationChange: (name: string) => void;
}

export const DedicationTab: React.FC<DedicationTabProps> = ({ onDailyDedicationChange }) => {
  const [dailyQuizDedication, setDailyQuizDedication] = useState('');
  const [isLoadingDailyQuizDedication, setIsLoadingDailyQuizDedication] = useState(true);
  const [isSavingDailyQuizDedication, setIsSavingDailyQuizDedication] = useState(false);
  const [dailyQuizDedicationMessage, setDailyQuizDedicationMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  React.useEffect(() => {
    let active = true;
    getDailyQuizDedicationApi()
      .then((name) => {
        if (active) setDailyQuizDedication(name);
      })
      .catch((error: unknown) => {
        console.error('[Firestore] Could not load the daily quiz dedication:', error);
        if (active) {
          setDailyQuizDedicationMessage({
            type: 'error',
            text: 'לא ניתן לטעון את הקדשת החידון. אפשר לנסות לרענן את הדף.',
          });
        }
      })
      .finally(() => {
        if (active) setIsLoadingDailyQuizDedication(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSaveDailyQuizDedication = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSavingDailyQuizDedication(true);
    setDailyQuizDedicationMessage(null);
    try {
      const savedName = await saveDailyQuizDedicationApi(dailyQuizDedication);
      setDailyQuizDedication(savedName);
      onDailyDedicationChange(savedName);
      setDailyQuizDedicationMessage({
        type: 'success',
        text: savedName ? 'הקדשת החידון נשמרה בהצלחה.' : 'ההקדשה הוסרה.',
      });
    } catch (error) {
      console.error('[Firestore] Could not save the daily quiz dedication:', error);
      setDailyQuizDedicationMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'לא ניתן לשמור את הקדשת החידון.',
      });
    } finally {
      setIsSavingDailyQuizDedication(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-amber-200 shadow-sm space-y-5">
      <div className="flex items-start gap-3 border-b border-amber-100 pb-4">
        <div className="w-12 h-12 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
          <Heart className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-xl font-extrabold text-amber-950 font-['Heebo']">
            הקדשת החידון היומי
          </h3>
          <p className="mt-1 text-xs text-amber-800">
            נוסח ההקדשה שיוזן כאן יוצג בכותרת הראשית לתלמידות. השאירי את השדה ריק כדי להסיר אותה.
          </p>
        </div>
      </div>

      <form onSubmit={handleSaveDailyQuizDedication} className="space-y-4">
        <div>
          <label htmlFor="daily-quiz-dedication" className="block text-sm font-bold text-slate-700 mb-1.5">
            נוסח ההקדשה
          </label>
          <input
            id="daily-quiz-dedication"
            type="text"
            dir="auto"
            maxLength={120}
            value={dailyQuizDedication}
            onChange={(event) => setDailyQuizDedication(event.target.value)}
            disabled={isLoadingDailyQuizDedication || isSavingDailyQuizDedication}
            placeholder="לדוגמה: לעילוי נשמת ישראלה ישראלי ע״ה, לרפואת..., לכבוד..."
            className="w-full max-w-xl p-3 rounded-xl border border-amber-300 bg-white text-sm font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden disabled:bg-slate-100"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            עד 120 תווים. ההודעה תופיע כך: "חידון היום מוקדש: {dailyQuizDedication.trim() || '...'}".
          </p>
        </div>

        {dailyQuizDedicationMessage && (
          <p
            role={dailyQuizDedicationMessage.type === 'error' ? 'alert' : 'status'}
            className={`text-xs font-bold ${
              dailyQuizDedicationMessage.type === 'success' ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {dailyQuizDedicationMessage.text}
          </p>
        )}

        <button
          type="submit"
          disabled={isLoadingDailyQuizDedication || isSavingDailyQuizDedication}
          className="px-5 py-2.5 rounded-xl text-xs font-extrabold text-white bg-amber-600 hover:bg-amber-700 transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>
            {isLoadingDailyQuizDedication
              ? 'טוען...'
              : isSavingDailyQuizDedication
                ? 'שומר...'
                : 'שמור הקדשה'}
          </span>
        </button>
      </form>
    </div>
  );
};
