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
  LogOut,
} from 'lucide-react';
import { Student } from '../types';
import { SUPER_ADMIN_EMAIL } from '../lib/config';
import { ULPANA_LOGO_URL } from '../assets/logo';

interface NavbarProps {
  students: Student[];
  currentStudentId: string | 'admin';
  onSelectUser: (id: string | 'admin') => void;
  activeTab: 'study' | 'leaderboard' | 'register' | 'admin';
  onChangeTab: (tab: 'study' | 'leaderboard' | 'register' | 'admin') => void;
  onResetDemo: () => void;
  onLogout?: () => void;
  dailyDedication: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  students,
  currentStudentId,
  activeTab,
  onChangeTab,
  onResetDemo,
  onLogout,
  onSelectUser,
  dailyDedication,
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
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-amber-200/60 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          {!isAdmin && (
            <div className="w-full bg-gradient-to-r from-amber-700 via-yellow-500 to-amber-700 border-b border-amber-900/20 shadow-sm">
              <div className="mx-auto max-w-7xl px-3 py-2.5 text-center">
                <p className="font-black text-[11px] sm:text-sm md:text-base text-white tracking-wide leading-relaxed">
                  הלימוד מוקדש לעילוי נשמת מעוז פניגשטיין הי"ד
                </p>
              </div>
            </div>
          )}
          {dailyDedication && (
            <div className="w-full bg-gradient-to-r from-indigo-800 via-violet-700 to-indigo-800 border-b border-indigo-950/20 shadow-sm">
              <div className="mx-auto max-w-7xl px-3 py-2 text-center">
                <p className="font-bold text-[11px] sm:text-sm text-violet-100 leading-relaxed">
                  חידון היום מוקדש: {dailyDedication}
                </p>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between h-16 sm:h-18 gap-2">
            {/* Brand & Logo */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="h-10 sm:h-12 w-auto max-w-[110px] sm:max-w-[140px] shrink-0 flex items-center justify-center p-1 bg-white/90 rounded-xl border border-amber-200/80 shadow-xs">
                <img
                  src={ULPANA_LOGO_URL}
                  alt="לוגו אולפנא"
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                  className="max-h-8 sm:max-h-10 w-auto object-contain"
                  onError={(e) => {
                    // Fallback if blocked by external domain
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.parentElement?.querySelector('.logo-fallback');
                    if (fallback) (fallback as HTMLElement).style.display = 'flex';
                  }}
                />
                <div className="logo-fallback hidden w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-600 to-yellow-400 items-center justify-center text-amber-950 font-black">
                  <Crown className="w-4 h-4 text-amber-950" />
                </div>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <h1 className="text-base sm:text-xl font-extrabold text-amber-950 tracking-tight font-['Heebo'] truncate">
                    מבצע הלכה יומית
                  </h1>
                  <span className="hidden sm:inline-block bg-amber-100 text-amber-900 border border-amber-300/80 text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-bold shrink-0">
                    ספר "אהלי הלכה"
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-amber-800/80 font-medium hidden md:block truncate">
                  אולפנת אבן שמואל • לימוד יומי מתוך סדרת "אהלי הלכה"
                </p>
              </div>
            </div>

            {/* Navigation Tabs - Desktop (hidden on mobile, bottom nav used instead) */}
            <nav className="hidden md:flex items-center gap-1 sm:gap-2 bg-amber-50/80 p-1.5 rounded-2xl border border-amber-200/60">
              <button
                onClick={() => onChangeTab('study')}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl font-bold text-sm transition-all cursor-pointer ${
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
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl font-bold text-sm transition-all cursor-pointer ${
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
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                  activeTab === 'register'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                    : 'text-amber-900/80 hover:bg-amber-100/70 hover:text-amber-950'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span>הרשמה למערכת</span>
              </button>

              {isAdmin && (
                <button
                  onClick={() => onChangeTab('admin')}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                    activeTab === 'admin'
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                      : 'text-amber-900/80 hover:bg-amber-100/70 hover:text-amber-950'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  <span className="hidden md:inline">ממשק מנהל</span>
                  <span className="md:hidden">ניהול</span>
                </button>
              )}
            </nav>

            {/* User Profile Selector & Quick Switcher */}
            <div className="relative shrink-0">
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center gap-1.5 sm:gap-2.5 bg-amber-100/80 hover:bg-amber-200/60 text-amber-950 px-2 sm:px-3 py-1.5 rounded-2xl border border-amber-300/60 transition-all text-right group cursor-pointer"
                aria-label="תפריט משתמש"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-600 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                  {isAdmin ? (
                    <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  ) : (
                    currentStudent?.fullName?.charAt(0) || 'ת'
                  )}
                </div>
                <div className="hidden sm:block">
                  <div className="text-xs font-bold leading-tight flex items-center gap-1">
                    {isAdmin ? `מנהל: ${SUPER_ADMIN_EMAIL.split('@')[0]}` : currentStudent?.fullName}
                    <ChevronDown className="w-3.5 h-3.5 text-amber-700 group-hover:translate-y-0.5 transition-transform" />
                  </div>
                  <div className="text-[10px] text-amber-800/90 font-semibold">
                    {isAdmin ? `${SUPER_ADMIN_EMAIL} (מנהל ראשי)` : `כיתה ${currentStudent?.className}`}
                  </div>
                </div>

                {!isAdmin && currentStudent && (
                  <div className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-[11px] sm:text-xs font-extrabold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-xl shadow-xs flex items-center gap-1">
                    <Sparkles className="w-3 h-3 shrink-0" />
                    <span>{currentStudent.points} נק'</span>
                  </div>
                )}
                <ChevronDown className="w-3.5 h-3.5 text-amber-700 sm:hidden" />
              </button>

              {/* Backdrop for closing user dropdown on mobile */}
              {showUserDropdown && (
                <div
                  className="fixed inset-0 z-40 bg-black/20 sm:hidden"
                  onClick={() => setShowUserDropdown(false)}
                />
              )}

              {/* Dropdown Menu for viewing student options and disconnecting */}
              {showUserDropdown && (
                <div className="fixed sm:absolute left-2 right-2 sm:right-auto sm:left-0 top-16 sm:top-auto sm:mt-2 w-auto sm:w-72 max-w-[calc(100vw-1rem)] bg-white rounded-2xl shadow-2xl border border-amber-200/80 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-3 border-b border-amber-100 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-extrabold text-amber-900">
                        {isAdmin ? 'מנהל מערכת' : currentStudent?.fullName}
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                        {isAdmin ? SUPER_ADMIN_EMAIL : `כיתה ${currentStudent?.className} (שכבה ${currentStudent?.grade}')`}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowUserDropdown(false)}
                      className="text-xs text-slate-400 hover:text-slate-600 sm:hidden px-2 py-1"
                    >
                      סגור
                    </button>
                  </div>

                  <div className="p-1 space-y-1">
                    {isAdmin && (
                      <button
                        onClick={() => {
                          onChangeTab('admin');
                          setShowUserDropdown(false);
                        }}
                        className="w-full text-right px-3 py-2 text-xs flex items-center justify-between bg-amber-50 hover:bg-amber-100 font-bold text-amber-950 rounded-xl transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-amber-700" />
                          <span className="font-bold">ממשק צוות ניהול האולפנה</span>
                        </div>
                        <CheckCircle2 className="w-4 h-4 text-amber-700" />
                      </button>
                    )}

                    {onLogout && (
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          onLogout();
                        }}
                        className="w-full text-right px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-2"
                      >
                        <LogOut className="w-4 h-4 text-slate-500" />
                        <span>התנתקות מהמערכת</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar - Thumb-friendly, native app feel */}
      <nav
        aria-label="ניווט ראשי למובייל"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-amber-200/80 shadow-lg px-2 pt-2 pb-safe flex items-center justify-around"
      >
        <button
          onClick={() => onChangeTab('study')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all cursor-pointer ${
            activeTab === 'study'
              ? 'text-amber-700 font-extrabold bg-amber-50'
              : 'text-slate-500 font-medium hover:text-amber-900'
          }`}
        >
          <BookOpen
            className={`w-5 h-5 mb-0.5 transition-transform ${
              activeTab === 'study' ? 'text-amber-600 scale-110' : ''
            }`}
          />
          <span className="text-[11px] leading-tight">לימוד וחידון</span>
        </button>

        <button
          onClick={() => onChangeTab('leaderboard')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all cursor-pointer ${
            activeTab === 'leaderboard'
              ? 'text-amber-700 font-extrabold bg-amber-50'
              : 'text-slate-500 font-medium hover:text-amber-900'
          }`}
        >
          <Trophy
            className={`w-5 h-5 mb-0.5 transition-transform ${
              activeTab === 'leaderboard' ? 'text-amber-600 scale-110' : ''
            }`}
          />
          <span className="text-[11px] leading-tight">מובילים</span>
        </button>

        <button
          onClick={() => onChangeTab('register')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all cursor-pointer ${
            activeTab === 'register'
              ? 'text-amber-700 font-extrabold bg-amber-50'
              : 'text-slate-500 font-medium hover:text-amber-900'
          }`}
        >
          <UserPlus
            className={`w-5 h-5 mb-0.5 transition-transform ${
              activeTab === 'register' ? 'text-amber-600 scale-110' : ''
            }`}
          />
          <span className="text-[11px] leading-tight">הרשמה</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => onChangeTab('admin')}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all cursor-pointer ${
              activeTab === 'admin'
                ? 'text-amber-700 font-extrabold bg-amber-50'
                : 'text-slate-500 font-medium hover:text-amber-900'
            }`}
          >
            <Settings
              className={`w-5 h-5 mb-0.5 transition-transform ${
                activeTab === 'admin' ? 'text-amber-600 scale-110' : ''
              }`}
            />
            <span className="text-[11px] leading-tight">ניהול</span>
          </button>
        )}
      </nav>
    </>
  );
};
