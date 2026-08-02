import React, { useState, useEffect } from 'react';
import { UserPlus, CheckCircle2, Clock, ShieldAlert, Sparkles, BookOpen, ArrowRight, Key, Check } from 'lucide-react';
import { GradeType, Student } from '../types';
import { registerStudentApi, validateInvitationCodeApi } from '../lib/api';

interface RegisterPageProps {
  onRegistrationSuccess: () => void;
  onGoToStudy: () => void;
  students: Student[];
}

export const RegisterPage: React.FC<RegisterPageProps> = ({
  onRegistrationSuccess,
  onGoToStudy,
  students,
}) => {
  const [fullName, setFullName] = useState('');
  const [grade, setGrade] = useState<GradeType>('ט');
  const [className, setClassName] = useState("ט'1");
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('123');
  const [invitationCode, setInvitationCode] = useState('');
  const [invitationValidInfo, setInvitationValidInfo] = useState<{
    valid: boolean;
    className?: string;
    grade?: GradeType;
    message?: string;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registeredStudent, setRegisteredStudent] = useState<Student | null>(null);
  const [isAutoApprovedResult, setIsAutoApprovedResult] = useState(false);

  // Read invite query param from URL if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteParam = params.get('invite') || params.get('code');
    if (inviteParam) {
      setInvitationCode(inviteParam.toUpperCase());
      checkInviteCode(inviteParam.toUpperCase());
    }
  }, []);

  const checkInviteCode = async (code: string) => {
    if (!code.trim()) {
      setInvitationValidInfo(null);
      return;
    }
    try {
      const res = await validateInvitationCodeApi(code.trim());
      if (res.valid && res.invitation) {
        setInvitationValidInfo({
          valid: true,
          className: res.invitation.className,
          grade: res.invitation.grade,
          message: 'קוד הזמנה תקין! הרשמתך תאושר אוטומטית ללא ממתין.',
        });
        if (res.invitation.className && res.invitation.className !== 'כללית') {
          setClassName(res.invitation.className);
        }
        if (res.invitation.grade) {
          setGrade(res.invitation.grade);
        }
      } else {
        setInvitationValidInfo({
          valid: false,
          message: res.error || 'קוד הזמנה אינו בתוקף',
        });
      }
    } catch (e) {
      setInvitationValidInfo(null);
    }
  };

  // Status Check State
  const [checkUsername, setCheckUsername] = useState('');
  const [checkResult, setCheckResult] = useState<{
    found: boolean;
    student?: Student;
    message?: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !className.trim() || !username.trim()) {
      setError('נא למלא את כל שדות החובה המסומנים בכוכבית');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await registerStudentApi({
        fullName: fullName.trim(),
        grade,
        className: className.trim(),
        username: username.trim(),
        password: password.trim() || '123',
        invitationCode: invitationCode.trim() || undefined,
      });

      setRegisteredStudent(res.student);
      setIsAutoApprovedResult(!!res.autoApproved);
      onRegistrationSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'אירעה שגיאה בעת ההרשמה, נא לנסות שנית');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkUsername.trim()) return;

    const term = checkUsername.trim().toLowerCase();
    const found = students.find(
      (s) => s.username.toLowerCase() === term || s.fullName.toLowerCase().includes(term)
    );

    if (found) {
      const status = found.status || 'approved';
      let msg = '';
      if (status === 'approved') {
        msg = 'ההרשמה שלך אושרה בהצלחה! תוכל להיכנס ולפתור חידונים.';
      } else if (status === 'pending') {
        msg = 'בקשת ההרשמה שלך התקבלה וממתינה לאישור הנהלת האולפנה.';
      } else {
        msg = 'בקשת ההרשמה לא אושרה. פנה לרכזת ההלכה באולפנה.';
      }
      setCheckResult({ found: true, student: found, message: msg });
    } else {
      setCheckResult({
        found: false,
        message: 'לא נמצאה תלמידה בשם משתמש זה. וודא שהקלדת נכון או הירשם מחדש.',
      });
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-4 animate-in fade-in duration-300">
      {/* Banner Header */}
      <div className="bg-gradient-to-r from-amber-700 via-amber-600 to-yellow-600 text-white p-6 sm:p-8 rounded-3xl shadow-lg relative overflow-hidden">
        <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 bg-amber-900/40 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-bold border border-amber-300/30">
            <UserPlus className="w-4 h-4 text-amber-300" />
            <span>הרשמה למבצע הלכה יומית</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold font-['Heebo']">
            הרשמת תלמידה חדשה
          </h2>
          <p className="text-amber-100 text-xs sm:text-sm max-w-xl font-medium leading-relaxed">
            ברוכות הבאות למבצע הלימוד היומי מתוך סדרת "אהלי הלכה"!
            <br />
            לאחר הרשמתך, בקשת ההרשמה תועבר לאישור צוות ההנהלה. לאחר האישור תוכלו לצבור נקודות ולזכות בפרסים!
          </p>
        </div>
      </div>

      {registeredStudent ? (
        /* Success Card */
        <div className="bg-white p-8 rounded-3xl border border-emerald-200 shadow-xl text-center space-y-6 animate-in zoom-in-95">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            {isAutoApprovedResult ? (
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            ) : (
              <Clock className="w-10 h-10 animate-pulse" />
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-2xl font-extrabold text-slate-900 font-['Heebo']">
              {isAutoApprovedResult ? 'הרשמתך אושרה בהצלחה!' : 'בקשת ההרשמה נקלטה בהצלחה!'}
            </h3>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              תודה <span className="font-bold text-amber-800">{registeredStudent.fullName}</span> (כיתה {registeredStudent.className})!
            </p>
          </div>

          <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 text-right max-w-md mx-auto space-y-2 text-xs text-amber-950 font-semibold">
            <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
              <span>סטטוס הרשמה:</span>
              <span className={`px-2.5 py-1 rounded-full font-bold flex items-center gap-1 ${
                isAutoApprovedResult
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-200/90 text-amber-900'
              }`}>
                {isAutoApprovedResult ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    מאושרת (באמצעות קוד הזמנה)
                  </>
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5" />
                    ממתין לאישור מנהל
                  </>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span>שם משתמש:</span>
              <span className="font-bold font-mono text-amber-900">{registeredStudent.username}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>שכבה וכיתה:</span>
              <span className="font-bold">שכבה {registeredStudent.grade}' ({registeredStudent.className})</span>
            </div>
          </div>

          <div className={`p-4 rounded-2xl border text-xs text-center font-medium ${
            isAutoApprovedResult
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-amber-100/60 border-amber-200 text-amber-900'
          }`}>
            {isAutoApprovedResult
              ? '🎉 איזה יופי! ההרשמה שלך אושרה מידית. כעת תוכל להיכנס ולפתור את החידון היומי ולהוביל את הלוח!'
              : '💡 ברגע שמנהלת האולפנה תאשר את הבקשה, השם שלך יופיע ברשימת התלמידות ותוכלי להתחיל ללמוד ולצבור נקודות!'}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                setRegisteredStudent(null);
                setFullName('');
                setUsername('');
                setInvitationCode('');
                setInvitationValidInfo(null);
              }}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors"
            >
              הרשמת תלמידה נוספת
            </button>

            <button
              onClick={onGoToStudy}
              className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-md transition-all flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
              <span>עבור לעמוד הלימוד</span>
            </button>
          </div>
        </div>
      ) : (
        /* Form Card */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-white p-6 sm:p-8 rounded-3xl border border-amber-200 shadow-xl space-y-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Optional Invitation Code Box */}
              <div className="p-4 bg-amber-50/80 rounded-2xl border border-amber-200/90 space-y-2">
                <label className="block text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-amber-700" />
                  <span>קוד הזמנה לכיתה/שכבה (רשות)</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="לדוגמה: ULPA-2026-T1"
                    value={invitationCode}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setInvitationCode(val);
                      checkInviteCode(val);
                    }}
                    className="flex-1 p-2.5 rounded-xl border border-amber-300 bg-white text-xs font-bold font-mono tracking-wider text-amber-900 uppercase focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                  {invitationValidInfo?.valid && (
                    <span className="p-2 bg-emerald-100 text-emerald-700 rounded-xl flex items-center gap-1 text-xs font-bold border border-emerald-200">
                      <Check className="w-4 h-4" />
                      <span>תקף</span>
                    </span>
                  )}
                </div>
                {invitationValidInfo && (
                  <p className={`text-xs font-semibold ${
                    invitationValidInfo.valid ? 'text-emerald-700' : 'text-rose-600'
                  }`}>
                    {invitationValidInfo.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-extrabold text-amber-950 mb-1.5">
                  שם מלא של התלמידה <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="לדוגמה: תמר שפירא"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full p-3 rounded-2xl border border-amber-200 bg-amber-50/30 text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:bg-white focus:outline-hidden transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-amber-950 mb-1.5">
                    שכבה <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={grade}
                    onChange={(e) => {
                      const newG = e.target.value as GradeType;
                      setGrade(newG);
                      setClassName(`${newG}'1`);
                    }}
                    className="w-full p-3 rounded-2xl border border-amber-200 bg-amber-50/30 text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:bg-white focus:outline-hidden transition-all"
                  >
                    <option value="ט">שכבת ט'</option>
                    <option value="י">שכבת י'</option>
                    <option value="יא">שכבת יא'</option>
                    <option value="יב">שכבת יב'</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-amber-950 mb-1.5">
                    כיתה <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="לדוגמה: ט'1, י'2"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    className="w-full p-3 rounded-2xl border border-amber-200 bg-amber-50/30 text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:bg-white focus:outline-hidden transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-amber-950 mb-1.5">
                    שם משתמש לחיבור <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="לדוגמה: tamar_s"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full p-3 rounded-2xl border border-amber-200 bg-amber-50/30 text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:bg-white focus:outline-hidden transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-amber-950 mb-1.5">
                    סיסמה אישית
                  </label>
                  <input
                    type="password"
                    placeholder="123"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-3 rounded-2xl border border-amber-200 bg-amber-50/30 text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:bg-white focus:outline-hidden transition-all"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white font-extrabold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <span>שולח בקשת הרשמה...</span>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    <span>שליחת בקשת הרשמה להנהלה</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Status Check Sidebar */}
          <div className="space-y-6">
            <div className="bg-amber-50/90 p-6 rounded-3xl border border-amber-200 shadow-md space-y-4">
              <div className="flex items-center gap-2 text-amber-950 font-extrabold text-sm font-['Heebo']">
                <Clock className="w-4 h-4 text-amber-700" />
                <span>בדיקת סטטוס הרשמה</span>
              </div>
              <p className="text-xs text-amber-900/80 leading-relaxed font-medium">
                כבר נרשמת? הזיני את שם המשתמש שלך כדי לבדוק האם בקשתך כבר אושרה על ידי המנהל:
              </p>

              <form onSubmit={handleCheckStatus} className="space-y-3">
                <input
                  type="text"
                  placeholder="שם משתמש או שם מלא"
                  value={checkUsername}
                  onChange={(e) => setCheckUsername(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-amber-300 text-xs font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-hidden bg-white"
                />
                <button
                  type="submit"
                  className="w-full py-2 px-3 bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs rounded-xl transition-colors shadow-xs"
                >
                  בדוק סטטוס
                </button>
              </form>

              {checkResult && (
                <div
                  className={`p-3 rounded-2xl text-xs font-bold border ${
                    checkResult.found
                      ? checkResult.student?.status === 'approved'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : checkResult.student?.status === 'pending'
                        ? 'bg-amber-100 border-amber-300 text-amber-900'
                        : 'bg-rose-50 border-rose-200 text-rose-800'
                      : 'bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                >
                  {checkResult.message}
                </div>
              )}
            </div>

            <div className="bg-white p-5 rounded-3xl border border-amber-200 shadow-xs space-y-2 text-xs text-slate-600">
              <div className="font-extrabold text-amber-950 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>למה כדאי להירשם?</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-700">
                <li>השתתפות במבצע "אהלי הלכה"</li>
                <li>צבירת ניקוד אישי, כיתתי ושכבתי</li>
                <li>זכייה בפרסים שווים לאורך השנה</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
