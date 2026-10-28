import React, { useState } from 'react';
import {
  X,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Send,
  HelpCircle,
  BookOpen,
} from 'lucide-react';
import { Student, QuestionFeedback, QuestionFeedbackType } from '../types';
import { submitQuestionFeedbackApi } from '../lib/api';
import { auth } from '../lib/firebaseClient';

interface QuestionFeedbackModalProps {
  student: Student;
  isOpen?: boolean;
  onClose: () => void;
  questionContext: {
    date: string;
    halachaId?: string;
    halachaTitle?: string;
    questionId: string;
    questionText: string;
  } | null;
  onSubmitted?: (feedback: QuestionFeedback) => void;
}

const FEEDBACK_TYPES: { id: QuestionFeedbackType; label: string; icon: string }[] = [
  { id: 'halachic_note', label: 'הערה הלכתית / דעה נוספת', icon: '📜' },
  { id: 'error_report', label: 'טעות ניסוח / הגהה / הקלדה', icon: '✍️' },
  { id: 'suggestion', label: 'הצעה לשיפור השאלה', icon: '💡' },
  { id: 'other', label: 'נושא אחר', icon: '💬' },
];

export const QuestionFeedbackModal: React.FC<QuestionFeedbackModalProps> = ({
  student,
  isOpen = true,
  onClose,
  questionContext,
  onSubmitted,
}) => {
  const isGeneral = questionContext?.questionId === 'general';
  const isHalacha = questionContext?.questionId === 'daily-halacha';

  const [feedbackType, setFeedbackType] = useState<QuestionFeedbackType>(
    isGeneral ? 'suggestion' : 'halachic_note'
  );
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Sync default type when opening in different context
  React.useEffect(() => {
    if (isGeneral) {
      setFeedbackType('suggestion');
    } else {
      setFeedbackType('halachic_note');
    }
  }, [questionContext?.questionId]);

  if (!isOpen || !questionContext) return null;

  const feedbackOptions: { id: QuestionFeedbackType; label: string; icon: string }[] = isGeneral
    ? [
        { id: 'suggestion', label: 'הצעה לשיפור / רעיון חדש', icon: '💡' },
        { id: 'halachic_note', label: 'הערה על תוכן ההלכות', icon: '📜' },
        { id: 'error_report', label: 'דיווח על תקלה / שגיאה', icon: '✍️' },
        { id: 'other', label: 'משוב כללי אחר', icon: '💬' },
      ]
    : isHalacha
    ? [
        { id: 'halachic_note', label: 'הערה הלכתית / מקור נוסף', icon: '📜' },
        { id: 'error_report', label: 'טעות ניסוח / הגהה בהלכה', icon: '✍️' },
        { id: 'suggestion', label: 'הצעה לניסוח או הסבר טוב יותר', icon: '💡' },
        { id: 'other', label: 'נושא אחר', icon: '💬' },
      ]
    : [
        { id: 'halachic_note', label: 'הערה הלכתית / דעה נוספת', icon: '📜' },
        { id: 'error_report', label: 'טעות ניסוח / הגהה / הקלדה', icon: '✍️' },
        { id: 'suggestion', label: 'הצעה לשיפור השאלה', icon: '💡' },
        { id: 'other', label: 'נושא אחר', icon: '💬' },
      ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanComment = comment.trim();
    if (!cleanComment) {
      setErrorMsg('אנא כתבי את תוכן ההערה.');
      return;
    }

    setIsSubmitting(true);
    try {
      const currentUserEmail = auth.currentUser?.email?.toLowerCase().trim();
      const studentEmail = (currentUserEmail || student.email || '').toLowerCase().trim() || undefined;

      const created = await submitQuestionFeedbackApi({
        date: questionContext.date,
        halachaId: questionContext.halachaId,
        halachaTitle: questionContext.halachaTitle,
        questionId: questionContext.questionId,
        questionText: questionContext.questionText,
        studentId: student.id,
        studentName: student.fullName,
        studentEmail,
        className: student.className,
        feedbackType,
        comment: cleanComment,
      });

      setIsSuccess(true);
      if (onSubmitted) {
        onSubmitted(created);
      }
    } catch (err: any) {
      console.error('Failed to submit question feedback:', err);
      setErrorMsg(err?.message || 'שגיאה בשליחת המשוב, אנא נסי שוב מאוחר יותר.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setComment('');
    setFeedbackType(isGeneral ? 'suggestion' : 'halachic_note');
    setErrorMsg(null);
    setIsSuccess(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-amber-200/80 max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden text-right font-['Assistant',sans-serif]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-800 via-amber-900 to-amber-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-amber-300 shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg font-['Heebo']">
                {isGeneral
                  ? 'הצעת שיפור ומשוב לאולפה-קוויז'
                  : isHalacha
                  ? 'משוב או הערה על ההלכה היומית'
                  : 'משוב או השגה על שאלת חידון'}
              </h3>
              <p className="text-amber-200/90 text-xs">
                {student.fullName} • כיתה {student.className}
              </p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {isSuccess ? (
            <div className="text-center py-6 sm:py-8 space-y-4 animate-in zoom-in-95">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-9 h-9 sm:w-10 sm:h-10" />
              </div>
              <div className="space-y-2">
                <h4 className="text-xl font-black text-slate-900 font-['Heebo']">
                  {isGeneral
                    ? 'תודה רבה על הרעיון וההצעה! ✨'
                    : 'תודה רבה! המשוב התקבל בהצלחה ✨'}
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                  {isGeneral
                    ? 'הצעתך הועברה להנהלת האולפנה ולצוות המוביל. אנו מעריכים מאוד את השותפות והרצון שלך לשפר את האפליקציה!'
                    : 'הערתך הועברה ישירות לבדיקת רב וצוות ההוראה של האולפנא. אנו מעריכים מאוד את הקריאה הביקורתית והעיון המעמיק שלך בהלכה!'}
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleReset}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm px-6 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
                >
                  סגרי חלון
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Question / Context Reference Box */}
              {isGeneral ? (
                <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 text-xs text-slate-800 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-900 font-bold">
                    <span className="text-base">💡</span>
                    <span>יש לך רעיון איך לשפר את המבצע?</span>
                  </div>
                  <p className="text-amber-950/80 text-[11px] leading-relaxed">
                    רעיון לפרסים, הצעות לשיפור שאלות החידון, עיצוב האפליקציה או כל מחשבה שתעזור לכולן ללמוד בהנאה – נשמח מאוד לשמוע!
                  </p>
                </div>
              ) : isHalacha ? (
                <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3.5 space-y-1.5 text-xs text-slate-800">
                  <div className="flex items-center justify-between text-amber-900 font-bold border-b border-amber-200/70 pb-1.5">
                    <span className="flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      <span>משוב על ההלכה לתאריך: {questionContext.date}</span>
                    </span>
                  </div>
                  <p className="font-semibold text-slate-900 pt-1 leading-relaxed">
                    {questionContext.halachaTitle}
                  </p>
                </div>
              ) : (
                <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3.5 space-y-1.5 text-xs text-slate-800">
                  <div className="flex items-center justify-between text-amber-900 font-bold border-b border-amber-200/70 pb-1.5">
                    <span className="flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      <span>שאלת חידון לתאריך: {questionContext.date}</span>
                    </span>
                    {questionContext.halachaTitle && (
                      <span className="text-[11px] font-medium text-amber-800 truncate max-w-[180px]">
                        {questionContext.halachaTitle}
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-slate-900 pt-1 leading-relaxed">
                    "{questionContext.questionText}"
                  </p>
                </div>
              )}

              {/* Feedback Type Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  סוג הפנייה <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {feedbackOptions.map((t) => {
                    const isSelected = feedbackType === t.id;
                    return (
                      <button
                        type="button"
                        key={t.id}
                        onClick={() => setFeedbackType(t.id)}
                        className={`p-2.5 rounded-xl border text-right text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-amber-100 text-amber-950 border-amber-400 ring-1 ring-amber-300'
                            : 'bg-slate-50/80 text-slate-700 border-slate-200 hover:bg-amber-50/50'
                        }`}
                      >
                        <span className="text-base">{t.icon}</span>
                        <span className="flex-1">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Comment Textarea */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isGeneral
                    ? 'פירוט ההצעה או הרעיון'
                    : 'פירוט ההערה או ההשגה'}{' '}
                  <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={
                    isGeneral
                      ? 'פרטי כאן את הצעת השיפור או הרעיון שלך לאפליקציה ולחידון...'
                      : isHalacha
                      ? 'פרטי כאן את ההערה או ההארה שלך לגבי ההלכה...'
                      : 'פרטי כאן את מה שברצונך להעיר (למשל: מקור הלכתי אחר, אי-בהירות בניסוח אחת האפשרויות, טעות הקלדה...)'
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-hidden bg-slate-50/50 leading-relaxed"
                />
              </div>

              {/* Error Message */}
              {errorMsg && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold text-white bg-gradient-to-r from-amber-700 to-amber-900 hover:from-amber-800 hover:to-amber-950 disabled:opacity-50 transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <Send className="w-4 h-4 shrink-0" />
                  <span>
                    {isSubmitting
                      ? 'שולח...'
                      : isGeneral
                      ? 'שלחי הצעה לצוות'
                      : 'שלחי משוב לצוות'}
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
