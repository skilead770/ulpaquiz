import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Sparkles,
  BookOpen,
  Send,
  CheckCircle2,
  AlertCircle,
  Award,
  Calendar,
  ChevronDown,
  ChevronUp,
  Check,
  ArrowRight,
  ArrowLeft,
  HelpCircle,
  Clock,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Student, QuestionSuggestion, DailyHalacha, inferGradeFromClass } from '../types';
import { submitMultipleQuestionSuggestionsApi, fetchUpcomingHalachotApi } from '../lib/api';
import { getTodayInJerusalem, formatShortHebrewDateLabel, getHebrewDayAndDateLabel } from '../lib/quizSchedule';
import { auth } from '../lib/firebaseClient';

interface SuggestQuestionModalProps {
  student: Student;
  isOpen?: boolean;
  onClose: () => void;
  onSubmitted?: (suggestions: QuestionSuggestion[]) => void;
  halachot?: DailyHalacha[];
  todayDate?: string;
}

interface DraftQuestion {
  questionText: string;
  options: [string, string, string, string];
  correctOptionIndex: number;
  explanation: string;
}

const createEmptyQuestion = (): DraftQuestion => ({
  questionText: '',
  options: ['', '', '', ''],
  correctOptionIndex: 0,
  explanation: '',
});

function formatDropdownDateOption(dateStr: string): string {
  return getHebrewDayAndDateLabel(dateStr);
}

export const SuggestQuestionModal: React.FC<SuggestQuestionModalProps> = ({
  student,
  isOpen = true,
  onClose,
  onSubmitted,
  halachot = [],
  todayDate,
}) => {
  const effectiveToday = todayDate || getTodayInJerusalem();

  // Halachot state
  const [upcomingHalachot, setUpcomingHalachot] = useState<DailyHalacha[]>([]);
  const [isLoadingHalachot, setIsLoadingHalachot] = useState<boolean>(true);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [showHalachaContent, setShowHalachaContent] = useState<boolean>(true);

  // 4 Questions drafting state
  const [questions, setQuestions] = useState<[DraftQuestion, DraftQuestion, DraftQuestion, DraftQuestion]>([
    createEmptyQuestion(),
    createEmptyQuestion(),
    createEmptyQuestion(),
    createEmptyQuestion(),
  ]);
  const [activeTab, setActiveTab] = useState<number>(0); // 0, 1, 2, 3

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedCount, setSubmittedCount] = useState(0);
  const [isSuccess, setIsSuccess] = useState(false);

  // Fetch or filter upcoming halachot (next 7 days only)
  useEffect(() => {
    let isMounted = true;
    setIsLoadingHalachot(true);

    fetchUpcomingHalachotApi(effectiveToday, 7)
      .then((loaded) => {
        if (!isMounted) return;
        // Merge with any passed in props, taking only upcoming dates (date >= effectiveToday)
        const combinedMap = new Map<string, DailyHalacha>();
        loaded.forEach((h) => {
          if (h.date >= effectiveToday) {
            combinedMap.set(h.date, h);
          }
        });
        halachot.forEach((h) => {
          if (h.date >= effectiveToday && !combinedMap.has(h.date)) {
            combinedMap.set(h.date, h);
          }
        });

        let list = Array.from(combinedMap.values()).sort((a, b) => a.date.localeCompare(b.date));
        if (list.length > 7) {
          list = list.slice(0, 7);
        }

        // Fallback if no future dates exist
        if (list.length === 0) {
          const fallback = [...loaded, ...halachot].sort((a, b) => a.date.localeCompare(b.date));
          list = fallback.slice(0, 7);
        }

        setUpcomingHalachot(list);

        if (list.length > 0) {
          setSelectedDate((prev) => {
            if (prev && list.some((h) => h.date === prev)) {
              return prev;
            }
            const defaultSelect = list.find((h) => h.date >= effectiveToday) || list[0];
            return defaultSelect.date;
          });
        }
      })
      .catch((err) => {
        console.error('Failed to load upcoming halachot for suggestion modal:', err);
        if (!isMounted) return;
        // Fallback to passed halachot (upcoming only, max 7)
        const upcomingFromProps = halachot
          .filter((h) => h.date >= effectiveToday)
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(0, 7);

        const fallback = upcomingFromProps.length > 0
          ? upcomingFromProps
          : [...halachot].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 7);

        setUpcomingHalachot(fallback);
        if (fallback.length > 0) {
          setSelectedDate(fallback[0].date);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingHalachot(false);
      });

    return () => {
      isMounted = false;
    };
  }, [effectiveToday, halachot]);

  const selectedHalacha = useMemo(() => {
    return upcomingHalachot.find((h) => h.date === selectedDate) || null;
  }, [upcomingHalachot, selectedDate]);

  if (!isOpen) return null;

  // Question helpers
  const handleOptionChange = (qIdx: number, optIdx: number, val: string) => {
    setQuestions((prev) => {
      const copy = [...prev] as [DraftQuestion, DraftQuestion, DraftQuestion, DraftQuestion];
      const q = { ...copy[qIdx] };
      const opts = [...q.options] as [string, string, string, string];
      opts[optIdx] = val;
      q.options = opts;
      copy[qIdx] = q;
      return copy;
    });
  };

  const handleQuestionTextChange = (qIdx: number, val: string) => {
    setQuestions((prev) => {
      const copy = [...prev] as [DraftQuestion, DraftQuestion, DraftQuestion, DraftQuestion];
      copy[qIdx] = { ...copy[qIdx], questionText: val };
      return copy;
    });
  };

  const handleCorrectOptionChange = (qIdx: number, optIdx: number) => {
    setQuestions((prev) => {
      const copy = [...prev] as [DraftQuestion, DraftQuestion, DraftQuestion, DraftQuestion];
      copy[qIdx] = { ...copy[qIdx], correctOptionIndex: optIdx };
      return copy;
    });
  };

  const handleExplanationChange = (qIdx: number, val: string) => {
    setQuestions((prev) => {
      const copy = [...prev] as [DraftQuestion, DraftQuestion, DraftQuestion, DraftQuestion];
      copy[qIdx] = { ...copy[qIdx], explanation: val };
      return copy;
    });
  };

  // Check which questions are completed
  const isQuestionComplete = (q: DraftQuestion) => {
    return (
      q.questionText.trim().length > 0 &&
      q.options.every((opt) => opt.trim().length > 0)
    );
  };

  const hasStartedQuestion = (q: DraftQuestion) => {
    return (
      q.questionText.trim().length > 0 ||
      q.options.some((opt) => opt.trim().length > 0) ||
      q.explanation.trim().length > 0
    );
  };

  const completedQuestionsCount = questions.filter(isQuestionComplete).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedHalacha) {
      setErrorMsg('אנא בחרי הלכה יומית מתוך הרשימה.');
      return;
    }

    // Check Question 1 (at least 1 question required)
    if (!isQuestionComplete(questions[0])) {
      setErrorMsg('אנא נסחי לפחות את שאלה 1 ומלאי את כל 4 אפשרויות התשובה שלה.');
      setActiveTab(0);
      return;
    }

    // For any subsequent question that was started, ensure it's fully complete
    for (let i = 1; i < questions.length; i++) {
      if (hasStartedQuestion(questions[i]) && !isQuestionComplete(questions[i])) {
        setErrorMsg(`בשאלה ${i + 1} הותחלה כתיבה אך לא מולאו כל 4 אפשרויות התשובה. אנא השלימי או מחקי אותה.`);
        setActiveTab(i);
        return;
      }
    }

    // Gather all completed questions
    const validQuestions = questions.filter(isQuestionComplete);
    if (validQuestions.length === 0) {
      setErrorMsg('אנא נסחי לפחות שאלה אחת מלאה עם 4 אפשרויות.');
      return;
    }

    setIsSubmitting(true);
    try {
      const currentUserEmail = auth.currentUser?.email?.toLowerCase().trim();
      const studentEmail = (currentUserEmail || student.email || '').toLowerCase().trim() || undefined;
      const cleanTopic = ((selectedHalacha.topic || selectedHalacha.title || 'הלכה יומית').slice(0, 140)).trim();
      const cleanGrade = student.grade || inferGradeFromClass(student.className);

      const suggestionsToCreate = validQuestions.map((q) => ({
        studentId: student.id,
        studentName: student.fullName,
        studentEmail,
        className: student.className,
        grade: cleanGrade,
        topic: cleanTopic,
        source: selectedHalacha.source ? selectedHalacha.source.slice(0, 190) : undefined,
        targetDate: selectedHalacha.date,
        questionText: q.questionText.trim(),
        options: q.options.map((opt) => opt.trim()) as [string, string, string, string],
        correctOptionIndex: q.correctOptionIndex,
        explanation: q.explanation.trim() ? q.explanation.trim().slice(0, 500) : undefined,
      }));

      const created = await submitMultipleQuestionSuggestionsApi(suggestionsToCreate);

      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6'],
      });

      setSubmittedCount(created.length);
      setIsSuccess(true);
      if (onSubmitted) {
        onSubmitted(created);
      }
    } catch (err: any) {
      console.error('Failed to submit question suggestions:', err);
      setErrorMsg(err?.message || 'שגיאה בשליחת השאלות, אנא נסי שוב מאוחר יותר.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setQuestions([
      createEmptyQuestion(),
      createEmptyQuestion(),
      createEmptyQuestion(),
      createEmptyQuestion(),
    ]);
    setActiveTab(0);
    setErrorMsg(null);
    setIsSuccess(false);
    setSubmittedCount(0);
    onClose();
  };

  const currentQ = questions[activeTab];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-amber-200/80 max-w-2xl w-full max-h-[94vh] flex flex-col overflow-hidden text-right font-['Assistant',sans-serif]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-700 via-amber-800 to-amber-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/30 border border-amber-300/40 flex items-center justify-center text-amber-200 shrink-0">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg font-['Heebo']">
                חיבור שאלות לחידון היומי
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

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {isSuccess ? (
            <div className="text-center py-6 sm:py-8 space-y-4 animate-in zoom-in-95">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-9 h-9 sm:w-10 sm:h-10" />
              </div>
              <div className="space-y-2">
                <h4 className="text-xl font-black text-amber-950 font-['Heebo']">
                  יישר כוח עצום! {submittedCount === 1 ? 'שאלת החידון נשלחה' : `${submittedCount} שאלות נשלחו`} בהצלחה! ✨
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                  השאלות עבור הלכת {selectedHalacha ? `${selectedHalacha.title} (${selectedHalacha.date})` : 'החידון היומי'} הועברו לבדיקת רב וצוות האולפנא.
                  ברגע שיאושרו, תקבלי נקודות בונוס והשאלות ישובצו בחידון היומי עם קרדיט לשמך ולכיתתך!
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-900 font-semibold flex items-center justify-center gap-2">
                <Award className="w-5 h-5 text-amber-600 shrink-0" />
                <span>בונוס נקודות יתווסף אוטומטית למאזן שלך עם אישור השאלות על ידי הצוות!</span>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleReset}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm px-6 py-2.5 rounded-xl shadow-md transition-all cursor-pointer"
                >
                  חזרה למסך הראשי
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Encouragement Banner */}
              <div className="bg-gradient-to-r from-amber-50 via-amber-100/60 to-amber-50 border border-amber-200/90 rounded-2xl p-3 sm:p-3.5 flex items-start gap-3">
                <Award className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-xs text-amber-950 font-medium leading-relaxed">
                  <p>
                    <strong>בואי לקחת חלק פעיל בלימוד ההלכה!</strong> בחרי את ההלכה היומית של הימים הקרובים, קראי את תוכנה וחברי שאלות חידון (עד 4 שאלות, 4 אפשרויות לכל שאלה).
                  </p>
                  <p className="text-[11px] text-amber-800">
                    שאלות שיאושרו יזכו אותך בנקודות בונוס וישובצו בחידון הכלל-אולפני עם שמך!
                  </p>
                </div>
              </div>

              {/* Step 1: Select Upcoming Halacha from DB */}
              <div className="bg-slate-50/80 border border-amber-200/70 rounded-2xl p-3.5 sm:p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-amber-600" />
                    <span>בחרי הלכה יומית מהמאגר (ימים קרובים):</span>
                  </label>
                  {isLoadingHalachot && (
                    <span className="text-[11px] text-slate-500 font-medium">טוען הלכות...</span>
                  )}
                </div>

                {upcomingHalachot.length === 0 && !isLoadingHalachot ? (
                  <p className="text-xs text-slate-500">לא נמצאו הלכות יומיות במאגר. אנא פני למנהלת המערכת.</p>
                ) : (
                  <div className="space-y-2">
                    <select
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full max-w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-bold text-slate-800 bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-hidden shadow-2xs truncate cursor-pointer"
                    >
                      {upcomingHalachot.map((h) => (
                        <option key={h.date} value={h.date}>
                          {formatDropdownDateOption(h.date)}
                        </option>
                      ))}
                    </select>

                    {selectedHalacha && (
                      <div className="pt-1 space-y-2">
                        {/* Topic & Source Badges */}
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="bg-amber-100 text-amber-900 font-bold px-2.5 py-1 rounded-lg border border-amber-200">
                            נושא: {selectedHalacha.topic || selectedHalacha.title}
                          </span>
                          {selectedHalacha.source && (
                            <span className="bg-slate-200/80 text-slate-700 font-semibold px-2.5 py-1 rounded-lg">
                              מקור: {selectedHalacha.source}
                            </span>
                          )}
                          <span className="bg-emerald-100 text-emerald-900 font-bold px-2.5 py-1 rounded-lg border border-emerald-200">
                            תאריך: {getHebrewDayAndDateLabel(selectedHalacha.date)}
                          </span>
                        </div>

                        {/* Collapsible Halacha Study Content */}
                        {selectedHalacha.content && (
                          <div className="border border-amber-200/80 rounded-xl overflow-hidden bg-white shadow-2xs">
                            <button
                              type="button"
                              onClick={() => setShowHalachaContent(!showHalachaContent)}
                              className="w-full px-3 py-2 bg-amber-50/70 hover:bg-amber-100/50 flex items-center justify-between text-xs font-bold text-amber-950 transition-colors cursor-pointer"
                            >
                              <span className="flex items-center gap-1.5">
                                <BookOpen className="w-3.5 h-3.5 text-amber-700" />
                                <span>תוכן ההלכה ללימוד ולחיבור השאלות</span>
                              </span>
                              <span className="text-[11px] text-amber-800 flex items-center gap-1">
                                {showHalachaContent ? (
                                  <><span>הסתר תוכן</span><ChevronUp className="w-3.5 h-3.5" /></>
                                ) : (
                                  <><span>קראי את תוכן ההלכה</span><ChevronDown className="w-3.5 h-3.5" /></>
                                )}
                              </span>
                            </button>

                            {showHalachaContent && (
                              <div className="p-3 max-h-40 overflow-y-auto text-xs leading-relaxed text-slate-800 whitespace-pre-line border-t border-amber-100 bg-amber-50/20 font-medium">
                                {selectedHalacha.content}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Step 2: Formulate Quiz Questions (Tabs: שאלה 1, שאלה 2, שאלה 3, שאלה 4) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-amber-600" />
                    <span>שאלות החידון (4 שאלות, 4 אפשרויות לכל שאלה):</span>
                  </label>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    {completedQuestionsCount} מתוך 4 שאלות מוכנות
                  </span>
                </div>

                {/* 4 Question Tabs */}
                <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                  {[0, 1, 2, 3].map((idx) => {
                    const q = questions[idx];
                    const isComplete = isQuestionComplete(q);
                    const isActive = activeTab === idx;
                    const isRequired = idx === 0;

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveTab(idx)}
                        className={`p-2 rounded-xl text-xs font-bold transition-all border flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                          isActive
                            ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                            : isComplete
                              ? 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          <span>שאלה {idx + 1}</span>
                          {isComplete && (
                            <Check className={`w-3 h-3 ${isActive ? 'text-white' : 'text-emerald-600'}`} />
                          )}
                        </div>
                        <span className={`text-[10px] ${isActive ? 'text-amber-100' : isComplete ? 'text-emerald-700' : 'text-slate-400'}`}>
                          {isRequired ? '(חובה)' : isComplete ? 'מוכנה ✓' : '(אופציונלי)'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Active Question Editor Card */}
                <div className="bg-white border-2 border-amber-200/90 rounded-2xl p-3.5 sm:p-4 space-y-3.5 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-amber-100 pb-2">
                    <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                      <span>עריכת שאלה {activeTab + 1}</span>
                      {activeTab === 0 && <span className="text-rose-500 font-bold">*</span>}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      סמני את התשובה הנכונה מבין 4 האפשרויות
                    </span>
                  </div>

                  {/* Question Text */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      נוסח שאלה {activeTab + 1} {activeTab === 0 && <span className="text-rose-500">*</span>}
                    </label>
                    <textarea
                      rows={2}
                      value={currentQ.questionText}
                      onChange={(e) => handleQuestionTextChange(activeTab, e.target.value)}
                      placeholder={`כתבי כאן את שאלה ${activeTab + 1} מתוך תוכן ההלכה...`}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-hidden bg-slate-50/50 leading-relaxed"
                    />
                  </div>

                  {/* 4 Options */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-700">
                        4 אפשרויות תשובה {activeTab === 0 && <span className="text-rose-500">*</span>}
                      </label>
                      <span className="text-[11px] text-amber-800 font-semibold">
                        (לחצי על האפשרות הנכונה כדי לסמנה)
                      </span>
                    </div>

                    <div className="space-y-2">
                      {currentQ.options.map((opt, optIdx) => {
                        const isCorrect = currentQ.correctOptionIndex === optIdx;
                        const letter = ['א', 'ב', 'ג', 'ד'][optIdx];

                        return (
                          <div
                            key={optIdx}
                            onClick={() => handleCorrectOptionChange(activeTab, optIdx)}
                            className={`flex items-center gap-2.5 p-2 rounded-xl border transition-all cursor-pointer ${
                              isCorrect
                                ? 'bg-emerald-50/90 border-emerald-400 ring-1 ring-emerald-300'
                                : 'bg-slate-50/70 border-slate-200 hover:bg-amber-50/40'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`correctOption_${activeTab}`}
                              checked={isCorrect}
                              onChange={() => handleCorrectOptionChange(activeTab, optIdx)}
                              className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                            <span
                              className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                                isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {letter}
                            </span>
                            <input
                              type="text"
                              value={opt}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => handleOptionChange(activeTab, optIdx, e.target.value)}
                              placeholder={`אפשרות ${letter}...`}
                              className="flex-1 bg-transparent border-0 outline-hidden text-xs sm:text-sm text-slate-800 placeholder-slate-400"
                            />
                            {isCorrect && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md shrink-0">
                                תשובה נכונה ✓
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Explanation */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      הסבר / נימוק לתשובה הנכונה (אופציונלי - יופיע לתלמידות בפתרון החידון)
                    </label>
                    <input
                      type="text"
                      value={currentQ.explanation}
                      onChange={(e) => handleExplanationChange(activeTab, e.target.value)}
                      placeholder="לדוגמה: משום שלפי פסק ההלכה שיעור זה נקבע על פי..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-hidden bg-slate-50/50"
                    />
                  </div>

                  {/* Tab Navigation buttons */}
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <button
                      type="button"
                      disabled={activeTab === 0}
                      onClick={() => setActiveTab((prev) => Math.max(0, prev - 1))}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span>שאלה קודמת</span>
                    </button>

                    <button
                      type="button"
                      disabled={activeTab === 3}
                      onClick={() => setActiveTab((prev) => Math.min(3, prev + 1))}
                      className="px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 font-bold cursor-pointer"
                    >
                      <span>שאלה הבאה</span>
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {errorMsg && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Submit Footer */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-100">
                <div className="text-xs text-slate-600 font-semibold">
                  <span>שאלות מוכנות: </span>
                  <strong className="text-amber-700">{completedQuestionsCount} מתוך 4</strong>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    ביטול
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || completedQuestionsCount === 0}
                    className="px-5 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold text-white bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 disabled:opacity-50 transition-all shadow-md flex items-center gap-2 cursor-pointer"
                  >
                    <Send className="w-4 h-4 shrink-0" />
                    <span>
                      {isSubmitting
                        ? 'שולח שאלות...'
                        : completedQuestionsCount > 1
                        ? `שלחי ${completedQuestionsCount} שאלות לחידון ✨`
                        : 'שלחי שאלה אחת לחידון ✨'}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
