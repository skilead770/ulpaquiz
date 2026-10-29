import React from 'react';
import {
  ChevronLeft, ChevronRight, BarChart3, Copy, Eye, RotateCcw,
  TrendingUp, CheckCircle, RefreshCw,
  Heart, Users, Award, Sparkles, Clock, GraduationCap,
  ClipboardCheck, FileSpreadsheet, Search, CheckCircle2, FileText,
} from 'lucide-react';
import { Student, DailyHalacha, QuizSubmission } from '../../../types';
import { getTodayInJerusalem } from '../../../lib/quizSchedule';

interface DateSubmissionsData {
  totalStudents: number;
  submittedCount: number;
  notSubmittedCount: number;
  participationPct: number;
  avgScore: string;
  avgPoints: number;
  perfectCount: number;
  submitted: { student: Student; submission: QuizSubmission }[];
  notSubmitted: Student[];
  classStatsList: {
    className: string;
    grade: string;
    total: number;
    submitted: number;
    perfect: number;
    totalScore: number;
    participationPct: number;
    avgScore: string;
  }[];
  questionStats: {
    question: { id: string; text: string; options: string[]; correctOptionIndex: number; explanation?: string };
    correctCount: number;
    pct: number;
  }[];
}

interface FilteredRosterItem {
  student: Student;
  hasSubmitted: boolean;
  submission?: QuizSubmission;
}

interface ResultsTabProps {
  resultSelectedDate: string;
  setResultSelectedDate: (date: string) => void;
  resultClassFilter: string;
  setResultClassFilter: (value: string) => void;
  resultStatusFilter: 'ALL' | 'SUBMITTED' | 'NOT_SUBMITTED';
  setResultStatusFilter: (value: 'ALL' | 'SUBMITTED' | 'NOT_SUBMITTED') => void;
  resultSearchTerm: string;
  setResultSearchTerm: (value: string) => void;
  resultSortBy: 'score' | 'time' | 'name' | 'class';
  setResultSortBy: (value: 'score' | 'time' | 'name' | 'class') => void;
  resultHebrewDateLabel: string;
  dateSubmissionsData: DateSubmissionsData;
  filteredResultRoster: FilteredRosterItem[];
  handleShiftResultDate: (days: number) => void;
  handleCopyUnsubmittedNames: () => void;
  copyFeedback: string | null;
  handleResetQuiz: (studentId: string, date: string) => Promise<void>;
  isResettingQuiz: boolean;
  currentResultHalacha: DailyHalacha | undefined;
  uniqueClasses: string[];
  classesList: string[];
  setInspectingSubmission: (data: { student: Student; submission: QuizSubmission; halacha?: DailyHalacha } | null) => void;
  setInspectingStudentHistory: (student: Student | null) => void;
  onRefreshData: () => void;
  dailyQuizDedication: string;
}

export const ResultsTab: React.FC<ResultsTabProps> = ({
  resultSelectedDate,
  setResultSelectedDate,
  resultClassFilter,
  setResultClassFilter,
  resultStatusFilter,
  setResultStatusFilter,
  resultSearchTerm,
  setResultSearchTerm,
  resultSortBy,
  setResultSortBy,
  resultHebrewDateLabel,
  dateSubmissionsData,
  filteredResultRoster,
  handleShiftResultDate,
  handleCopyUnsubmittedNames,
  copyFeedback,
  handleResetQuiz,
  isResettingQuiz,
  currentResultHalacha,
  uniqueClasses,
  classesList,
  setInspectingSubmission,
  setInspectingStudentHistory,
  onRefreshData,
  dailyQuizDedication,
}) => {
  return (
<div className="space-y-6">
  {/* Top Control Bar & Date Navigator */}
  <div className="bg-white rounded-3xl p-5 md:p-6 border border-amber-200/80 shadow-sm space-y-4">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-amber-100 pb-4">
      <div>
        <div className="flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-amber-600" />
          <h3 className="text-xl md:text-2xl font-black text-amber-950 font-['Heebo']">
            תוצאות וסטטוס חידון יומי
          </h3>
        </div>
        <p className="text-xs text-amber-800/80 mt-1">
          מעקב חי אחר הגשות, השתתפות כיתתית, ניתוח שאלות ואיפוס חידונים לתלמידות
        </p>
      </div>

      {/* Date picker + navigator */}
      <div className="flex items-center gap-2 flex-wrap bg-amber-50/80 p-2 rounded-2xl border border-amber-200">
        <button
          type="button"
          onClick={() => handleShiftResultDate(-1)}
          title="יום קודם"
          className="p-2 rounded-xl text-amber-900 hover:bg-amber-200/60 transition-colors cursor-pointer"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={resultSelectedDate}
            onChange={(e) => setResultSelectedDate(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-amber-300 bg-white text-xs font-bold text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <button
            type="button"
            onClick={() => setResultSelectedDate(getTodayInJerusalem())}
            className="px-3 py-1.5 rounded-xl text-xs font-black bg-amber-600 text-white hover:bg-amber-700 transition-colors shadow-xs cursor-pointer"
          >
            היום
          </button>
        </div>

        <button
          type="button"
          onClick={() => handleShiftResultDate(1)}
          title="יום הבא"
          className="p-2 rounded-xl text-amber-900 hover:bg-amber-200/60 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={onRefreshData}
          title="רענן נתונים"
          className="p-2 rounded-xl text-amber-800 hover:bg-amber-200/60 transition-colors cursor-pointer mr-1"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
    </div>

    {/* Date summary badge & Halacha info */}
    <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-l from-amber-50 via-white to-amber-50/50 p-3.5 rounded-2xl border border-amber-200/70 text-xs">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-extrabold text-amber-950 text-sm">
          תאריך עברי: {resultHebrewDateLabel}
        </span>
        <span className="text-amber-300">•</span>
        <span className="text-slate-600">
          {currentResultHalacha ? (
            <span className="font-bold text-slate-800">
              הלכה יומית: {currentResultHalacha.title}
            </span>
          ) : (
            <span className="text-rose-600 font-semibold">לא נמצאה הלכה משובצת לתאריך זה</span>
          )}
        </span>
      </div>
      {dailyQuizDedication && (
        <div className="flex items-center gap-1.5 text-rose-800 bg-rose-50 px-3 py-1 rounded-full border border-rose-200 font-bold text-[11px]">
          <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
          <span>הקדשה: {dailyQuizDedication}</span>
        </div>
      )}
    </div>
  </div>

  {/* KPI Summary Cards */}
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    {/* Card 1: Participation */}
    <div className="bg-white rounded-3xl p-5 border border-amber-200/80 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-2">
          <span>השתתפות והגשות</span>
          <Users className="w-4 h-4 text-amber-600" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black text-amber-950 font-['Heebo']">
            {dateSubmissionsData.submittedCount}
          </span>
          <span className="text-xs font-bold text-slate-500">
            מתוך {dateSubmissionsData.totalStudents} תלמידות
          </span>
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-amber-100">
        <div className="flex justify-between items-center text-xs font-extrabold text-amber-950 mb-1">
          <span>אחוז השתתפות</span>
          <span>{dateSubmissionsData.participationPct}%</span>
        </div>
        <div className="w-full bg-amber-100 rounded-full h-2 overflow-hidden">
          <div
            className="bg-amber-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, dateSubmissionsData.participationPct)}%` }}
          />
        </div>
      </div>
    </div>

    {/* Card 2: Average Score */}
    <div className="bg-white rounded-3xl p-5 border border-amber-200/80 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-2">
          <span>ציון ממוצע</span>
          <Award className="w-4 h-4 text-blue-600" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black text-blue-950 font-['Heebo']">
            {dateSubmissionsData.avgScore}
          </span>
          <span className="text-xs font-bold text-slate-500">מתוך 4.0</span>
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-blue-50 text-xs font-bold text-blue-800 flex items-center justify-between">
        <span>ממוצע נקודות שנצברו:</span>
        <span className="font-extrabold text-blue-950 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
          {dateSubmissionsData.avgPoints} נק׳
        </span>
      </div>
    </div>

    {/* Card 3: Perfect Scores */}
    <div className="bg-white rounded-3xl p-5 border border-amber-200/80 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-2">
          <span>ציון מושלם (4/4)</span>
          <Sparkles className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black text-emerald-950 font-['Heebo']">
            {dateSubmissionsData.perfectCount}
          </span>
          <span className="text-xs font-bold text-slate-500">תלמידות</span>
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-emerald-50 text-xs font-bold text-emerald-800 flex items-center justify-between">
        <span>אחוז מבין המגישות:</span>
        <span className="font-extrabold text-emerald-950 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
          {dateSubmissionsData.submittedCount > 0
            ? Math.round((dateSubmissionsData.perfectCount / dateSubmissionsData.submittedCount) * 100)
            : 0}
          %
        </span>
      </div>
    </div>

    {/* Card 4: Not Submitted & WhatsApp Reminder */}
    <div className="bg-white rounded-3xl p-5 border border-rose-200/80 shadow-xs flex flex-col justify-between bg-gradient-to-br from-white to-rose-50/30">
      <div>
        <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-2">
          <span>טרם הגישו</span>
          <Clock className="w-4 h-4 text-rose-600" />
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black text-rose-950 font-['Heebo']">
            {dateSubmissionsData.notSubmittedCount}
          </span>
          <span className="text-xs font-bold text-slate-500">תלמידות</span>
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-rose-100 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={handleCopyUnsubmittedNames}
          className="w-full py-1.5 px-3 rounded-xl text-xs font-extrabold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
          title="העתקת שמות התלמידות שטרם הגישו לשליחה בוואטסאפ"
        >
          <Copy className="w-3.5 h-3.5" />
          <span>העתקת שמות לוואטסאפ</span>
        </button>
        {copyFeedback && (
          <p className="text-[11px] text-center font-bold text-emerald-700 animate-fade-in">
            {copyFeedback}
          </p>
        )}
      </div>
    </div>
  </div>

  {/* Class League / Breakdown Grid */}
  <div className="bg-white rounded-3xl p-6 border border-amber-200/80 shadow-sm space-y-4">
    <div className="flex items-center justify-between border-b border-amber-100 pb-3 flex-wrap gap-2">
      <div>
        <h4 className="text-lg font-black text-amber-950 font-['Heebo'] flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-amber-600" />
          <span>סטטוס לפי כיתות (ליגת כיתות)</span>
        </h4>
        <p className="text-xs text-amber-800/80">
          לחצי על כיתה כדי לסנן את טבלת ההגשות לתלמידות אותה כיתה בלבד
        </p>
      </div>
      {resultClassFilter !== 'ALL' && (
        <button
          type="button"
          onClick={() => setResultClassFilter('ALL')}
          className="text-xs font-bold text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-xl border border-amber-200 transition-colors cursor-pointer"
        >
          הצג את כל הכיתות (איפוס סינון)
        </button>
      )}
    </div>

    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
      {dateSubmissionsData.classStatsList.map((cs) => {
        const isSelected = resultClassFilter === cs.className;
        return (
          <button
            type="button"
            key={cs.className}
            onClick={() => setResultClassFilter(isSelected ? 'ALL' : cs.className)}
            className={`p-3 rounded-2xl border text-right transition-all cursor-pointer ${
              isSelected
                ? 'bg-amber-100 border-amber-500 shadow-sm ring-2 ring-amber-400'
                : 'bg-amber-50/40 border-amber-200 hover:bg-amber-50 hover:border-amber-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-black text-sm text-amber-950">
                כיתה {cs.className}
              </span>
              <span className={`text-[11px] font-black px-1.5 py-0.5 rounded-md ${
                cs.participationPct >= 70
                  ? 'bg-emerald-100 text-emerald-800'
                  : cs.participationPct >= 40
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-slate-100 text-slate-700'
              }`}>
                {cs.participationPct}%
              </span>
            </div>

            <div className="w-full bg-slate-200/70 rounded-full h-1.5 mb-2 overflow-hidden">
              <div
                className={`h-1.5 rounded-full ${
                  cs.participationPct >= 70 ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
                style={{ width: `${Math.min(100, cs.participationPct)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-600 font-bold">
              <span>{cs.submitted}/{cs.total} הגישו</span>
              <span>ממוצע: {cs.avgScore}</span>
            </div>
          </button>
        );
      })}
    </div>
  </div>

  {/* Question Analytics Breakdown */}
  {dateSubmissionsData.questionStats.length > 0 && (
    <div className="bg-white rounded-3xl p-6 border border-amber-200/80 shadow-sm space-y-4">
      <div className="border-b border-amber-100 pb-3">
        <h4 className="text-lg font-black text-amber-950 font-['Heebo'] flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-amber-600" />
          <span>ניתוח שאלות החידון היומי</span>
        </h4>
        <p className="text-xs text-amber-800/80">
          אחוזי הצלחה לפי שאלה מתוך {dateSubmissionsData.submittedCount} תלמידות שהגישו
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {dateSubmissionsData.questionStats.map((qs, idx) => (
          <div
            key={qs.question.id || idx}
            className="p-4 rounded-2xl border border-amber-200/80 bg-amber-50/30 flex flex-col justify-between space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="font-black text-xs text-amber-950 bg-amber-100 px-2 py-0.5 rounded-md">
                שאלה {idx + 1}
              </span>
              <span className={`text-xs font-black px-2 py-0.5 rounded-md ${
                qs.pct >= 75
                  ? 'bg-emerald-100 text-emerald-800'
                  : qs.pct >= 50
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-rose-100 text-rose-800'
              }`}>
                {qs.pct}% הצלחה
              </span>
            </div>
            <p className="text-xs font-bold text-slate-800 line-clamp-2" title={qs.question.text}>
              {qs.question.text}
            </p>
            <div className="pt-2 border-t border-amber-100/80 flex items-center justify-between text-[11px] text-slate-500 font-bold">
              <span>ענו נכון:</span>
              <span className="font-extrabold text-slate-800">
                {qs.correctCount} מתוך {dateSubmissionsData.submittedCount}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )}

  {/* Detailed Student Submissions Table */}
  <div className="bg-white rounded-3xl p-6 border border-amber-200/80 shadow-sm space-y-4">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-amber-100 pb-4">
      <div>
        <h4 className="text-lg font-black text-amber-950 font-['Heebo'] flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-amber-600" />
          <span>פירוט הגשות וסטטוס תלמידות</span>
        </h4>
        <p className="text-xs text-amber-800/80">
          מוצגות {filteredResultRoster.length} תלמידות בהתאם לסינונים שנבחרו
        </p>
      </div>

      {/* Status filter pills */}
      <div className="flex items-center gap-1.5 bg-amber-50 p-1.5 rounded-2xl border border-amber-200 flex-wrap">
        <button
          type="button"
          onClick={() => setResultStatusFilter('ALL')}
          className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
            resultStatusFilter === 'ALL'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-amber-900 hover:bg-amber-200/50'
          }`}
        >
          הכל ({dateSubmissionsData.totalStudents})
        </button>
        <button
          type="button"
          onClick={() => setResultStatusFilter('SUBMITTED')}
          className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
            resultStatusFilter === 'SUBMITTED'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-emerald-900 hover:bg-emerald-100/60'
          }`}
        >
          הגישו ({dateSubmissionsData.submittedCount})
        </button>
        <button
          type="button"
          onClick={() => setResultStatusFilter('NOT_SUBMITTED')}
          className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
            resultStatusFilter === 'NOT_SUBMITTED'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-rose-900 hover:bg-rose-100/60'
          }`}
        >
          טרם הגישו ({dateSubmissionsData.notSubmittedCount})
        </button>
      </div>
    </div>

    {/* Filter controls row */}
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
        <input
          type="text"
          placeholder="חיפוש לפי שם, אימייל..."
          value={resultSearchTerm}
          onChange={(e) => setResultSearchTerm(e.target.value)}
          className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      {/* Class filter */}
      <div>
        <select
          value={resultClassFilter}
          onChange={(e) => setResultClassFilter(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
        >
          <option value="ALL">כל הכיתות</option>
          {classesList.map((cls) => (
            <option key={cls} value={cls}>
              כיתה {cls}
            </option>
          ))}
        </select>
      </div>

      {/* Sort by */}
      <div>
        <select
          value={resultSortBy}
          onChange={(e) => setResultSortBy(e.target.value as any)}
          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
        >
          <option value="score">מיון לפי: ציון (גבוה לנמוך)</option>
          <option value="time">מיון לפי: שעת הגשה</option>
          <option value="name">מיון לפי: שם התלמידה (א-ת)</option>
          <option value="class">מיון לפי: כיתה</option>
        </select>
      </div>

      {/* WhatsApp broadcast copy */}
      <div>
        <button
          type="button"
          onClick={handleCopyUnsubmittedNames}
          className="w-full py-2 px-3 rounded-xl text-xs font-black text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
        >
          <Copy className="w-3.5 h-3.5" />
          <span>העתקת שמות לוואטסאפ</span>
        </button>
      </div>
    </div>

    {/* Table */}
    <div className="overflow-x-auto rounded-2xl border border-amber-200">
      <table className="w-full text-right text-xs">
        <thead className="bg-amber-100/70 text-amber-950 font-black">
          <tr>
            <th className="p-3">שם התלמידה</th>
            <th className="p-3 text-center">כיתה</th>
            <th className="p-3 text-center">סטטוס</th>
            <th className="p-3 text-center">ציון</th>
            <th className="p-3 text-center">נקודות שנצברו</th>
            <th className="p-3 text-center">שעת הגשה</th>
            <th className="p-3 text-center">פעולות</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-amber-100">
          {filteredResultRoster.length === 0 ? (
            <tr>
              <td colSpan={7} className="p-8 text-center text-slate-500 font-bold">
                לא נמצאו תלמידות התואמות את הסינון שנבחר.
              </td>
            </tr>
          ) : (
            filteredResultRoster.map(({ student, hasSubmitted, submission }) => {
              const score = submission?.score;
              const isPerfect = score === 4;
              return (
                <tr
                  key={student.id}
                  className={`hover:bg-amber-50/50 transition-colors ${
                    !hasSubmitted ? 'bg-slate-50/40 text-slate-600' : ''
                  }`}
                >
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-900 flex items-center justify-center font-black text-xs shrink-0">
                        {student.fullName.charAt(0)}
                      </div>
                      <div>
                        <div className="font-extrabold text-slate-900">{student.fullName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">@{student.username}</div>
                      </div>
                    </div>
                  </td>

                  <td className="p-3 text-center">
                    <span className="inline-block px-2 py-0.5 rounded-lg bg-amber-100 text-amber-950 font-black text-[11px]">
                      {student.className}
                    </span>
                  </td>

                  <td className="p-3 text-center">
                    {hasSubmitted ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-850 font-black text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>הגישה</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[11px]">
                        <Clock className="w-3 h-3 text-rose-500" />
                        <span>טרם הגישה</span>
                      </span>
                    )}
                  </td>

                  <td className="p-3 text-center">
                    {hasSubmitted ? (
                      <span
                        className={`inline-block font-black px-2.5 py-0.5 rounded-lg text-xs ${
                          isPerfect
                            ? 'bg-amber-100 text-amber-950 border border-amber-300 shadow-xs'
                            : score && score >= 3
                            ? 'bg-blue-100 text-blue-900'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {score !== undefined ? `${score} / 4` : '4 / 4'}
                      </span>
                    ) : (
                      <span className="text-slate-300 font-bold">—</span>
                    )}
                  </td>

                  <td className="p-3 text-center">
                    {hasSubmitted ? (
                      <span className="font-black text-amber-900 text-xs">
                        +{submission?.earnedPoints ?? 20} נק׳
                      </span>
                    ) : (
                      <span className="text-slate-300 font-bold">—</span>
                    )}
                  </td>

                  <td className="p-3 text-center text-slate-600 font-mono text-[11px]">
                    {hasSubmitted ? submission?.submittedAt || '—' : '—'}
                  </td>

                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {hasSubmitted && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setInspectingSubmission({
                                student,
                                submission: submission || {
                                  date: resultSelectedDate,
                                  score: 4,
                                  earnedPoints: 20,
                                  submittedAt: '—',
                                  answers: {},
                                },
                                halacha: currentResultHalacha,
                              })
                            }
                            className="p-1.5 rounded-lg text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer"
                            title="צפייה בפירוט התשובות"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            disabled={isResettingQuiz}
                            onClick={() => handleResetQuiz(student.id, resultSelectedDate)}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer disabled:opacity-40"
                            title="איפוס הגשת החידון לתלמידה זו"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => setInspectingStudentHistory(student)}
                        className="p-1.5 rounded-lg text-amber-800 hover:bg-amber-100 transition-colors cursor-pointer"
                        title="היסטוריית כל החידונים של התלמידה"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  </div>
</div>
  );
};
