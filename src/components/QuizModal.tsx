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
  Star,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { DailyHalacha, Student, PrizeMilestone } from '../types';
import { submitQuizApi } from '../lib/api';

interface QuizModalProps {
  student: Student;
  halacha: DailyHalacha;
  onClose: () => void;
  onQuizSubmitted: (
    updatedStudent: Student,
    milestones: PrizeMilestone[]
  ) => void;
}

export const QuizModal: React.FC<QuizModalProps> = ({
  student,
  halacha,
  onClose,
  onQuizSubmitted,
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Results View State
  const [quizResult, setQuizResult] = useState<{
    score: number;
    earnedPoints: number;
    isPerfect: boolean;
    message: string;
  } | null>(null);

  const questions = halacha.questions;
  const currentQuestion = questions[currentQuestionIndex];
  const allAnswered = questions.every((q) => selectedAnswers[q.id] !== undefined);

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
      const res = await submitQuizApi(student.id, halacha.date, selectedAnswers);

      if (res.isPerfect) {
        // Trigger festive confetti for 4/4 score!
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#f59e0b', '#d97706', '#10b981', '#3b82f6', '#ec4899'],
        });
      }

      setQuizResult({
        score: res.score,
        earnedPoints: res.earnedPoints,
        isPerfect: res.isPerfect,
        message: res.message,
      });

      // Notify parent to refresh student state & trigger potential milestone alerts
      onQuizSubmitted(res.student, res.milestonesReached || []);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e?.message || 'אירעה שגיאה בעת הגשת החידון');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-amber-200 overflow-hidden relative my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-700 via-amber-600 to-yellow-500 text-white p-5 sm:p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-amber-100 font-bold">
              <HelpCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-extrabold font-['Heebo']">
                החידון היומי - {halacha.topic}
              </h3>
              <p className="text-xs text-amber-100 font-medium">
                מתוך "אהלי הלכה" (הרב מאיר בראלי, בנשיאות הרב יעקב אריאל) • {halacha.date} • 4 שאלות
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        {!quizResult ? (
          <div className="p-6 sm:p-8 space-y-6">
            {/* Question Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                <span>שאלה {currentQuestionIndex + 1} מתוך 4</span>
                <span>
                  {Math.round(((currentQuestionIndex + 1) / 4) * 100)}% הושלמו
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {questions.map((q, idx) => {
                  const isAnswered = selectedAnswers[q.id] !== undefined;
                  const isCurrent = idx === currentQuestionIndex;

                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentQuestionIndex(idx)}
                      className={`h-2.5 flex-1 rounded-full transition-all ${
                        isCurrent
                          ? 'bg-amber-600 ring-2 ring-amber-300'
                          : isAnswered
                          ? 'bg-amber-400'
                          : 'bg-amber-100'
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Current Question Block */}
            <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-200/80 space-y-4">
              <h4 className="text-base sm:text-lg font-bold text-amber-950 font-['Heebo'] leading-snug">
                {currentQuestionIndex + 1}. {currentQuestion.text}
              </h4>

              {/* Options */}
              <div className="space-y-2.5">
                {currentQuestion.options.map((option, optIdx) => {
                  const isSelected =
                    selectedAnswers[currentQuestion.id] === optIdx;

                  return (
                    <button
                      key={optIdx}
                      onClick={() =>
                        handleSelectOption(currentQuestion.id, optIdx)
                      }
                      className={`w-full text-right p-4 rounded-xl border font-semibold text-sm transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-amber-600 text-white border-amber-600 shadow-md scale-[1.01]'
                          : 'bg-white text-slate-800 border-amber-200 hover:bg-amber-100/60 hover:border-amber-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                            isSelected
                              ? 'bg-white text-amber-700'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {['א', 'ב', 'ג', 'ד'][optIdx]}
                        </span>
                        <span>{option}</span>
                      </div>
                      {isSelected && <CheckCircle2 className="w-5 h-5 text-white" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Error banner */}
            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Bottom Nav Controls */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() =>
                  setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))
                }
                disabled={currentQuestionIndex === 0}
                className="px-4 py-2 rounded-xl text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 disabled:opacity-40 transition-all flex items-center gap-1.5"
              >
                <ArrowRight className="w-4 h-4" />
                <span>שאלה קודמת</span>
              </button>

              {currentQuestionIndex < 3 ? (
                <button
                  onClick={() =>
                    setCurrentQuestionIndex((prev) => Math.min(3, prev + 1))
                  }
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <span>שאלה הבאה</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !allAnswered}
                  className="px-6 py-3 rounded-xl text-sm font-extrabold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 transition-all shadow-md flex items-center gap-2"
                >
                  <Trophy className="w-4 h-4" />
                  <span>{isSubmitting ? 'מגיש...' : 'הגש חידון לקבלת ניקוד'}</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Quiz Results View (Immediate Feedback) */
          <div className="p-6 sm:p-8 space-y-6 text-center animate-in zoom-in-95">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-400 text-white shadow-lg shadow-amber-500/30">
              {quizResult.isPerfect ? (
                <Crown className="w-10 h-10 animate-bounce" />
              ) : (
                <Sparkles className="w-10 h-10" />
              )}
            </div>

            <div className="space-y-2">
              <span className="inline-block bg-amber-100 text-amber-900 text-xs font-bold px-3 py-1 rounded-full">
                {quizResult.isPerfect ? '🌟 מצטיינת יומית (4/4)' : '👏 השתתפות מבורכת'}
              </span>
              <h3 className="text-2xl font-extrabold text-amber-950 font-['Heebo']">
                {quizResult.isPerfect ? 'כל הכבוד! ענית נכון על כל השאלות!' : 'סיימת בהצלחה את החידון היומי!'}
              </h3>
              <p className="text-amber-900 font-bold text-base max-w-md mx-auto">
                {quizResult.message}
              </p>
            </div>

            {/* Score Breakout */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-xs text-amber-800 font-medium">ציון בחידון</p>
                <p className="text-2xl font-black text-amber-950 font-['Heebo']">
                  {quizResult.score} / 4
                </p>
              </div>
              <div>
                <p className="text-xs text-amber-800 font-medium">נקודות שהתווספו</p>
                <p className="text-2xl font-black text-emerald-600 font-['Heebo']">
                  +{quizResult.earnedPoints} נק'
                </p>
              </div>
            </div>

            <p className="text-xs text-amber-800/90 font-semibold">
              ✨ הענקת כעת +{quizResult.earnedPoints} נקודות לך, לכיתה שלך ולשכבה שלך במאזן האולפני!
            </p>

            <button
              onClick={onClose}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-extrabold py-3.5 rounded-2xl shadow-md transition-all text-sm"
            >
              סגרי וצפי בלוח המובילים
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
