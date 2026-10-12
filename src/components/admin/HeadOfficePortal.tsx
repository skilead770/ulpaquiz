import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Crown,
  ShieldCheck,
  LogOut,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  Users,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  LogIn,
  Layers,
  ChevronRight,
  School as SchoolIcon,
} from 'lucide-react';
import { useTenant } from '../../context/SchoolContext';
import { SUPER_ADMIN_EMAIL } from '../../lib/config';
import { auth } from '../../lib/firebaseClient';
import { signInWithGoogleSSO, signOutSSO, validateSecureGoogleGmail } from '../../lib/authService';
import { SchoolsManagerTab } from './SchoolsManagerTab';
import { School } from '../../types/tenant';

interface HeadOfficePortalProps {
  onExitPortal: () => void;
  onLaunchSchool: (schoolId: string) => void;
}

export const HeadOfficePortal: React.FC<HeadOfficePortalProps> = ({
  onExitPortal,
  onLaunchSchool,
}) => {
  const {
    availableSchools,
    currentSchoolId,
    setSchoolId,
    syncAllManagers,
    refreshSchools,
  } = useTenant();

  const [currentUser, setCurrentUser] = useState(() => auth.currentUser);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Listen to auth changes
  useEffect(() => {
    return auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
  }, []);

  const isSuperAdminLoggedIn = useMemo(() => {
    if (!currentUser?.email) return false;
    return currentUser.email.trim().toLowerCase() === SUPER_ADMIN_EMAIL.trim().toLowerCase();
  }, [currentUser]);

  // Google SSO Login specifically for Head Office
  const handleHeadOfficeLogin = async () => {
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      const { user } = await signInWithGoogleSSO();
      const secureCheck = validateSecureGoogleGmail(user);
      if (!secureCheck.isValid || !secureCheck.normalizedEmail) {
        setLoginError(secureCheck.error || 'כניסה מאובטחת דורשת חשבון Google מאומת');
        await signOutSSO();
        return;
      }

      if (secureCheck.normalizedEmail !== SUPER_ADMIN_EMAIL.toLowerCase()) {
        setLoginError(`החשבון ${secureCheck.normalizedEmail} אינו מורשה לכניסת מטה ראשי. פורטל זה מיועד למנהל הרשת הראשי (${SUPER_ADMIN_EMAIL}) בלבד.`);
        await signOutSSO();
        return;
      }

      // Automatically sync managers upon successful login
      try {
        await syncAllManagers();
      } catch (err) {
        console.warn('Initial manager sync notice:', err);
      }
    } catch (err: any) {
      console.error('Head office login error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setLoginError('חלון ההתחברות של Google נסגר.');
      } else {
        setLoginError(err.message || 'שגיאה בהתחברות ל-Google');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await signOutSSO();
  };

  const handleSyncManagers = async () => {
    try {
      setIsSyncing(true);
      const count = await syncAllManagers();
      setSyncFeedback(`סונכרנו בהצלחה ${count} מנהלים לכלל המוסדות ב-Firestore!`);
      setTimeout(() => setSyncFeedback(null), 5000);
    } catch (err) {
      console.error('Failed to sync managers:', err);
      alert('שגיאה בסנכרון מנהלים');
    } finally {
      setIsSyncing(false);
    }
  };

  // High-level network KPIs
  const stats = useMemo(() => {
    const totalSchools = availableSchools.length;
    const activeSchools = availableSchools.filter((s) => s.isActive !== false).length;
    const girlsSchools = availableSchools.filter((s) => s.type === 'girls').length;
    const boysSchools = availableSchools.filter((s) => s.type === 'boys').length;

    const uniqueManagerEmails = new Set<string>();
    for (const sc of availableSchools) {
      for (const em of sc.adminEmails || []) {
        if (em) uniqueManagerEmails.add(em.trim().toLowerCase());
      }
    }

    return {
      totalSchools,
      activeSchools,
      girlsSchools,
      boysSchools,
      totalManagers: uniqueManagerEmails.size,
    };
  }, [availableSchools]);

  // =========================================================================
  // STATE 1: UN-AUTHENTICATED OR NOT SUPER ADMIN
  // =========================================================================
  if (!isSuperAdminLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100 flex flex-col justify-between font-['Heebo'] p-4 sm:p-6 md:p-8" dir="rtl">
        {/* Top bar */}
        <div className="max-w-6xl w-full mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-black text-sm tracking-wide text-white block">מטה ראשי | Head Office</span>
              <span className="text-[11px] font-bold text-amber-400 block">רשת הישיבות והאולפנות</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onExitPortal}
            className="px-4 py-2 bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-white/10 cursor-pointer"
          >
            <span>חזרה לאפליקציית בית הספר</span>
            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
          </button>
        </div>

        {/* Center Card */}
        <div className="max-w-md w-full mx-auto my-12 bg-slate-900/80 backdrop-blur-xl border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="text-center relative z-10 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center shadow-xl shadow-amber-500/20">
              <Crown className="w-8 h-8" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-black mb-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>פורטל מנהל רשת בלבד</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">כניסת מטה ראשי</h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
                גישה בלעדית למנהל הרשת הראשי להקמת מוסדות, סנכרון מנהלים והגדרות מערכת גלובליות.
              </p>
            </div>

            {loginError && (
              <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-2xl text-rose-300 text-xs font-bold flex items-start gap-2.5 text-right">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{loginError}</span>
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={handleHeadOfficeLogin}
                disabled={isLoggingIn}
                className="w-full py-3.5 px-5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-sm rounded-2xl shadow-lg shadow-amber-500/20 hover:shadow-xl transition-all flex items-center justify-center gap-3 cursor-pointer transform active:scale-95 disabled:opacity-50"
              >
                <LogIn className="w-5 h-5 text-slate-950" />
                <span>{isLoggingIn ? 'מתחבר למערכת...' : 'התחברות באמצעות Google'}</span>
              </button>
            </div>

            <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-500/60" />
              <span>גישה מאומתת ומבוקרת לחשבון {SUPER_ADMIN_EMAIL}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="max-w-6xl w-full mx-auto text-center text-xs text-slate-500">
          <span>אולפה-קוויז רב-מוסדי &copy; 2026 | מטה ראשי ומערך ניהול מוסדות</span>
        </div>
      </div>
    );
  }

  // =========================================================================
  // STATE 2: AUTHENTICATED SUPER ADMIN HEAD OFFICE PORTAL
  // =========================================================================
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-['Heebo'] flex flex-col" dir="rtl">
      {/* Top Executive Header */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-amber-500/20 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/20 shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-black text-base sm:text-lg text-white tracking-wide truncate">
                  מטה ראשי | Head Office
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-black shrink-0">
                  Super Admin
                </span>
              </div>
              <span className="text-xs font-bold text-slate-400 block truncate">
                ניהול מוסדות, מנהלים ומיתוג רוחבי
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Sync Managers */}
            <button
              type="button"
              onClick={handleSyncManagers}
              disabled={isSyncing}
              title="סנכרן את כל מנהלי המוסדות לקולקציית managers ב-Firestore"
              className="px-3.5 py-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <ShieldCheck className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isSyncing ? 'מסנכרן...' : 'סנכרן מנהלים'}</span>
            </button>

            {/* Launch / Return to School App */}
            <button
              type="button"
              onClick={onExitPortal}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/15 border border-white/15 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>חזרה לאפליקציה</span>
              <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            </button>

            {/* Logout */}
            <button
              type="button"
              onClick={handleLogout}
              title="התנתק ממטה ראשי"
              className="p-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-xl transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
        {/* Sync Feedback Banner */}
        {syncFeedback && (
          <div className="p-4 bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 text-xs sm:text-sm font-bold rounded-2xl flex items-center gap-3 shadow-lg">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{syncFeedback}</span>
          </div>
        )}

        {/* Executive Overview Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-amber-500/25 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-black">
                <Crown className="w-3.5 h-3.5" />
                <span>מרכז שליטה ובקרה ראשי</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                רשת הישיבות והאולפנות
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                מפורטל זה תוכל להקים מוסדות חדשים, להגדיר מיתוג וסמלי מוסד בקבצי תמונה ישירים,
                להוסיף כיתות ומנהלים, ולעבור בלחיצה אחת לניהול כל מוסד באפליקציה.
              </p>
            </div>

            {/* Logged in admin card */}
            <div className="bg-black/30 border border-white/10 rounded-2xl p-4 flex items-center gap-3.5 backdrop-blur-xs self-start md:self-auto shrink-0">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center font-black">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 block">מחובר כסופר-אדמין:</span>
                <span className="text-xs sm:text-sm font-black text-white font-mono block">{currentUser?.email}</span>
              </div>
            </div>
          </div>

          {/* KPI Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 mt-6 pt-6 border-t border-white/10">
            <div className="bg-black/20 p-3.5 rounded-2xl border border-white/10">
              <span className="text-[11px] font-bold text-amber-300 block">סה״כ מוסדות</span>
              <span className="text-2xl font-black text-white">{stats.totalSchools}</span>
            </div>
            <div className="bg-black/20 p-3.5 rounded-2xl border border-white/10">
              <span className="text-[11px] font-bold text-emerald-300 block">מוסדות פעילים</span>
              <span className="text-2xl font-black text-emerald-400">{stats.activeSchools}</span>
            </div>
            <div className="bg-black/20 p-3.5 rounded-2xl border border-white/10">
              <span className="text-[11px] font-bold text-rose-300 block">אולפנות (בנות)</span>
              <span className="text-2xl font-black text-rose-300">{stats.girlsSchools}</span>
            </div>
            <div className="bg-black/20 p-3.5 rounded-2xl border border-white/10">
              <span className="text-[11px] font-bold text-sky-300 block">ישיבות (בנים)</span>
              <span className="text-2xl font-black text-sky-300">{stats.boysSchools}</span>
            </div>
            <div className="bg-black/20 p-3.5 rounded-2xl border border-white/10 col-span-2 sm:col-span-1">
              <span className="text-[11px] font-bold text-indigo-300 block">מנהלים מורשים</span>
              <span className="text-2xl font-black text-indigo-300">{stats.totalManagers}</span>
            </div>
          </div>
        </div>

        {/* Institution Quick Launchpad */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-400" />
              <span>כניסה מהירה לאפליקציה כמנהל מוסד</span>
            </h3>
            <span className="text-xs font-bold text-slate-400">
              בחר מוסד כדי לעבור אליו ישירות כמנהל מערכת
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {availableSchools.map((school) => {
              const isCurrent = school.id === currentSchoolId;
              return (
                <div
                  key={school.id}
                  className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    isCurrent
                      ? 'bg-amber-500/10 border-amber-500/40'
                      : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shrink-0 overflow-hidden p-1 border border-white/10"
                      style={{ backgroundColor: school.branding?.primaryColor || '#d97706' }}
                    >
                      {school.branding?.logoUrl ? (
                        <img
                          src={school.branding.logoUrl}
                          alt={school.name}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <span className="text-xs">{school.name.slice(0, 2)}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs sm:text-sm font-black text-white block truncate">
                        {school.name}
                      </span>
                      <span className="text-[11px] font-bold text-slate-400 block">
                        {school.type === 'girls' ? 'אולפנה (בנות)' : 'ישיבה (בנים)'} &bull; {school.classes?.length || 0} כיתות
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSchoolId(school.id);
                      onLaunchSchool(school.id);
                    }}
                    className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer"
                  >
                    <span>היכנס למוסד</span>
                    <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Embedded Full Schools Manager Hub */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
          <SchoolsManagerTab
            onSwitchSchool={(schoolId) => {
              setSchoolId(schoolId);
              onLaunchSchool(schoolId);
            }}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/80 py-6 text-center text-xs text-slate-500">
        <span>מערכת חידון הלכה יומית &copy; 2026 | מטה ראשי מאובטח</span>
      </footer>
    </div>
  );
};
