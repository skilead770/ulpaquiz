import React, { useState } from 'react';
import {
  BookOpen,
  Trophy,
  Settings,
  User,
  Crown,
  ChevronDown,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  UserPlus,
  Clock,
} from 'lucide-react';
import { Student } from '../types';

interface NavbarProps {
  students: Student[];
  currentStudentId: string | 'admin';
  onSelectUser: (id: string | 'admin') => void;
  activeTab: 'study' | 'leaderboard' | 'register' | 'admin';
  onChangeTab: (tab: 'study' | 'leaderboard' | 'register' | 'admin') => void;
  onResetDemo: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  students,
  currentStudentId,
  onSelectUser,
  activeTab,
  onChangeTab,
  onResetDemo,
}) => {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const currentStudent = students.find((s) => s.id === currentStudentId);
  const isAdmin = currentStudentId === 'admin';

  const handleReset = async () => {
    if (confirm('האם לאפס את כל הנתונים, הניקוד והחידונים למצב ההתחלתי?')) {
      setIsResetting(true);
      await onResetDemo();
      setIsResetting(false);
      setShowUserDropdown(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-amber-200/60 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          {/* Brand & Logo */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-400 p-0.5 shadow-md flex items-center justify-center">
              <div className="w-full h-full bg-amber-900/90 rounded-[14px] flex items-center justify-center text-amber-300">
                <Crown className="w-6 h-6 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold text-amber-950 tracking-tight font-['Heebo']">
                  מבצע הלכה יומית
                </h1>
                <span className="bg-amber-100 text-amber-900 border border-amber-300/80 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  ספר "אהלי הלכה"
                </span>
              </div>
              <p className="text-xs text-amber-800/80 font-medium hidden sm:block">
                אולפנא • לימוד יומי מתוך סדרת "אהלי הלכה"
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 sm:gap-2 bg-amber-50/80 p-1.5 rounded-2xl border border-amber-200/60">
            <button
              onClick={() => onChangeTab('study')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                activeTab === 'study'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                  : 'text-amber-900/80 hover:bg-amber-100/70 hover:text-amber-950'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>לימוד וחידון</span>
            </button>

            <button
              onClick={() => onChangeTab('leaderboard')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                activeTab === 'leaderboard'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                  : 'text-amber-900/80 hover:bg-amber-100/70 hover:text-amber-950'
              }`}
            >
              <Trophy className="w-4 h-4" />
              <span>לוח מובילים</span>
            </button>

            <button
              onClick={() => onChangeTab('register')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                activeTab === 'register'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                  : 'text-amber-900/80 hover:bg-amber-100/70 hover:text-amber-950'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>הרשמה למערכת</span>
            </button>

            <button
              onClick={() => onChangeTab('admin')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                activeTab === 'admin'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                  : 'text-amber-900/80 hover:bg-amber-100/70 hover:text-amber-950'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span className="hidden md:inline">ממשק מנהל</span>
              <span className="md:hidden">ניהול</span>
            </button>
          </nav>

          {/* User Profile Selector & Quick Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center gap-2.5 bg-amber-100/80 hover:bg-amber-200/60 text-amber-950 px-3 py-1.5 rounded-2xl border border-amber-300/60 transition-all text-right group"
            >
              <div className="w-8 h-8 rounded-full bg-amber-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                {isAdmin ? (
                  <ShieldCheck className="w-4 h-4" />
                ) : (
                  currentStudent?.fullName?.charAt(0) || 'ת'
                )}
              </div>
              <div className="hidden sm:block">
                <div className="text-xs font-bold leading-tight flex items-center gap-1">
                  {isAdmin ? 'צוות הנהלה' : currentStudent?.fullName}
                  <ChevronDown className="w-3.5 h-3.5 text-amber-700 group-hover:translate-y-0.5 transition-transform" />
                </div>
                <div className="text-[10px] text-amber-800/90 font-semibold">
                  {isAdmin ? 'הרשאות מלאות' : `כיתה ${currentStudent?.className}`}
                </div>
              </div>

              {!isAdmin && currentStudent && (
                <div className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-xs font-extrabold px-2 py-1 rounded-xl shadow-xs flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>{currentStudent.points} נק'</span>
                </div>
              )}
            </button>

            {/* Dropdown Menu for switching user / viewing student options */}
            {showUserDropdown && (
              <div className="absolute left-0 sm:right-auto mt-2 w-72 bg-white rounded-2xl shadow-xl border border-amber-200/80 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="px-3 py-2 border-b border-amber-100">
                  <p className="text-xs font-extrabold text-amber-900 uppercase tracking-wider">
                    החלף משתמש לבדיקה (דמו):
                  </p>
                  <p className="text-[11px] text-slate-800">
                    בחר תלמידה כדי לבחון את חוויית המשתמשת והניקוד:
                  </p>
                </div>

                <div className="max-h-60 overflow-y-auto py-1">
                  {students.map((student) => {
                    const isSelected = student.id === currentStudentId;
                    const isPending = student.status === 'pending';
                    return (
                      <button
                        key={student.id}
                        onClick={() => {
                          onSelectUser(student.id);
                          setShowUserDropdown(false);
                        }}
                        className={`w-full text-right px-3 py-2 text-xs flex items-center justify-between hover:bg-amber-50 transition-colors ${
                          isSelected ? 'bg-amber-100/80 font-bold text-amber-950' : 'text-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-amber-600" />
                          <div>
                            <span className="font-semibold">{student.fullName}</span>
                            <span className="text-amber-800 text-[10px] block">
                              כיתה {student.className} (שכבה {student.grade}')
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {isPending ? (
                            <span className="bg-amber-200 text-amber-900 text-[9px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              ממתינה
                            </span>
                          ) : (
                            <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                              {student.points} נק'
                            </span>
                          )}
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-600" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="border-t border-amber-100 pt-1 mt-1 px-1 space-y-1">
                  <button
                    onClick={() => {
                      onChangeTab('register');
                      setShowUserDropdown(false);
                    }}
                    className="w-full text-right px-3 py-2 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-amber-600" />
                      <span>אין לך משתמש? לחצי להרשמה</span>
                    </div>
                    <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">חדש</span>
                  </button>

                  <button
                    onClick={() => {
                      onSelectUser('admin');
                      setShowUserDropdown(false);
                    }}
                    className={`w-full text-right px-3 py-2 text-xs flex items-center justify-between hover:bg-amber-100/70 rounded-xl transition-colors ${
                      isAdmin ? 'bg-amber-200/80 font-bold text-amber-950' : 'text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-amber-700" />
                      <span className="font-bold">ממשק צוות ניהול האולפנה</span>
                    </div>
                    {isAdmin && <CheckCircle2 className="w-4 h-4 text-amber-700" />}
                  </button>

                  <button
                    onClick={handleReset}
                    disabled={isResetting}
                    className="w-full text-right px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded-xl transition-colors flex items-center gap-2 mt-1 font-semibold"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
                    <span>איפוס נתוני דמו (מחק חידונים והחזר ניקוד)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
