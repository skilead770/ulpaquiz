import React, { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Sparkles,
  Calendar,
  Award,
  ChevronLeft,
  ChevronRight,
  Flame,
  ArrowLeft,
  GraduationCap,
  BookmarkCheck,
  HelpCircle,
} from 'lucide-react';
import { Student, DailyHalacha } from '../types';
import { DEFAULT_PRIZE_MILESTONES } from '../data/seedData';

interface DashboardProps {
  student: Student;
  halachot: DailyHalacha[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onStartQuiz: () => void;
  onViewLeaderboards: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  student,
  halachot,
  selectedDate,
  onSelectDate,
  onStartQuiz,
  onViewLeaderboards,
}) => {
  const [showSubmissionDetails, setShowSubmissionDetails] = useState(false);

  const currentHalacha =
    halachot.find((h) => h.date === selectedDate) || halachot[0];

  const isCompletedToday = student.completedDates.includes(selectedDate);
  const submission = student.submissions[selectedDate];

  // Find next milestone
  const nextMilestone =
    DEFAULT_PRIZE_MILESTONES.find((m) => m.points > student.points) ||
    DEFAULT_PRIZE_MILESTONES[DEFAULT_PRIZE_MILESTONES.length - 1];
  const pointsToNext = Math.max(0, nextMilestone.points - student.points);
  const prevMilestonePoints =
    DEFAULT_PRIZE_MILESTONES.filter((m) => m.points <= student.points).pop()
      ?.points || 0;
  const progressPercent = Math.min(
    100,
    Math.round(
      ((student.points - prevMilestonePoints) /
        (nextMilestone.points - prevMilestonePoints)) *
        100
    )
  );

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Top Welcome Banner & Personal Stats */}
      <div className="bg-gradient-to-l from-amber-700 via-amber-800 to-amber-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-amber-600/30">
        <div className="absolute -top-10 -left-10 w-48 h-48 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-yellow-500/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Greeting & Info */}
          <div className="md:col-span-7 space-y-3">
            <div className="inline-flex items-center gap-2 bg-amber-500/20 backdrop-blur-md px-3.5 py-1 rounded-full text-xs font-bold text-amber-200 border border-amber-400/30">
              <GraduationCap className="w-4 h-4 text-amber-300" />
              <span>תלמידת כיתה {student.className} • שכבת {student.grade}'</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-['Heebo']">
              שלום, <span className="text-amber-300">{student.fullName}</span>! 👋
            </h2>
            <p className="text-amber-100/90 text-sm leading-relaxed">
              כל יום של לימוד הלכה מקרב אותך, את כיתה {student.className} ואת שכבת {student.grade}' לזכייה במבצע!
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={onViewLeaderboards}
                className="inline-flex items-center gap-2 bg-white text-amber-950 font-extrabold text-xs px-4 py-2.5 rounded-2xl shadow-md hover:bg-amber-100 transition-all hover:scale-105 active:scale-95"
              >
                <span>צפי במיקום הכיתה והשכבה שלך</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Points & Milestone Card */}
          <div className="md:col-span-5 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 space-y-4 shadow-inner">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-200 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-yellow-300" />
                מאזן הנקודות האישי שלך
              </span>
              <span className="text-2xl font-black text-amber-300 font-['Heebo']">
                {student.points} <span className="text-xs font-semibold text-white">נקודות</span>
              </span>
            </div>

            {/* Progress to Next Milestone */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-amber-100 font-semibold">
                <span>יעד הפרס הבא: {nextMilestone.title}</span>
                <span>{pointsToNext > 0 ? `חסרות עוד ${pointsToNext} נק'` : 'הגעת ליעד!'}</span>
              </div>
              <div className="w-full bg-amber-950/50 rounded-full h-3 p-0.5 overflow-hidden border border-amber-400/30">
                <div
                  className="bg-gradient-to-r from-yellow-400 to-amber-300 h-full rounded-full transition-all duration-500 shadow-sm"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-[11px] text-amber-200/90 font-medium">
                🎁 פרס: {nextMilestone.rewardDescription}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Date Navigator Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-amber-200/80 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-amber-950 font-bold text-sm">
          <Calendar className="w-4 h-4 text-amber-600" />
          <span>בחירת תאריך הלכה:</span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto py-1">
          {halachot.map((h) => {
            const isSelected = h.date === selectedDate;
            const isDone = student.completedDates.includes(h.date);

            return (
              <button
                key={h.id}
                onClick={() => onSelectDate(h.date)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  isSelected
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
                }`}
              >
                <span>{h.date}</span>
                {isDone && (
                  <CheckCircle2
                    className={`w-3.5 h-3.5 ${
                      isSelected ? 'text-amber-200' : 'text-emerald-600'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Halacha Content Card */}
      {currentHalacha ? (
        <div className="bg-white rounded-3xl shadow-sm border border-amber-200/80 overflow-hidden">
          {/* Halacha Card Header */}
          <div className="bg-gradient-to-r from-amber-100 via-amber-50 to-orange-50 p-6 sm:p-8 border-b border-amber-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-amber-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-xs flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>{currentHalacha.topic}</span>
                </span>
                <span className="bg-amber-200/80 text-amber-950 text-xs font-extrabold px-3 py-1 rounded-full border border-amber-300">
                  📚 {currentHalacha.source || 'אהלי הלכה - הרב מאיר בראלי (בנשיאות הרב יעקב אריאל)'}
                </span>
                <span className="text-xs font-medium text-amber-800">
                  • תאריך: {currentHalacha.date}
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-amber-950 font-['Heebo']">
                {currentHalacha.title}
              </h3>
            </div>

            {isCompletedToday ? (
              <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-2 rounded-2xl flex items-center gap-2 text-xs font-bold shadow-xs">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <p>סיימת ללמוד ולענות להיום!</p>
                  <p className="text-[11px] text-emerald-700 font-semibold">
                    צברת {submission?.earnedPoints || 1} נקודות
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-amber-200/80 text-amber-950 px-3.5 py-1.5 rounded-2xl flex items-center gap-1.5 text-xs font-bold border border-amber-300/60">
                <Flame className="w-4 h-4 text-amber-700 animate-bounce" />
                <span>מוכנה לחידון? קראי ועני!</span>
              </div>
            )}
          </div>

          {/* Halacha Body Text */}
          <div className="p-6 sm:p-8 space-y-6">
            <div className="prose prose-amber max-w-none text-slate-800 text-base leading-relaxed whitespace-pre-line bg-amber-50/30 p-6 rounded-2xl border border-amber-100 font-sans">
              {currentHalacha.content}
            </div>

            {/* Bottom Action Area */}
            <div className="pt-4 border-t border-amber-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-amber-800 font-medium flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-amber-600" />
                <span>נלקח מתוך סדרת "אהלי הלכה" • 2 דקות קריאה • 4 שאלות בסוף</span>
              </div>

              {!isCompletedToday ? (
                <button
                  onClick={onStartQuiz}
                  className="w-full sm:w-auto bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 text-white font-extrabold text-base px-8 py-3.5 rounded-2xl shadow-lg shadow-amber-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 group"
                >
                  <BookmarkCheck className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <span>סיימתי ללמוד, מעבר לחידון היומי</span>
                  <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowSubmissionDetails(!showSubmissionDetails)}
                    className="bg-amber-100 text-amber-900 hover:bg-amber-200 font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-2"
                  >
                    <HelpCircle className="w-4 h-4 text-amber-700" />
                    <span>{showSubmissionDetails ? 'הסתר תוצאות חידון' : 'צפי בתשובות והסברים'}</span>
                  </button>

                  <button
                    onClick={onViewLeaderboards}
                    className="bg-amber-600 text-white hover:bg-amber-700 font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-2"
                  >
                    <Award className="w-4 h-4" />
                    <span>עבור לתחרות הכיתתית</span>
                  </button>
                </div>
              )}
            </div>

            {/* Optional Completed Answers Review */}
            {isCompletedToday && showSubmissionDetails && submission && (
              <div className="mt-6 bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4 animate-in fade-in">
                <h4 className="font-extrabold text-amber-950 text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>תוצאות החידון היומי ({submission.score} מתוך 4 נכונות):</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {currentHalacha.questions.map((q, qIdx) => {
                    const userSelected = submission.answers[q.id];
                    const isCorrect = userSelected === q.correctOptionIndex;

                    return (
                      <div
                        key={q.id}
                        className={`p-4 rounded-xl border ${
                          isCorrect
                            ? 'bg-emerald-50/80 border-emerald-200'
                            : 'bg-rose-50/80 border-rose-200'
                        }`}
                      >
                        <p className="font-bold text-slate-900 mb-2">
                          {qIdx + 1}. {q.text}
                        </p>
                        <p className="text-slate-700 mb-1">
                          <span className="font-semibold">התשובה שלך: </span>
                          <span className={isCorrect ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                            {q.options[userSelected] || 'לא ענית'}
                          </span>
                        </p>
                        {!isCorrect && (
                          <p className="text-emerald-800 font-bold mb-1">
                            תשובה נכונה: {q.options[q.correctOptionIndex]}
                          </p>
                        )}
                        {q.explanation && (
                          <p className="text-slate-600 text-[11px] italic mt-1 border-t border-slate-200 pt-1">
                            💡 {q.explanation}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white p-8 rounded-2xl text-center text-slate-500 border border-amber-200">
          לא נמצאה הלכה יומי ליום זה.
        </div>
      )}
    </div>
  );
};
