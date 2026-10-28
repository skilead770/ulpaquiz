import React, { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Sparkles,
  Calendar,
  Award,
  ChevronLeft,
  Flame,
  ArrowLeft,
  GraduationCap,
  BookmarkCheck,
  HelpCircle,
  Clock,
  MessageSquare,
} from 'lucide-react';
import { Student, DailyHalacha, PrizeMilestone } from '../types';
import { DEFAULT_PRIZE_MILESTONES } from '../data/seedData';
import { formatQuizDateLabel } from '../lib/quizSchedule';
import { useTenant } from '../context/SchoolContext';
import { SuggestQuestionModal } from './SuggestQuestionModal';
import { QuestionFeedbackModal } from './QuestionFeedbackModal';

interface DashboardProps {
  student: Student;
  halachot: DailyHalacha[];
  isLoadingHalachot: boolean;
  halachotLoadError: string | null;
  onRetryLoad: () => void;
  selectedDate: string;
  todayDate: string;
  availableQuizDates: string[];
  prizeMilestones?: PrizeMilestone[];
  onSelectDate: (date: string) => void;
  onStartQuiz: () => void;
  onViewLeaderboards: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  student,
  halachot,
  isLoadingHalachot,
  halachotLoadError,
  onRetryLoad,
  selectedDate,
  todayDate,
  availableQuizDates,
  prizeMilestones,
  onSelectDate,
  onStartQuiz,
  onViewLeaderboards,
}) => {
  const [showSubmissionDetails, setShowSubmissionDetails] = useState(false);
  const { currentSchool, genderText } = useTenant();
  const isBoys = currentSchool.type === 'boys';
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [feedbackQuestionContext, setFeedbackQuestionContext] = useState<{
    date: string;
    halachaId?: string;
    halachaTitle?: string;
    questionId: string;
    questionText: string;
  } | null>(null);

  const currentHalacha = halachot.find((h) => h.date === selectedDate);
  const canTakeQuiz = availableQuizDates.includes(selectedDate) && currentHalacha?.quizEnabled !== false;
  const advanceQuizDates = availableQuizDates.slice(1);

  const isCompletedToday = student.completedDates.includes(selectedDate);
  const submission = student.submissions[selectedDate];

  // Find next milestone based on manager's configured prizeMilestones
  const effectiveMilestones =
    prizeMilestones && prizeMilestones.length > 0
      ? [...prizeMilestones].sort((a, b) => a.points - b.points)
      : DEFAULT_PRIZE_MILESTONES;

  const nextMilestone =
    effectiveMilestones.find((m) => m.points > student.points) ||
    effectiveMilestones[effectiveMilestones.length - 1];
  const pointsToNext = Math.max(0, nextMilestone.points - student.points);
  const prevMilestonePoints =
    effectiveMilestones.filter((m) => m.points <= student.points).pop()
      ?.points || 0;
  const milestoneRange = Math.max(1, nextMilestone.points - prevMilestonePoints);
  const progressPercent = Math.min(
    100,
    Math.round(
      ((student.points - prevMilestonePoints) / milestoneRange) * 100
    )
  );

  return (
    <div className="space-y-4 sm:space-y-6 pb-6 animate-in fade-in duration-300">
      {/* Top Welcome Banner & Personal Stats */}
      <div className="bg-gradient-to-l from-amber-700 via-amber-800 to-amber-900 rounded-3xl p-4 sm:p-8 text-white shadow-xl relative overflow-hidden border border-amber-600/30">
        <div className="absolute -top-10 -left-10 w-48 h-48 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-yellow-500/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-5 sm:gap-6 items-center">
          {/* Greeting & Info */}
          <div className="md:col-span-7 space-y-2.5 sm:space-y-3">
            <div className="inline-flex items-center gap-2 bg-amber-500/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-amber-200 border border-amber-400/30">
              <GraduationCap className="w-4 h-4 text-amber-300 shrink-0" />
              <span>{isBoys ? 'תלמיד' : 'תלמידת'} כיתה {student.className} • שכבת {student.grade}'</span>
            </div>

            <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight font-['Heebo']">
              שלום, <span className="text-amber-300">{student.fullName}</span>! 👋
            </h2>
            <p className="text-amber-100/90 text-xs sm:text-sm leading-relaxed">
              כל יום של לימוד הלכה מקרב אותך, את כיתה {student.className} ואת שכבת {student.grade}' לזכייה במבצע!
            </p>

            <div className="pt-1 flex flex-wrap items-center gap-2 sm:gap-3">
              <button
                onClick={onViewLeaderboards}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-amber-950 font-extrabold text-xs px-4 py-2.5 rounded-2xl shadow-md hover:bg-amber-100 transition-all hover:scale-105 active:scale-95 cursor-pointer"
              >
                <span>{isBoys ? 'צפה במיקום הכיתה והשכבה שלך' : 'צפי במיקום הכיתה והשכבה שלך'}</span>
                <ArrowLeft className="w-4 h-4 shrink-0" />
              </button>

              <button
                onClick={() => setShowSuggestModal(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-amber-500/25 hover:bg-amber-500/40 text-amber-100 border border-amber-300/40 font-bold text-xs px-3.5 py-2.5 rounded-2xl transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-xs"
              >
                <Sparkles className="w-4 h-4 text-yellow-300 shrink-0" />
                <span>הציעי שאלת הלכה לחידון (בונוס נקודות)</span>
              </button>

              <button
                onClick={() => {
                  setFeedbackQuestionContext({
                    date: selectedDate || todayDate,
                    halachaId: currentHalacha?.id,
                    halachaTitle: currentHalacha?.title,
                    questionId: 'general',
                    questionText: 'משוב כללי והצעת שיפור לאפליקציה ולחידונים',
                  });
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/15 hover:bg-white/25 text-white border border-white/30 font-bold text-xs px-3.5 py-2.5 rounded-2xl transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-xs"
              >
                <MessageSquare className="w-4 h-4 text-amber-200 shrink-0" />
                <span>הצעות שיפור ומשוב 💡</span>
              </button>
            </div>
          </div>

          {/* Points & Milestone Card */}
          <div className="md:col-span-5 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 sm:p-5 space-y-3 sm:space-y-4 shadow-inner">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-200 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-yellow-300 shrink-0" />
                מאזן הנקודות שלך
              </span>
              <span className="text-2xl font-black text-amber-300 font-['Heebo']">
                {student.points} <span className="text-xs font-semibold text-white">נק'</span>
              </span>
            </div>

            {/* Progress to Next Milestone */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-amber-100 font-semibold">
                <span>יעד: {nextMilestone.title}</span>
                <span>{pointsToNext > 0 ? `חסרות ${pointsToNext} נק'` : 'הגעת ליעד!'}</span>
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

      {/* Pending Approval Banner */}
      {student.status === 'pending' && (
        <div className="bg-gradient-to-r from-amber-100 via-amber-50 to-orange-100 border-2 border-amber-400 text-amber-950 p-4 sm:p-5 rounded-3xl shadow-md flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 animate-in slide-in-from-top-2">
          <div className="p-2.5 sm:p-3 bg-amber-600 text-white rounded-2xl shrink-0 shadow-xs">
            <Clock className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
          </div>
          <div className="space-y-1">
            <h4 className="font-extrabold text-sm sm:text-base text-amber-950 font-['Heebo'] flex items-center gap-2">
              <span>בקשת ההרשמה שלך נקלטה וממתינה לאישור {genderText.institutionManagement} ⏳</span>
            </h4>
            <p className="text-xs text-amber-900 font-medium leading-relaxed">
              {isBoys
                ? `תוכל לעיין בהלכות היומיות כבר עכשיו. ברגע שהנהלת ה${genderText.institutionType} תאשר את הרשמתך, כפתור החידון יופעל ותוכל להתחיל לצבור נקודות!`
                : `תוכלי לעיין בהלכות היומיות כבר עכשיו. ברגע שהנהלת ה${genderText.institutionType} תאשר את הרשמתך, כפתור החידון יופעל ותוכלי להתחיל לצבור נקודות!`}
            </p>
          </div>
        </div>
      )}

      {/* Date Navigator Bar */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-4 shadow-xs border border-amber-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2 text-amber-950 font-bold text-xs sm:text-sm shrink-0">
          <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
          <span>בחירת תאריך הלכה:</span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto py-1 scrollbar-none">
          {halachot.map((h) => {
            const isSelected = h.date === selectedDate;
            const isDone = student.completedDates.includes(h.date);

            return (
              <button
                key={h.id}
                onClick={() => onSelectDate(h.date)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
                }`}
              >
                <span>{formatQuizDateLabel(h.hebrewDate, h.date)}</span>
                {advanceQuizDates.includes(h.date) && (
                  <span className={`text-[9px] font-extrabold ${isSelected ? 'text-amber-100' : 'text-amber-700'}`}>
                    מראש
                  </span>
                )}
                {isDone && (
                  <CheckCircle2
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isSelected ? 'text-amber-200' : 'text-emerald-600'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
        {advanceQuizDates.length > 0 && (
          <p className="w-full text-[11px] leading-relaxed text-amber-800">
            לקראת שבת או חג, אפשר להשלים מראש את החידונים לתאריכים המסומנים מראש.
          </p>
        )}
      </div>

      {/* Main Halacha Content Card */}
      {currentHalacha ? (
        <div className="bg-white rounded-3xl shadow-sm border border-amber-200/80 overflow-hidden">
          {/* Halacha Card Header */}
          <div className="bg-gradient-to-r from-amber-100 via-amber-50 to-orange-50 p-4 sm:p-8 border-b border-amber-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="bg-amber-600 text-white text-[11px] sm:text-xs font-bold px-2.5 sm:px-3 py-1 rounded-full shadow-xs flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 shrink-0" />
                  <span>{currentHalacha.topic}</span>
                </span>
                <span className="bg-amber-200/80 text-amber-950 text-[11px] sm:text-xs font-extrabold px-2.5 sm:px-3 py-1 rounded-full border border-amber-300 max-w-full truncate">
                  📚 {currentHalacha.source || 'סדרת אהלי הלכה • הגר"י אריאל שליט"א'}
                </span>
                <span className="text-[11px] sm:text-xs font-medium text-amber-800">
                  • {formatQuizDateLabel(currentHalacha.hebrewDate, currentHalacha.date)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFeedbackQuestionContext({
                      date: currentHalacha.date,
                      halachaId: currentHalacha.id,
                      halachaTitle: currentHalacha.title,
                      questionId: 'daily-halacha',
                      questionText: `משוב על ההלכה: ${currentHalacha.title}`,
                    });
                  }}
                  className="bg-amber-100/90 hover:bg-amber-200 text-amber-900 border border-amber-300/80 px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                  title="יש לך הערה או רעיון לגבי הלכה זו?"
                >
                  <MessageSquare className="w-3 h-3 text-amber-700" />
                  <span>הערה / משוב על ההלכה</span>
                </button>
              </div>
              <h3 className="text-lg sm:text-2xl font-extrabold text-amber-950 font-['Heebo'] leading-snug">
                {currentHalacha.title}
              </h3>
              {currentHalacha.suggestedBy && (
                <div className="inline-flex items-center gap-1.5 bg-amber-100/90 text-amber-900 border border-amber-300 px-3 py-1 rounded-full text-xs font-bold shadow-2xs">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>
                    הלכה וחידון זה נכתבו בהשתתפות <strong>{currentHalacha.suggestedBy.studentName}</strong> (כיתה {currentHalacha.suggestedBy.className})!
                  </span>
                </div>
              )}
            </div>

              {isCompletedToday ? (
              <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-3.5 sm:px-4 py-2 rounded-2xl flex items-center gap-2 text-xs font-bold shadow-xs shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <p>סיימת ללמוד ולענות להיום!</p>
                  <p className="text-[11px] text-emerald-700 font-semibold">
                    צברת {submission?.earnedPoints || 1} נקודות
                  </p>
                </div>
              </div>
              ) : canTakeQuiz ? (
              <div className="bg-amber-200/80 text-amber-950 px-3 py-1.5 rounded-2xl flex items-center gap-1.5 text-xs font-bold border border-amber-300/60 shrink-0 self-start sm:self-auto">
                <Flame className="w-4 h-4 text-amber-700 animate-bounce shrink-0" />
                <span>{isBoys ? 'מוכן לחידון? קרא וענה!' : 'מוכנה לחידון? קראי ועני!'}</span>
              </div>
              ) : (
                <div className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-2xl text-xs font-bold border border-slate-200 shrink-0 self-start sm:self-auto">
                  {selectedDate !== todayDate ? 'החידון לתאריך זה אינו פתוח כעת' : 'לא נקבע חידון לתאריך זה'}
                </div>
            )}
          </div>

          {/* Halacha Body Text */}
          <div className="p-4 sm:p-8 space-y-4 sm:space-y-6">
            <div className="prose prose-amber max-w-none text-slate-800 text-sm sm:text-base leading-relaxed whitespace-pre-line bg-amber-50/30 p-4 sm:p-6 rounded-2xl border border-amber-100 font-sans">
              {currentHalacha.content}
            </div>

            {/* Bottom Action Area */}
            <div className="pt-4 border-t border-amber-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-amber-800 font-medium">
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>נלקח מתוך סדרת "אהלי הלכה" • 2 דק' קריאה • 4 שאלות</span>
                </span>
                <span className="text-amber-300 hidden sm:inline">•</span>
                <button
                  type="button"
                  onClick={() => {
                    setFeedbackQuestionContext({
                      date: currentHalacha.date,
                      halachaId: currentHalacha.id,
                      halachaTitle: currentHalacha.title,
                      questionId: 'daily-halacha',
                      questionText: `משוב על ההלכה: ${currentHalacha.title}`,
                    });
                  }}
                  className="text-amber-900 hover:text-amber-950 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>יש לך הערה או הצעת שיפור? שתפי אותנו</span>
                </button>
              </div>

              {!isCompletedToday && canTakeQuiz ? (
                <button
                  onClick={onStartQuiz}
                  className="w-full sm:w-auto bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 text-white font-extrabold text-sm sm:text-base px-6 sm:px-8 py-3.5 rounded-2xl shadow-lg shadow-amber-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 sm:gap-3 cursor-pointer group"
                >
                  <BookmarkCheck className="w-5 h-5 group-hover:scale-110 transition-transform shrink-0" />
                  <span>סיימתי ללמוד, מעבר לחידון היומי</span>
                  <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform shrink-0" />
                </button>
              ) : isCompletedToday ? (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                  <button
                    onClick={() => setShowSubmissionDetails(!showSubmissionDetails)}
                    className="w-full sm:w-auto bg-amber-100 text-amber-900 hover:bg-amber-200 font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <HelpCircle className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>{showSubmissionDetails ? 'הסתר תוצאות חידון' : isBoys ? 'צפה בתשובות והסברים' : 'צפי בתשובות והסברים'}</span>
                  </button>

                  <button
                    onClick={onViewLeaderboards}
                    className="w-full sm:w-auto bg-amber-600 text-white hover:bg-amber-700 font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Award className="w-4 h-4 shrink-0" />
                    <span>עבור לתחרות הכיתתית</span>
                  </button>
                </div>
              ) : (
                <div className="w-full sm:w-auto text-center text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl">
                  {selectedDate !== todayDate ? 'החידון ייפתח ביום שלו' : `הנהלת ה${genderText.institutionType} השביתה את החידון לתאריך זה`}
                </div>
              )}
            </div>

            {/* Optional Completed Answers Review */}
            {isCompletedToday && showSubmissionDetails && submission && (
              <div className="mt-6 bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4 animate-in fade-in">
                <h4 className="font-extrabold text-amber-950 text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>תוצאות החידון היומי ({submission.score} מתוך 4 נכונות):</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 text-xs">
                  {currentHalacha.questions.map((q, qIdx) => {
                    const userSelected = submission.answers[q.id];
                    const isCorrect = userSelected === q.correctOptionIndex;

                    return (
                      <div
                        key={q.id}
                        className={`p-3.5 sm:p-4 rounded-xl border ${
                          isCorrect
                            ? 'bg-emerald-50/80 border-emerald-200'
                            : 'bg-rose-50/80 border-rose-200'
                        }`}
                      >
                        <p className="font-bold text-slate-900 mb-2 leading-relaxed">
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
                        <div className="mt-2 pt-1 border-t border-slate-200/60 flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() =>
                              setFeedbackQuestionContext({
                                date: currentHalacha.date,
                                halachaId: currentHalacha.id,
                                halachaTitle: currentHalacha.title,
                                questionId: q.id,
                                questionText: q.text,
                              })
                            }
                            className="inline-flex items-center gap-1 text-[11px] text-amber-800 hover:text-amber-950 font-semibold hover:underline cursor-pointer"
                          >
                            <MessageSquare className="w-3 h-3 text-amber-600" />
                            <span>יש לך הערה או השגה על שאלה זו?</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white p-6 sm:p-8 rounded-2xl text-center text-slate-600 border border-amber-200 text-sm space-y-3">
          {isLoadingHalachot ? (
            <p role="status">טוען את ההלכה והחידון היומי...</p>
          ) : halachotLoadError ? (
            <>
              <p role="alert">לא ניתן לטעון את ההלכה והחידון היומי.</p>
              <p className="text-xs text-slate-500">{halachotLoadError}</p>
              <button
                type="button"
                onClick={onRetryLoad}
                className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700"
              >
                {isBoys ? 'נסה לטעון שוב' : 'נסי לטעון שוב'}
              </button>
            </>
          ) : (
            <>
              <p>לא נמצאה הלכה יומית ליום זה.</p>
              <button
                type="button"
                onClick={onRetryLoad}
                className="rounded-xl border border-amber-300 px-4 py-2 text-xs font-bold text-amber-900 hover:bg-amber-50"
              >
                {isBoys ? 'רענן את ההלכות' : 'רענני את ההלכות'}
              </button>
            </>
          )}
        </div>
      )}

      {showSuggestModal && (
        <SuggestQuestionModal
          student={student}
          isOpen={true}
          onClose={() => setShowSuggestModal(false)}
          halachot={halachot}
          todayDate={todayDate}
        />
      )}

      {feedbackQuestionContext && (
        <QuestionFeedbackModal
          student={student}
          isOpen={true}
          questionContext={feedbackQuestionContext}
          onClose={() => setFeedbackQuestionContext(null)}
        />
      )}
    </div>
  );
};
