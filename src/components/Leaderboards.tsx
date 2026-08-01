import React, { useState } from 'react';
import {
  Trophy,
  Users,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  Crown,
  Award,
  Medal,
  HelpCircle,
  TrendingUp,
} from 'lucide-react';
import {
  Student,
  LeaderboardData,
  StudentLeaderboardItem,
  ClassLeaderboardItem,
  GradeLeaderboardItem,
} from '../types';
import { DEFAULT_PRIZE_MILESTONES } from '../data/seedData';

interface LeaderboardsProps {
  currentStudent: Student;
  leaderboardData: LeaderboardData | null;
  selectedDate: string;
}

export const Leaderboards: React.FC<LeaderboardsProps> = ({
  currentStudent,
  leaderboardData,
  selectedDate,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<
    'my-class' | 'class-league' | 'grade-league'
  >('my-class');

  if (!leaderboardData) {
    return (
      <div className="bg-white p-8 rounded-3xl border border-amber-200 text-center text-amber-900 font-bold animate-pulse">
        טוען את נתוני לוח המובילים והתחרות...
      </div>
    );
  }

  // Personal tracker calculations
  const nextMilestone =
    DEFAULT_PRIZE_MILESTONES.find((m) => m.points > currentStudent.points) ||
    DEFAULT_PRIZE_MILESTONES[DEFAULT_PRIZE_MILESTONES.length - 1];
  const pointsNeededForPrize = Math.max(
    0,
    nextMilestone.points - currentStudent.points
  );

  // My Classmates list
  const myClassmates = leaderboardData.topStudents.filter(
    (s) => s.className === currentStudent.className
  );
  const myClassCompletedCount = myClassmates.filter((s) => s.completedToday).length;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in">
      {/* Tab Switcher Bar */}
      <div className="bg-white p-2 rounded-2xl border border-amber-200/80 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            onClick={() => setActiveSubTab('my-class')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm transition-all ${
              activeSubTab === 'my-class'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                : 'text-amber-900/80 hover:bg-amber-100/70'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>הכיתה שלי (מי עוד סיימה?)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('class-league')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm transition-all ${
              activeSubTab === 'class-league'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                : 'text-amber-900/80 hover:bg-amber-100/70'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>תחרות הכיתות</span>
          </button>

          <button
            onClick={() => setActiveSubTab('grade-league')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm transition-all ${
              activeSubTab === 'grade-league'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                : 'text-amber-900/80 hover:bg-amber-100/70'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>תחרות השכבות</span>
          </button>
        </div>

        <div className="text-xs font-semibold text-amber-800 px-3 hidden md:block">
          תאריך תחרות: {selectedDate}
        </div>
      </div>

      {/* =======================================
          TAB 1: MY CLASS ("הכיתה שלי")
      ======================================= */}
      {activeSubTab === 'my-class' && (
        <div className="space-y-6">
          {/* Top Banner: Leading Student(s) in Ulpana (Handles Ties!) */}
          <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-500 rounded-3xl p-6 text-white shadow-lg border border-yellow-300/40 relative overflow-hidden">
            <div className="flex items-center gap-2 text-xs font-extrabold text-amber-100 uppercase tracking-wider mb-2">
              <Crown className="w-4 h-4 text-yellow-200 animate-bounce" />
              <span>התלמידה המובילה באולפנה (מקום 1 במאזן הארצי)</span>
            </div>

            {leaderboardData.leadingStudents.length > 1 ? (
              /* Tie Banner */
              <div className="space-y-2">
                <div className="bg-yellow-400/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-yellow-100 inline-block">
                  🔥 יש תיקו במקום הראשון!
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {leaderboardData.leadingStudents.map((ls) => (
                    <div
                      key={ls.id}
                      className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/20 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-extrabold text-lg text-white font-['Heebo']">
                          {ls.fullName}
                        </p>
                        <p className="text-xs text-amber-100">
                          כיתה {ls.className} (שכבה {ls.grade}')
                        </p>
                      </div>
                      <span className="bg-yellow-300 text-amber-950 font-black text-sm px-3 py-1 rounded-xl shadow-xs">
                        {ls.points} נק'
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : leaderboardData.leadingStudents.length === 1 ? (
              /* Single Leader */
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-2xl sm:text-3xl font-black font-['Heebo'] text-white">
                    {leaderboardData.leadingStudents[0].fullName}
                  </h3>
                  <p className="text-amber-100 text-sm font-semibold">
                    כיתה {leaderboardData.leadingStudents[0].className} • שכבה{' '}
                    {leaderboardData.leadingStudents[0].grade}'
                  </p>
                </div>
                <div className="bg-white text-amber-950 px-5 py-2.5 rounded-2xl shadow-md font-black text-xl font-['Heebo'] text-center">
                  {leaderboardData.leadingStudents[0].points} נקודות
                </div>
              </div>
            ) : null}
          </div>

          {/* Personal Prize Tracker Meter */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-600 text-white flex items-center justify-center font-bold shadow-md shrink-0">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-extrabold text-amber-950 text-base font-['Heebo']">
                  המדד האישי שלך לפרס הבא: {nextMilestone.title}
                </h4>
                <p className="text-xs text-amber-800 font-semibold">
                  {pointsNeededForPrize > 0
                    ? `חסרות לך עוד ${pointsNeededForPrize} נקודות לקבלת ${nextMilestone.rewardDescription}!`
                    : 'כל הכבוד! הגעת ליעד הפרס!'}
                </p>
              </div>
            </div>

            <div className="w-full sm:w-auto bg-amber-100 border border-amber-300 text-amber-900 px-4 py-2 rounded-xl text-xs font-bold text-center">
              מאזן נוכחי: {currentStudent.points} נק'
            </div>
          </div>

          {/* Classmates Completion List */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-amber-200/80 space-y-4">
            <div className="flex items-center justify-between border-b border-amber-100 pb-4">
              <div>
                <h3 className="text-xl font-extrabold text-amber-950 font-['Heebo'] flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-600" />
                  <span>בנות כיתה {currentStudent.className} ("מי עוד סיימה?")</span>
                </h3>
                <p className="text-xs text-amber-800 font-medium">
                  {myClassCompletedCount} מתוך {myClassmates.length} בנות בכיתה כבר למדו וענו היום!
                </p>
              </div>

              <div className="bg-amber-100 text-amber-900 px-3 py-1 rounded-full text-xs font-bold border border-amber-200">
                {Math.round((myClassCompletedCount / (myClassmates.length || 1)) * 100)}% השתתפות היום
              </div>
            </div>

            {/* List Table */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {myClassmates.map((student) => {
                const isMe = student.id === currentStudent.id;

                return (
                  <div
                    key={student.id}
                    className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
                      isMe
                        ? 'bg-amber-100/90 border-amber-400 ring-2 ring-amber-300'
                        : student.completedToday
                        ? 'bg-emerald-50/60 border-emerald-200'
                        : 'bg-amber-50/30 border-amber-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                          student.completedToday
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-amber-200 text-amber-900'
                        }`}
                      >
                        {student.completedToday ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : (
                          student.fullName.charAt(0)
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-sm text-slate-900 font-['Heebo']">
                            {student.fullName}
                          </span>
                          {isMe && (
                            <span className="bg-amber-600 text-white text-[10px] px-1.5 py-0.2 rounded-md font-bold">
                              את
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 font-medium block">
                          {student.completedToday ? 'סיימה ללמוד היום ✨' : 'טרם השלימה להיום'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-black text-base text-amber-950 font-['Heebo'] block">
                        {student.points} נק'
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =======================================
          TAB 2: CLASS LEAGUE ("תחרות הכיתות")
      ======================================= */}
      {activeSubTab === 'class-league' && (
        <div className="space-y-6">
          {/* Top Banner: Leading Class(es) */}
          <div className="bg-gradient-to-r from-amber-700 via-amber-600 to-yellow-500 rounded-3xl p-6 text-white shadow-lg border border-yellow-300/40 relative overflow-hidden">
            <div className="flex items-center gap-2 text-xs font-extrabold text-amber-100 uppercase tracking-wider mb-2">
              <Trophy className="w-4 h-4 text-yellow-200 animate-bounce" />
              <span>הכיתה המובילה באולפנה (מועמדת לפרס כיתתי)</span>
            </div>

            {leaderboardData.leadingClasses.length > 1 ? (
              /* Tie Banner */
              <div className="space-y-2">
                <div className="bg-yellow-400/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-yellow-100 inline-block">
                  🔥 תיקו מותח במקום הראשון!
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {leaderboardData.leadingClasses.map((lc) => (
                    <div
                      key={lc.className}
                      className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/20 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-extrabold text-xl text-white font-['Heebo']">
                          כיתה {lc.className}
                        </p>
                        <p className="text-xs text-amber-100">
                          {lc.studentCount} תלמידות • שכבת {lc.grade}'
                        </p>
                      </div>
                      <span className="bg-yellow-300 text-amber-950 font-black text-sm px-3 py-1 rounded-xl shadow-xs">
                        {lc.totalPoints} נק'
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : leaderboardData.leadingClasses.length === 1 ? (
              /* Single Leading Class */
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-2xl sm:text-3xl font-black font-['Heebo'] text-white">
                    כיתה {leaderboardData.leadingClasses[0].className}
                  </h3>
                  <p className="text-amber-100 text-sm font-semibold">
                    שכבת {leaderboardData.leadingClasses[0].grade}' •{' '}
                    {leaderboardData.leadingClasses[0].studentCount} תלמידות
                  </p>
                </div>
                <div className="bg-white text-amber-950 px-5 py-2.5 rounded-2xl shadow-md font-black text-xl font-['Heebo'] text-center">
                  {leaderboardData.leadingClasses[0].totalPoints} נקודות כיתתיות
                </div>
              </div>
            ) : null}
          </div>

          {/* Class League Table */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-amber-200/80 space-y-4">
            <div className="border-b border-amber-100 pb-3">
              <h3 className="text-xl font-extrabold text-amber-950 font-['Heebo'] flex items-center gap-2">
                <Medal className="w-5 h-5 text-amber-600" />
                <span>טבלת הליגה הכללית של כל כיתות האולפנה</span>
              </h3>
            </div>

            <div className="space-y-2.5">
              {leaderboardData.classLeague.map((cls, idx) => {
                const isMyClass = cls.className === currentStudent.className;

                return (
                  <div
                    key={cls.className}
                    className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
                      cls.isLeading
                        ? 'bg-amber-100/90 border-amber-400 font-bold'
                        : isMyClass
                        ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-200'
                        : 'bg-white border-slate-100 hover:border-amber-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-8 h-8 rounded-xl font-black text-sm flex items-center justify-center ${
                          idx === 0
                            ? 'bg-yellow-400 text-amber-950 shadow-xs'
                            : idx === 1
                            ? 'bg-slate-200 text-slate-800'
                            : idx === 2
                            ? 'bg-amber-200 text-amber-900'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {idx + 1}
                      </span>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-base text-slate-900 font-['Heebo']">
                            כיתה {cls.className}
                          </span>
                          {isMyClass && (
                            <span className="bg-amber-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                              הכיתה שלך
                            </span>
                          )}
                          {cls.isLeading && (
                            <span className="bg-yellow-400 text-amber-950 text-[10px] px-2 py-0.5 rounded-full font-bold">
                              מקום 1!
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 font-medium">
                          {cls.studentCount} תלמידות • {cls.completedTodayCount} ענו היום
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-black text-lg text-amber-950 font-['Heebo'] block">
                        {cls.totalPoints} נק'
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =======================================
          TAB 3: GRADE LEAGUE ("תחרות השכבות")
      ======================================= */}
      {activeSubTab === 'grade-league' && (
        <div className="space-y-6">
          {/* Top Banner: Leading Grade(s) */}
          <div className="bg-gradient-to-r from-amber-700 via-amber-600 to-yellow-500 rounded-3xl p-6 text-white shadow-lg border border-yellow-300/40 relative overflow-hidden">
            <div className="flex items-center gap-2 text-xs font-extrabold text-amber-100 uppercase tracking-wider mb-2">
              <GraduationCap className="w-4 h-4 text-yellow-200 animate-bounce" />
              <span>השכבה המובילה באולפנה (מועמדת לפרס שכבתי)</span>
            </div>

            {leaderboardData.leadingGrades.length > 1 ? (
              /* Tie Banner */
              <div className="space-y-2">
                <div className="bg-yellow-400/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-yellow-100 inline-block">
                  🔥 תיקו בין השכבות במקום הראשון!
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {leaderboardData.leadingGrades.map((lg) => (
                    <div
                      key={lg.grade}
                      className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/20 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-extrabold text-xl text-white font-['Heebo']">
                          שכבת {lg.grade}'
                        </p>
                        <p className="text-xs text-amber-100">
                          {lg.studentCount} תלמידות בשכבה
                        </p>
                      </div>
                      <span className="bg-yellow-300 text-amber-950 font-black text-sm px-3 py-1 rounded-xl shadow-xs">
                        {lg.totalPoints} נק'
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : leaderboardData.leadingGrades.length === 1 ? (
              /* Single Leading Grade */
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-2xl sm:text-3xl font-black font-['Heebo'] text-white">
                    שכבת {leaderboardData.leadingGrades[0].grade}'
                  </h3>
                  <p className="text-amber-100 text-sm font-semibold">
                    {leaderboardData.leadingGrades[0].studentCount} תלמידות
                  </p>
                </div>
                <div className="bg-white text-amber-950 px-5 py-2.5 rounded-2xl shadow-md font-black text-xl font-['Heebo'] text-center">
                  {leaderboardData.leadingGrades[0].totalPoints} נקודות שכבתיות
                </div>
              </div>
            ) : null}
          </div>

          {/* Grade Meters & Comparative Graph */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-amber-200/80 space-y-6">
            <div className="border-b border-amber-100 pb-3">
              <h3 className="text-xl font-extrabold text-amber-950 font-['Heebo'] flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-600" />
                <span>מדד השוואתי בין 4 השכבות (ט', י', יא', יב')</span>
              </h3>
            </div>

            <div className="space-y-6">
              {leaderboardData.gradeLeague.map((gItem) => {
                const maxPointsInLeague = Math.max(
                  ...leaderboardData.gradeLeague.map((g) => g.totalPoints),
                  1
                );
                const barWidthPercent = Math.round(
                  (gItem.totalPoints / maxPointsInLeague) * 100
                );
                const isMyGrade = gItem.grade === currentStudent.grade;

                return (
                  <div key={gItem.grade} className="space-y-2">
                    <div className="flex items-center justify-between text-sm font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <span className="font-['Heebo'] text-base">
                          שכבת {gItem.grade}'
                        </span>
                        {isMyGrade && (
                          <span className="bg-amber-600 text-white text-[10px] px-2 py-0.5 rounded-full">
                            השכבה שלך
                          </span>
                        )}
                        {gItem.isLeading && (
                          <span className="bg-yellow-400 text-amber-950 text-[10px] px-2 py-0.5 rounded-full font-bold">
                            מובילה 🥇
                          </span>
                        )}
                      </div>

                      <span className="font-extrabold text-amber-950 text-base font-['Heebo']">
                        {gItem.totalPoints} נקודות
                      </span>
                    </div>

                    {/* Progress Bar Meter */}
                    <div className="w-full bg-slate-100 rounded-2xl h-6 p-1 overflow-hidden border border-slate-200 flex items-center">
                      <div
                        className={`h-full rounded-xl transition-all duration-700 flex items-center justify-end px-3 text-white text-xs font-bold ${
                          gItem.isLeading
                            ? 'bg-gradient-to-r from-amber-600 to-yellow-500 shadow-md'
                            : isMyGrade
                            ? 'bg-amber-500'
                            : 'bg-slate-400'
                        }`}
                        style={{ width: `${Math.max(12, barWidthPercent)}%` }}
                      >
                        {gItem.studentCount} תלמידות
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
