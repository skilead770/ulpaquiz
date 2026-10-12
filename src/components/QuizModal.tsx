import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Trophy,
  ArrowRight,
  ArrowLeft,
  Crown,
  Award,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { DailyHalacha, Student, PrizeMilestone } from '../types';
import { DEFAULT_PRIZE_MILESTONES } from '../data/seedData';
import { submitQuizApi } from '../lib/api';

interface QuizModalProps {
  student: Student;
  halacha: DailyHalacha;
  prizeMilestones?: PrizeMilestone[];
  onClose: () => void;
  onQuizSubmitted: (
    updatedStudent: Student,
    milestones: PrizeMilestone[]
  ) => void;
}

export const QuizModal: React.FC<QuizModalProps> = ({
  student,
  halacha,
  prizeMilestones = [],
  onClose,
  onQuizSubmitted,
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [confirmedStudy, setConfirmedStudy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Results View State
  const [quizResult, setQuizResult] = useState<{
    score: number;
    earnedPoints: number;
    previousPoints: number;
    newPoints: number;
    isPerfect: boolean;
    message: string;
    confirmedStudy: boolean;
    milestonesReached: PrizeMilestone[];
  } | null>(null);

  const questions = halacha.questions;
  const [shuffledOptionsByQuestion] = useState(() =>
    questions.map((question) => {
      const options = question.options.map((text, originalIndex) => ({ text, originalIndex }));
      for (let index = options.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [options[index], options[swapIndex]] = [options[swapIndex], options[index]];
      }
      return options;
    })
  );
  const currentQuestion = questions[currentQuestionIndex];
  const currentOptions = shuffledOptionsByQuestion[currentQuestionIndex];
  const allAnswered = questions.every((q) => selectedAnswers[q.id] !== undefined);

  // Compute next milestone and progress based on manager's configured prizeMilestones
  const activeMilestones = prizeMilestones.length > 0 ? prizeMilestones : DEFAULT_PRIZE_MILESTONES;
  const currentTotalPoints = quizResult ? quizResult.newPoints : student.points;
  const nextMilestone =
    activeMilestones.find((m) => m.points > currentTotalPoints) ||
    activeMilestones[activeMilestones.length - 1];
  const pointsToNext = Math.max(0, nextMilestone.points - currentTotalPoints);
  const prevMilestonePoints =
    activeMilestones.filter((m) => m.points <= currentTotalPoints).pop()?.points || 0;
  const milestoneRange = Math.max(1, nextMilestone.points - prevMilestonePoints);
  const progressPercent = Math.min(
    100,
    Math.round(((currentTotalPoints - prevMilestonePoints) / milestoneRange) * 100)
  );

  const handleSelectOption = (questionId: string, optionIndex: number) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionIndex,
    }));
  };

  const handleSubmit = async () => {
    if (!allAnswered) {
      setErrorMsg('אנא עני על כל 4 השאלות לפני הגשת החידון!');
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const res = await submitQuizApi(student.id, halacha.date, selectedAnswers, confirmedStudy);

      // Trigger festive celebratory confetti
      const hasMilestone = res.milestonesReached && res.milestonesReached.length > 0;
      if (res.isPerfect || hasMilestone || res.earnedPoints > 0) {
        confetti({
          particleCount: res.isPerfect || hasMilestone ? 120 : 80,
          spread: 75,
          origin: { y: 0.6 },
          colors: ['#f59e0b', '#d97706', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6'],
        });
      }

      setQuizResult({
        score: res.score,
        earnedPoints: res.earnedPoints,
        previousPoints: res.previousPoints,
        newPoints: res.newPoints,
        isPerfect: res.isPerfect,
        message: res.message,
        confirmedStudy,
        milestonesReached: res.milestonesReached || [],
      });

      // Notify parent to refresh student state
      onQuizSubmitted(res.student, res.milestonesReached || []);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e?.message || 'אירעה שגיאה בעת הגשת החידון');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-amber-200 overflow-hidden relative my-auto max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-700 via-amber-600 to-yellow-500 text-white p-4 sm:p-6 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-amber-100 font-bold shrink-0">
              <HelpCircle className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0 truncate">
              <h3 className="text-base sm:text-xl font-extrabold font-['Heebo'] truncate">
                החידון היומי - {halacha.topic}
              </h3>
              <p className="text-[11px] sm:text-xs text-amber-100 font-medium truncate">
                אהלי הלכה • הגר"י אריאל • {halacha.date} • 4 שאלות
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/15 hover:bg-black/25 flex items-center justify-center text-white transition-colors shrink-0 cursor-pointer"
            aria-label="סגור חידון"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Content Body */}
        {!quizResult ? (
          <div className="p-4 sm:p-8 space-y-4 sm:space-y-6 overflow-y-auto flex-1">
            {/* "למדתי בשמחה" Confirmation Banner */}
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/90 rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 transition-colors ${
                    confirmedStudy
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {confirmedStudy ? '✓' : '📖'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-emerald-950 truncate">
                    לימוד ההלכה היומית
                  </p>
                  <p className="text-[11px] sm:text-xs text-emerald-800/90 font-medium truncate">
                    {confirmedStudy
                      ? 'אישרת שלמדת בשמחה (+5 נקודות!)'
                      : 'קראת את ההלכה? לחצי לקבלת 5 נקודות'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setConfirmedStudy((prev) => !prev)}
                className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 shadow-xs ${
                  confirmedStudy
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-100 active:scale-95'
                }`}
              >
                {confirmedStudy ? '✓ מוכנה לחידון!' : 'קראתי ולמדתי / מוכנה לחידון ✨'}
              </button>
            </div>

            {/* Question Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                <span>שאלה {currentQuestionIndex + 1} מתוך 4</span>
                <span>
                  {Math.round(((currentQuestionIndex + 1) / 4) * 100)}% הושלמו
                </span>
              </div>
              <div className="flex items-start gap-2">
                {questions.map((q, idx) => {
                  const isAnswered = selectedAnswers[q.id] !== undefined;
                  const isCurrent = idx === currentQuestionIndex;

                  return (
                    <div key={q.id} className="flex-1 min-w-0 text-center">
                      <span className={`block mb-1 text-[9px] sm:text-[10px] font-bold whitespace-nowrap ${isCurrent ? 'text-amber-900' : 'text-slate-500'}`}>
                        {idx + 1} · 5 נק׳
                      </span>
                      <button
                        type="button"
                        onClick={() => setCurrentQuestionIndex(idx)}
                        className={`block w-full h-2.5 rounded-full transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-amber-600 ring-2 ring-amber-300'
                            : isAnswered
                            ? 'bg-amber-400'
                            : 'bg-amber-100'
                        }`}
                        aria-label={`עבור לשאלה ${idx + 1}, שווה 5 נקודות`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Current Question Block */}
            <div className="bg-amber-50/50 p-4 sm:p-5 rounded-2xl border border-amber-200/80 space-y-3.5">
              <h4 className="text-sm sm:text-lg font-bold text-amber-950 font-['Heebo'] leading-relaxed">
                {currentQuestionIndex + 1}. {currentQuestion.text}
              </h4>

              {/* Options */}
              <div className="space-y-2">
                {currentOptions.map(({ text, originalIndex }, displayIndex) => {
                  const isSelected = selectedAnswers[currentQuestion.id] === originalIndex;

                  return (
                    <button
                      key={originalIndex}
                      onClick={() =>
                        handleSelectOption(currentQuestion.id, originalIndex)
                      }
                      className={`w-full text-right p-3 sm:p-4 rounded-xl border font-semibold text-xs sm:text-sm transition-all flex items-center justify-between gap-2.5 cursor-pointer ${
                        isSelected
                          ? 'bg-amber-600 text-white border-amber-600 shadow-md scale-[1.005]'
                          : 'bg-white text-slate-800 border-amber-200 hover:bg-amber-100/60 hover:border-amber-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                        <span
                          className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                            isSelected
                              ? 'bg-white text-amber-700'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {['א', 'ב', 'ג', 'ד'][displayIndex]}
                        </span>
                        <span className="leading-snug break-words flex-1 text-right">{text}</span>
                      </div>
                      {isSelected && <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-white shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Error banner */}
            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Bottom Nav Controls */}
            <div className="flex items-center justify-between pt-2 gap-2">
              <button
                onClick={() =>
                  setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))
                }
                disabled={currentQuestionIndex === 0}
                className="px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 disabled:opacity-40 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowRight className="w-4 h-4 shrink-0" />
                <span>הקודמת</span>
              </button>

              {currentQuestionIndex < 3 ? (
                <button
                  onClick={() =>
                    setCurrentQuestionIndex((prev) => Math.min(3, prev + 1))
                  }
                  className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <span>הבאה</span>
                  <ArrowLeft className="w-4 h-4 shrink-0" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !allAnswered}
                  className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-extrabold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 transition-all shadow-md flex items-center gap-1.5 sm:gap-2 cursor-pointer"
                >
                  <Trophy className="w-4 h-4 shrink-0" />
                  <span>{isSubmitting ? 'מגיש...' : 'הגש חידון'}</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Quiz Results View (Immediate Feedback) */
          <div className="p-4 sm:p-7 space-y-4 sm:space-y-5 text-center animate-in zoom-in-95 overflow-y-auto">
            {/* Top Celebration Icon */}
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-400 text-white shadow-lg shadow-amber-500/30 mx-auto">
              {quizResult.milestonesReached.length > 0 ? (
                <Trophy className="w-8 h-8 sm:w-10 sm:h-10 animate-bounce" />
              ) : quizResult.isPerfect ? (
                <Crown className="w-8 h-8 sm:w-10 sm:h-10 animate-bounce" />
              ) : (
                <Sparkles className="w-8 h-8 sm:w-10 sm:h-10" />
              )}
            </div>

            {/* Badge & Title */}
            <div className="space-y-1.5">
              <span className="inline-block bg-amber-100 text-amber-900 text-xs font-bold px-3 py-1 rounded-full">
                {quizResult.milestonesReached.length > 0
                  ? '🏆 הגעת ליעד פרס חדש!'
                  : quizResult.isPerfect
                  ? '🌟 מצטיינת יומית (4/4)'
                  : '👏 השתתפות מבורכת'}
              </span>
              <h3 className="text-xl sm:text-2xl font-extrabold text-amber-950 font-['Heebo']">
                {quizResult.milestonesReached.length > 0
                  ? `כל הכבוד! הגעת ליעד ${quizResult.milestonesReached[0].title}!`
                  : quizResult.isPerfect
                  ? 'כל הכבוד! ענית נכון על כל השאלות!'
                  : 'סיימת בהצלחה את החידון היומי!'}
              </h3>
              <p className="text-amber-900 font-bold text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
                {quizResult.message}
              </p>
            </div>

            {/* Summary Score & Points Grid (3 columns: Quiz Score, Added Today, Total Accumulated Sum) */}
            <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-3 sm:p-4 grid grid-cols-3 gap-2 sm:gap-3 text-center">
              <div className="bg-white/80 rounded-xl p-2 sm:p-2.5 border border-amber-100 shadow-2xs">
                <p className="text-[11px] sm:text-xs text-amber-800 font-bold">ציון בחידון</p>
                <p className="text-lg sm:text-2xl font-black text-amber-950 font-['Heebo']">
                  {quizResult.score} / 4
                </p>
              </div>
              <div className="bg-white/80 rounded-xl p-2 sm:p-2.5 border border-amber-100 shadow-2xs">
                <p className="text-[11px] sm:text-xs text-amber-800 font-bold">נוספו היום</p>
                <p className="text-lg sm:text-2xl font-black text-emerald-600 font-['Heebo']">
                  +{quizResult.earnedPoints} <span className="text-xs font-bold text-emerald-700">נק'</span>
                </p>
              </div>
              <div className="bg-amber-100/90 rounded-xl p-2 sm:p-2.5 border border-amber-300 shadow-2xs">
                <p className="text-[11px] sm:text-xs text-amber-900 font-extrabold">סך כל נקודותייך</p>
                <p className="text-lg sm:text-2xl font-black text-amber-950 font-['Heebo']">
                  {quizResult.newPoints} <span className="text-xs font-bold text-amber-900">נק'</span>
                </p>
              </div>
            </div>

            {/* Points Calculation Breakdown List */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 sm:p-3.5 text-right text-xs space-y-1.5 font-medium text-slate-700">
              <div className="flex justify-between items-center text-slate-800 font-extrabold border-b border-slate-200 pb-1.5 mb-1.5">
                <span>פירוט חישוב הנקודות:</span>
                <span>+{quizResult.earnedPoints} נק' לחידון זה</span>
              </div>
              <div className="flex justify-between items-center">
                <span>קריאת ולימוד ההלכה ("קראתי ולמדתי / מוכנה לחידון"):</span>
                <span className={quizResult.confirmedStudy ? 'text-emerald-700 font-bold' : 'text-slate-400'}>
                  {quizResult.confirmedStudy ? '+5 נק\'' : '0 נק\''}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>תשובות נכונות בחידון ({quizResult.score}/4):</span>
                <span className="text-emerald-700 font-bold">+{quizResult.score * 5} נק'</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-200 text-slate-900 font-bold">
                <span>מאזן נקודות קודם:</span>
                <span>{quizResult.previousPoints} נק'</span>
              </div>
              <div className="flex justify-between items-center text-amber-950 font-black">
                <span>סך נקודות מצטבר חדש:</span>
                <span className="text-amber-800 text-sm">{quizResult.newPoints} נק'</span>
              </div>
            </div>

            {/* Prize Announcement Aligned with Manager Inputs */}
            {quizResult.milestonesReached.length > 0 ? (
              <div className="bg-gradient-to-r from-amber-100 via-yellow-50 to-amber-100 border-2 border-amber-400 rounded-2xl p-3.5 sm:p-4 text-right space-y-2 shadow-xs animate-in zoom-in-95">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Trophy className="w-5 h-5 animate-bounce" />
                  </div>
                  <div>
                    <span className="bg-amber-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md">
                      הגעת ליעד פרס אישי!
                    </span>
                    <h4 className="text-sm sm:text-base font-extrabold text-amber-950 font-['Heebo']">
                      {quizResult.milestonesReached[0].title} ({quizResult.milestonesReached[0].points} נקודות)
                    </h4>
                  </div>
                </div>
                <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200 text-xs sm:text-sm font-bold text-amber-950">
                  🎁 הפרס שלך: {quizResult.milestonesReached[0].rewardDescription}
                </div>
                <p className="text-[11px] text-amber-800 font-semibold">
                  הפרס האישי מחכה לך בחדר המורות! כל הכבוד על ההתמדה והלימוד! ✨
                </p>
              </div>
            ) : nextMilestone ? (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50/70 border border-amber-200/90 rounded-2xl p-3.5 sm:p-4 text-right space-y-2 shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-600 shrink-0" />
                    <span className="text-xs sm:text-sm font-bold text-amber-950">
                      יעד הפרס הבא: {nextMilestone.title} ({nextMilestone.points} נק')
                    </span>
                  </div>
                  <span className="text-[11px] sm:text-xs font-black text-amber-900 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-lg shrink-0">
                    {pointsToNext > 0 ? `חסרות עוד ${pointsToNext} נק'` : 'היעד הושלם!'}
                  </span>
                </div>
                <p className="text-xs text-amber-900 font-medium">
                  🎁 הפרס שמחכה לך: {nextMilestone.rewardDescription}
                </p>
                <div className="w-full bg-amber-200/60 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-yellow-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            ) : null}

            <p className="text-xs text-amber-800/90 font-semibold">
              ✨ הענקת כעת +{quizResult.earnedPoints} נקודות לך, לכיתה שלך ולשכבה שלך במאזן האולפני!
            </p>

            <button
              onClick={onClose}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-extrabold py-3.5 rounded-2xl shadow-md transition-all text-sm cursor-pointer"
            >
              סגרי וצפי בלוח המובילים
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
