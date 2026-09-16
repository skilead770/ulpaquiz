import React, { useState, useMemo } from 'react';
import {
  Crown,
  Sparkles,
  Mail,
  User,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  LogIn,
  UserPlus,
  AlertCircle,
  Clock,
  RefreshCw,
  HelpCircle,
  Check,
  GraduationCap,
  Lock,
} from 'lucide-react';
import { Student, DEFAULT_CLASSES } from '../types';
import { registerStudentApi, loginByEmailApi, checkStudentStatusApi, fetchClassesApi } from '../lib/api';
import { validateGmailAddress } from '../lib/gmailValidator';
import { signInWithGoogleSSO, verifyBackendToken } from '../lib/authService';
import { ULPANA_LOGO_URL } from '../assets/logo';

interface EntryScreenProps {
  onLoginSuccess: (student: Student | 'admin', token?: string) => void;
  students: Student[];
}

export const EntryScreen: React.FC<EntryScreenProps> = ({
  onLoginSuccess,
  students,
}) => {
  const [mode, setMode] = useState<'register' | 'login' | 'pending' | 'admin_login'>('register');

  // Simple registration fields: Full Name, GMAIL address, and Class from managed list
  const [fullName, setFullName] = useState('');
  const [gmail, setGmail] = useState('');
  const [classesList, setClassesList] = useState<string[]>(DEFAULT_CLASSES);
  const [selectedClass, setSelectedClass] = useState<string>(DEFAULT_CLASSES[0] || "ט'1");

  // Load available classes from server/Firestore
  React.useEffect(() => {
    fetchClassesApi().then((list) => {
      if (list && list.length > 0) {
        setClassesList(list);
        setSelectedClass((prev) => (list.includes(prev) ? prev : list[0]));
      }
    });
  }, []);

  // Login field
  const [loginEmail, setLoginEmail] = useState('');

  // Pending approval tracked student
  const [pendingStudent, setPendingStudent] = useState<{
    fullName: string;
    email: string;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [statusCheckMsg, setStatusCheckMsg] = useState<string | null>(null);

  // Real-time Gmail validation for the registration field
  const regGmailValidation = useMemo(() => {
    if (!gmail.trim()) return null;
    return validateGmailAddress(gmail);
  }, [gmail]);

  // Real-time Gmail validation for the login field
  const loginGmailValidation = useMemo(() => {
    if (!loginEmail.trim()) return null;
    return validateGmailAddress(loginEmail);
  }, [loginEmail]);

  // Helper to auto-complete @gmail.com
  const handleAutoCompleteDomain = (
    currentVal: string,
    setter: (val: string) => void
  ) => {
    const clean = currentVal.trim();
    if (!clean) return;
    if (clean.includes('@')) {
      const username = clean.split('@')[0];
      setter(`${username}@gmail.com`);
    } else {
      setter(`${clean}@gmail.com`);
    }
  };

  /**
   * Google SSO Handler (OAuth Sign In Popup)
   * Real, cryptographic Google authentication
   */
  const handleGoogleSSO = async (expectedRole?: 'admin' | 'any') => {
    setError(null);
    setSuccessMsg(null);
    setStatusCheckMsg(null);
    setIsGoogleLoading(true);

    try {
      const { user: firebaseUser } = await signInWithGoogleSSO();
      const idToken = await firebaseUser.getIdToken();
      const userEmail = (firebaseUser.email || '').trim().toLowerCase();

      // Verify token with backend server
      const verifyRes = await verifyBackendToken(idToken);

      if (verifyRes.role === 'admin') {
        setSuccessMsg(`שלום ${verifyRes.name || userEmail}! זוהית בהצלחה כמנהל/ת מאושר/ת.`);
        setTimeout(() => {
          onLoginSuccess('admin', idToken);
        }, 600);
        return;
      }

      if (expectedRole === 'admin') {
        setError(`החשבון ${userEmail} אינו מורשה כמנהל מערכת. רק מנהלים מורשים (כגון skilead770@gmail.com) יכולים לגשת לממשק הניהול.`);
        return;
      }

      if (verifyRes.role === 'student' && verifyRes.student) {
        setSuccessMsg(`שלום ${verifyRes.student.fullName}! זוהית בהצלחה באמצעות חשבון Google.`);
        setTimeout(() => {
          onLoginSuccess(verifyRes.student!, idToken);
        }, 500);
        return;
      }

      if (verifyRes.role === 'pending' || (verifyRes.student && verifyRes.student.status === 'pending')) {
        setPendingStudent({
          fullName: verifyRes.name || verifyRes.student?.fullName || '',
          email: userEmail,
        });
        setMode('pending');
        return;
      }

      if (verifyRes.role === 'unauthorized') {
        // Not registered yet! Pre-fill registration form
        setGmail(userEmail);
        if (firebaseUser.displayName) {
          setFullName(firebaseUser.displayName);
        }
        setMode('register');
        setError(`החשבון ${userEmail} אינו רשום עדיין. מלאי את פרטייך והירשמי למבצע.`);
        return;
      }

      throw new Error(verifyRes.error || 'אימות Google נכשל');
    } catch (err: any) {
      console.error('[Google SSO Error]', err);
      if (err.code === 'auth/popup-closed-by-user' || err.message?.includes('popup-closed')) {
        setError('חלון ההתחברות של Google נסגר. נא לנסות שוב.');
      } else if (err.code === 'auth/popup-blocked') {
        setError('הדפדפן חסם את חלון ההתחברות הקופץ של Google. אנא אפשרי חלונות קופצים (Popups) ורענני.');
      } else {
        setError(err.message || 'ההתחברות באמצעות Google נכשלה');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setStatusCheckMsg(null);

    if (!fullName.trim()) {
      setError('נא למלא שם מלא');
      return;
    }

    if (!selectedClass.trim()) {
      setError('נא לבחור כיתה מתוך הרשימה');
      return;
    }

    const validation = validateGmailAddress(gmail);
    if (!validation.isValid || !validation.normalizedEmail) {
      setError(validation.error || 'נא להזין כתובת Gmail תקינה');
      return;
    }

    setIsLoading(true);
    try {
      const res = await registerStudentApi({
        fullName: fullName.trim(),
        email: validation.normalizedEmail,
        className: selectedClass.trim(),
      });

      // Check if this is a manager
      if (res.isManager || validation.normalizedEmail.toLowerCase() === 'skilead770@gmail.com') {
        setSuccessMsg(`שלום מנהל המערכת! כתובת זו (${validation.normalizedEmail}) מוגדרת כמנהל. עליך להתחבר עם Google SSO המאובטח.`);
        setMode('admin_login');
        return;
      }

      // Crucial requirement: Student does NOT enter immediately!
      // Must wait for admin approval.
      if (res.status === 'approved' && res.student) {
        // Was already approved previously
        setSuccessMsg('שלום שוב! הרשמתך כבר מאושרת במערכת. מתחברים...');
        setTimeout(() => {
          onLoginSuccess(res.student!);
        }, 700);
      } else {
        // Pending approval screen
        setPendingStudent({
          fullName: fullName.trim(),
          email: validation.normalizedEmail,
        });
        setMode('pending');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'שגיאה ברישום למערכת. נא לנסות שוב.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setStatusCheckMsg(null);

    const validation = validateGmailAddress(loginEmail);
    if (!validation.isValid || !validation.normalizedEmail) {
      setError(validation.error || 'נא להזין כתובת Gmail תקינה');
      return;
    }

    // Direct managers to secure SSO
    if (validation.normalizedEmail.toLowerCase() === 'skilead770@gmail.com') {
      setMode('admin_login');
      setError('ממשק המנהל מאובטח ודורש זיהוי Google SSO מלא. לחצי על כפתור ההתחברות המאובטח להלן.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await loginByEmailApi(validation.normalizedEmail);
      if (res.isManager) {
        setMode('admin_login');
        setError('ממשק המנהל מאובטח ודורש זיהוי Google SSO מלא.');
        return;
      }
      if (res.student) {
        setSuccessMsg(`שלום ${res.student.fullName}! מתחברים למערכת...`);
        setTimeout(() => {
          onLoginSuccess(res.student!);
        }, 500);
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err.message || '';
      if (errMsg.includes('ממתינה לאישור')) {
        // Transition to pending state with informative screen
        setPendingStudent({
          fullName: '',
          email: validation.normalizedEmail,
        });
        setMode('pending');
      } else {
        setError(errMsg || 'לא נמצאה תלמידה עם כתובת זו. האם נרשמת בעבר?');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Check approval status in real-time
  const handleCheckPendingStatus = async () => {
    if (!pendingStudent?.email) return;
    setIsCheckingStatus(true);
    setStatusCheckMsg(null);
    try {
      const res = await checkStudentStatusApi(pendingStudent.email);
      if (res.registered && res.status === 'approved' && res.student) {
        setStatusCheckMsg('מזל טוב! הרשמתך אושרה על ידי המנהל! מתחברים...');
        setTimeout(() => {
          onLoginSuccess(res.student!);
        }, 800);
      } else if (res.registered && res.status === 'rejected') {
        setStatusCheckMsg('בקשת ההרשמה נדחתה. נא לפנות להנהלת האולפנה לבירור.');
      } else {
        setStatusCheckMsg('הבקשה עדיין ממתינה לאישור מנהל האולפנה. נסי לבדוק שוב בעוד מספר רגעים.');
      }
    } catch (e) {
      setStatusCheckMsg('לא ניתן לבדוק סטטוס כעת. נסי שוב מאוחר יותר.');
    } finally {
      setIsCheckingStatus(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/70 via-white to-amber-100/40 flex flex-col justify-center items-center p-4 sm:p-6 font-['Assistant',sans-serif]">
      {/* Main Card */}
      <div className="w-full max-w-lg bg-white rounded-3xl border border-amber-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-amber-800 via-amber-700 to-amber-900 text-white p-6 sm:p-8 text-center relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-yellow-400/20 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-amber-400/10 rounded-full blur-xl pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center space-y-3">
            <div className="flex items-center justify-center gap-3">
              <div className="h-16 px-3 bg-white/95 backdrop-blur-sm border border-amber-300/60 rounded-2xl shadow-lg flex items-center justify-center">
                <img
                  src={ULPANA_LOGO_URL}
                  alt="לוגו אולפנא"
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                  className="max-h-12 w-auto object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.parentElement?.querySelector('.logo-fallback');
                    if (fallback) (fallback as HTMLElement).style.display = 'flex';
                  }}
                />
                <div className="logo-fallback hidden w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-yellow-400 items-center justify-center text-amber-950">
                  <Crown className="w-6 h-6 text-amber-950" />
                </div>
              </div>
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 bg-amber-600/40 border border-amber-300/30 text-amber-200 text-xs px-3 py-1 rounded-full font-bold mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>חידון הלכה יומית באולפנה • תשפ"ז</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-['Heebo']">
                ספר "אהלי הלכה"
              </h1>
              <p className="text-xs sm:text-sm text-amber-200/90 font-medium mt-1">
                לימוד יומי קצר, חידון חוויתי וצבירת נקודות לפרסים יקרי ערך
              </p>
            </div>
          </div>
        </div>

        {/* Tabs: Hidden in Pending Approval mode */}
        {mode !== 'pending' && (
          <div className="flex border-b border-amber-200/80 bg-amber-50/50 p-1.5">
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-3 px-3 rounded-2xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-1.5 ${
                mode === 'register'
                  ? 'bg-white text-amber-950 shadow-sm border border-amber-200/70'
                  : 'text-amber-900/70 hover:text-amber-950'
              }`}
            >
              <UserPlus className="w-4 h-4 text-amber-600" />
              <span>הרשמה חדשה</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-3 px-3 rounded-2xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-1.5 ${
                mode === 'login'
                  ? 'bg-white text-amber-950 shadow-sm border border-amber-200/70'
                  : 'text-amber-900/70 hover:text-amber-950'
              }`}
            >
              <LogIn className="w-4 h-4 text-amber-600" />
              <span>כניסת תלמידה</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('admin_login');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-3 px-3 rounded-2xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-1.5 ${
                mode === 'admin_login'
                  ? 'bg-white text-amber-950 shadow-sm border border-amber-200/70'
                  : 'text-amber-900/70 hover:text-amber-950'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>כניסת מנהל</span>
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-5">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-start gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ====================================================
              MODE: PENDING APPROVAL (STUDENT MUST WAIT FOR ADMIN)
          ==================================================== */}
          {mode === 'pending' && (
            <div className="space-y-6 text-center animate-in fade-in zoom-in-95">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto text-amber-700 shadow-inner">
                <Clock className="w-8 h-8 animate-pulse" />
              </div>

              <div className="space-y-2">
                <span className="inline-block px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-xs font-extrabold">
                  ⏳ ההרשמה נקלטה בהצלחה
                </span>
                <h2 className="text-xl font-extrabold text-amber-950 font-['Heebo']">
                  ממתינה לאישור מנהל האולפנה
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">
                  שלום {pendingStudent?.fullName || 'יקרה'}! פרטייך נקלטו במערכת. מטעמי סדר ואבטחה, כל תלמידה ממתינה לאישור קצר של הנהלת המבצע.
                </p>
              </div>

              {pendingStudent?.email && (
                <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl text-xs text-amber-900">
                  <span className="font-bold">כתובת ה-Gmail שלך: </span>
                  <span className="font-mono font-bold dir-ltr">{pendingStudent.email}</span>
                </div>
              )}

              {statusCheckMsg && (
                <div className="p-3 rounded-xl bg-amber-100/70 border border-amber-300 text-amber-950 text-xs font-bold animate-in fade-in">
                  {statusCheckMsg}
                </div>
              )}

              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={handleCheckPendingStatus}
                  disabled={isCheckingStatus}
                  className="w-full py-3.5 px-6 rounded-2xl font-extrabold text-sm text-white bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${isCheckingStatus ? 'animate-spin' : ''}`} />
                  <span>{isCheckingStatus ? 'בודק סטטוס...' : 'בדקי אם המנהל כבר אישר אותך'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setPendingStudent(null);
                    setError(null);
                    setStatusCheckMsg(null);
                  }}
                  className="w-full py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:underline"
                >
                  חזרה למסך כניסה
                </button>
              </div>
            </div>
          )}

          {/* ====================================================
              MODE 1: FIRST-TIME REGISTRATION (NAME + GMAIL)
          ==================================================== */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-5">
              <div className="text-center pb-1">
                <h2 className="text-base sm:text-lg font-extrabold text-amber-950 font-['Heebo']">
                  הצטרפות פשוטה למבצע
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  הזיני שם מלא, בחרי כיתה וכתובת Gmail. לאחר אישור קצר של המנהל תוכלי להתחיל!
                </p>
              </div>

              {/* Full Name Field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-amber-700" />
                  <span>שם מלא</span>
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="לדוגמה: תהילה לוי"
                  className="w-full p-3 rounded-2xl border border-amber-300/80 bg-white text-sm font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden transition-all shadow-xs"
                />
              </div>

              {/* Class Selection Field - Dropdown from managed list */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-amber-700" />
                  <span>בחירת כיתה</span>
                  <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    required
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="w-full p-3 pl-9 rounded-2xl border border-amber-300/80 bg-white text-sm font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden transition-all shadow-xs cursor-pointer appearance-none"
                  >
                    {classesList.map((c) => (
                      <option key={c} value={c}>
                        כיתה {c}
                      </option>
                    ))}
                  </select>
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-amber-700 text-xs font-bold">
                    ▼
                  </div>
                </div>
              </div>

              {/* GMAIL Field with Strict Verification Indicator */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-amber-700" />
                    <span>כתובת GMAIL מדויקת</span>
                    <span className="text-rose-500">*</span>
                  </label>

                  {/* Auto-complete button if user typed username without @ */}
                  {gmail.trim() && !gmail.includes('@') && (
                    <button
                      type="button"
                      onClick={() => handleAutoCompleteDomain(gmail, setGmail)}
                      className="text-[11px] font-bold text-amber-800 hover:text-amber-950 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                    >
                      + הוסף @gmail.com
                    </button>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    required
                    dir="ltr"
                    value={gmail}
                    onChange={(e) => setGmail(e.target.value)}
                    placeholder="example@gmail.com"
                    className={`w-full p-3 pl-9 rounded-2xl border text-sm font-bold text-slate-800 font-mono focus:ring-2 focus:outline-hidden transition-all shadow-xs text-left ${
                      regGmailValidation === null
                        ? 'border-amber-300/80 focus:ring-amber-500'
                        : regGmailValidation.isValid
                        ? 'border-emerald-400 bg-emerald-50/20 focus:ring-emerald-500 text-emerald-950'
                        : 'border-rose-300 bg-rose-50/20 focus:ring-rose-400'
                    }`}
                  />
                  {regGmailValidation?.isValid && (
                    <div className="absolute left-3 top-3.5 text-emerald-600">
                      <Check className="w-4 h-4" />
                    </div>
                  )}
                </div>

                {/* Real-time Gmail validation status */}
                {regGmailValidation && (
                  <div className="text-[11px] font-bold">
                    {regGmailValidation.isValid ? (
                      <span className="text-emerald-700 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>כתובת Gmail תקינה לפי כללי Google</span>
                      </span>
                    ) : (
                      <span className="text-rose-600 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{regGmailValidation.error}</span>
                      </span>
                    )}
                  </div>
                )}

                <p className="text-[11px] text-slate-500">
                  ודאי שהמייל מסתיים ב-<strong>@gmail.com</strong> ומכיל בין 6 ל-30 תווים באנגלית או ספרות בלבד.
                </p>
              </div>

              {/* Google SSO Button for Registration */}
              <div className="pt-2">
                <div className="relative flex py-2 items-center">
                  <div className="grow border-t border-amber-200"></div>
                  <span className="shrink mx-3 text-[11px] font-bold text-amber-800/80 bg-white px-2">
                    או הרשמה חכמה בלחיצה אחת
                  </span>
                  <div className="grow border-t border-amber-200"></div>
                </div>

                <button
                  type="button"
                  onClick={() => handleGoogleSSO('any')}
                  disabled={isGoogleLoading || isLoading}
                  className="w-full py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 shadow-xs flex items-center justify-center gap-3 transition-all active:scale-[0.98] cursor-pointer"
                >
                  {isGoogleLoading ? (
                    <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                  )}
                  <span>התחברות ישירה עם חשבון Google (SSO)</span>
                </button>
              </div>

              {/* Submit CTA Button */}
              <button
                type="submit"
                disabled={isLoading || isGoogleLoading}
                className="w-full py-3.5 px-6 rounded-2xl font-extrabold text-sm sm:text-base text-white bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 shadow-lg shadow-amber-600/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>שליחת בקשת הרשמה לאישור המנהל</span>
                    <ArrowLeft className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/60 text-[11px] text-amber-900 leading-relaxed flex items-start gap-1.5">
                <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>
                  <strong>לתשומת ליבך:</strong> לאחר שליחת הטופס, הרשמתך תועבר לאישור הנהלת האולפנה. תוכלי להתחבר מיד כשהמנהל יאשר את הבקשה.
                </span>
              </div>
            </form>
          )}

          {/* ====================================================
              MODE 2: RETURNING STUDENT LOGIN (BY GMAIL)
          ==================================================== */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <div className="text-center pb-1">
                <h2 className="text-base sm:text-lg font-extrabold text-amber-950 font-['Heebo']">
                  שלום שוב! כניסה לתלמידה רשומה
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  התחברי ישירות עם חשבון ה-Google שלך או הזיני כתובת Gmail
                </p>
              </div>

              {/* Google SSO Button for Returning Student Login */}
              <button
                type="button"
                onClick={() => handleGoogleSSO('any')}
                disabled={isGoogleLoading || isLoading}
                className="w-full py-3.5 px-4 rounded-2xl font-bold text-xs sm:text-sm text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 shadow-xs flex items-center justify-center gap-3 transition-all active:scale-[0.98] cursor-pointer"
              >
                {isGoogleLoading ? (
                  <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                <span>כניסה מהירה עם Google (SSO)</span>
              </button>

              <div className="relative flex py-1 items-center">
                <div className="grow border-t border-amber-200"></div>
                <span className="shrink mx-3 text-[11px] font-bold text-amber-800/80 bg-white px-2">
                  או כניסה לפי כתובת GMAIL
                </span>
                <div className="grow border-t border-amber-200"></div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-amber-700" />
                    <span>כתובת ה-GMAIL שלך</span>
                    <span className="text-rose-500">*</span>
                  </label>

                  {loginEmail.trim() && !loginEmail.includes('@') && (
                    <button
                      type="button"
                      onClick={() => handleAutoCompleteDomain(loginEmail, setLoginEmail)}
                      className="text-[11px] font-bold text-amber-800 hover:text-amber-950 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                    >
                      + הוסף @gmail.com
                    </button>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    required
                    dir="ltr"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="yourname@gmail.com"
                    className={`w-full p-3 pl-9 rounded-2xl border text-sm font-bold text-slate-800 font-mono focus:ring-2 focus:outline-hidden transition-all shadow-xs text-left ${
                      loginGmailValidation === null
                        ? 'border-amber-300/80 focus:ring-amber-500'
                        : loginGmailValidation.isValid
                        ? 'border-emerald-400 bg-emerald-50/20 focus:ring-emerald-500 text-emerald-950'
                        : 'border-rose-300 bg-rose-50/20 focus:ring-rose-400'
                    }`}
                  />
                  {loginGmailValidation?.isValid && (
                    <div className="absolute left-3 top-3.5 text-emerald-600">
                      <Check className="w-4 h-4" />
                    </div>
                  )}
                </div>

                {loginGmailValidation && !loginGmailValidation.isValid && (
                  <p className="text-[11px] text-rose-600 font-bold">
                    {loginGmailValidation.error}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-6 rounded-2xl font-extrabold text-sm sm:text-base text-white bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 shadow-lg shadow-amber-600/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>כניסה ללימוד היומי</span>
                  </>
                )}
              </button>

              {/* Sample test students */}
              {students && students.length > 0 && (
                <div className="pt-3 border-t border-amber-100">
                  <p className="text-[11px] font-extrabold text-amber-900 mb-2 text-center">
                    תלמידות מאושרות לדוגמה (לבדיקה בלחיצה):
                  </p>
                  <div className="flex flex-wrap gap-1.5 justify-center max-h-24 overflow-y-auto p-1">
                    {students
                      .filter((st) => st.status === 'approved')
                      .slice(0, 5)
                      .map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => {
                            const eMail = st.email || `${st.username}@gmail.com`;
                            setLoginEmail(eMail);
                            onLoginSuccess(st);
                          }}
                          className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 transition-colors"
                        >
                          {st.fullName} ({st.className})
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </form>
          )}

          {/* ====================================================
              MODE 3: MANAGER / ADMIN SECURE LOGIN (GOOGLE SSO)
          ==================================================== */}
          {mode === 'admin_login' && (
            <div className="space-y-6 text-center animate-in fade-in zoom-in-95 py-2">
              <div className="w-16 h-16 bg-gradient-to-tr from-amber-700 to-amber-900 rounded-2xl flex items-center justify-center mx-auto text-amber-200 shadow-lg border border-amber-500/30">
                <Lock className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <span className="inline-block px-3 py-1 bg-amber-100 text-amber-950 border border-amber-300 rounded-full text-xs font-black">
                  🔐 אזור ניהול מאובטח • כניסת מנהלים בלבד
                </span>
                <h2 className="text-xl font-extrabold text-amber-950 font-['Heebo']">
                  התחברות מנהל באמצעות Google SSO
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">
                  הגישה לממשק הניהול מוגנת ודורשת אימות זהות מאובטח של Google. רק מנהלים מורשים (כגון skilead770@gmail.com) רשאים להיכנס.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => handleGoogleSSO('admin')}
                  disabled={isGoogleLoading}
                  className="w-full py-4 px-6 rounded-2xl font-extrabold text-sm sm:text-base text-white bg-gradient-to-r from-amber-700 via-amber-800 to-amber-900 hover:from-amber-800 hover:to-amber-950 shadow-xl shadow-amber-900/30 flex items-center justify-center gap-3 transition-all active:scale-[0.98] cursor-pointer"
                >
                  {isGoogleLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <svg className="w-5 h-5 shrink-0 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                      <span>אימות וכניסה עם חשבון Google מנהל</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 leading-relaxed text-right flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>
                  <strong>אבטחה מוגברת:</strong> המערכת מאמתת את החתימה הדיגיטלית של חשבון ה-Google מול שרתי Google ומוודאת הרשאת ניהול לפני מתן גישה.
                </span>
              </div>
            </div>
          )}

          {/* Staff / Admin Entry Link */}
          <div className="pt-4 border-t border-amber-100/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600 bg-amber-50/50 -mx-6 -mb-6 sm:-mx-8 sm:-mb-8 p-4 rounded-b-3xl border-t border-amber-200/60">
            <div className="flex items-center gap-1.5 text-amber-900 font-semibold">
              <ShieldCheck className="w-4 h-4 text-amber-700" />
              <span>מנהל/ת מערכת או צוות?</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode('admin_login');
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="font-bold text-xs text-white bg-amber-700 hover:bg-amber-800 px-3.5 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>כניסה מאובטחת למנהל (Google SSO)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center mt-6 text-xs text-amber-900/70 font-medium space-y-1">
        <p>אולפנת בני עקיבא • מבצע לימוד יומי מתוך סדרת "אהלי הלכה"</p>
        <p className="text-[11px] text-amber-800/60">תשפ"ז • על פי פסקי הלכה של הגאון הרב יעקב אריאל שליט"א</p>
      </div>
    </div>
  );
};
