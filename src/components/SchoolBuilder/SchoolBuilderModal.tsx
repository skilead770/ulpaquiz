import React, { useState, useMemo } from 'react';
import {
  School,
  GraduationCap,
  Crown,
  BookOpen,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  Plus,
  Trash2,
  X,
  Share2,
  Mail,
  Palette,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { SchoolConfig, SchoolGender, SchoolType, GradeType } from '../../types';
import { SUPER_ADMIN_EMAIL } from '../../lib/config';
import { createSchoolApi } from '../../lib/api';
import { validateGmailAddress } from '../../lib/gmailValidator';
import { useSchool } from '../../lib/schoolContext';

interface SchoolBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSchoolCreated?: (newSchool: SchoolConfig) => void;
}

// Built-in logo badges that look sharp and professional for Yeshivot and Ulpanot
export const EMBLEM_PRESETS = [
  { id: 'crown', label: 'כתר תורה', icon: 'Crown', url: '' },
  { id: 'book', label: 'ספר תורה', icon: 'BookOpen', url: '' },
  { id: 'grad', label: 'כובע בוגרים', icon: 'GraduationCap', url: '' },
  { id: 'school', label: 'מבנה מוסד', icon: 'School', url: '' },
  { id: 'sparkles', label: 'מגן זוהר', icon: 'Sparkles', url: '' },
];

export const COLOR_PALETTES = [
  { id: 'royal-blue', name: 'כחול מלכותי (ישיבתי)', hex: '#1d4ed8', bg: 'bg-blue-700', border: 'border-blue-700' },
  { id: 'navy', name: 'נייבי עמוק', hex: '#0f172a', bg: 'bg-slate-900', border: 'border-slate-900' },
  { id: 'amber', name: 'זהב ענבר קלאסי', hex: '#d97706', bg: 'bg-amber-600', border: 'border-amber-600' },
  { id: 'purple', name: 'סגול אולפנא', hex: '#7c3aed', bg: 'bg-purple-600', border: 'border-purple-600' },
  { id: 'bordeaux', name: 'בורדו מלכותי', hex: '#991b1b', bg: 'bg-red-800', border: 'border-red-800' },
  { id: 'emerald', name: 'ירוק אמרלד', hex: '#047857', bg: 'bg-emerald-700', border: 'border-emerald-700' },
];

function generateSlugFromName(name: string): string {
  const map: Record<string, string> = {
    'א': 'a', 'ב': 'b', 'ג': 'g', 'ד': 'd', 'ה': 'h', 'ו': 'v',
    'ז': 'z', 'ח': 'ch', 'ט': 't', 'י': 'y', 'כ': 'k', 'ך': 'k',
    'ל': 'l', 'מ': 'm', 'ם': 'm', 'נ': 'n', 'ן': 'n', 'ס': 's',
    'ע': 'a', 'פ': 'p', 'ף': 'f', 'צ': 'tz', 'ץ': 'tz', 'ק': 'k',
    'ר': 'r', 'ש': 'sh', 'ת': 't', ' ': '-',
  };
  let slug = '';
  for (const char of name.trim().toLowerCase()) {
    if (map[char]) slug += map[char];
    else if (/[a-z0-9-]/.test(char)) slug += char;
  }
  return slug.replace(/-+/g, '-').replace(/^-|-$/g, '') || `school-${Date.now().toString().slice(-4)}`;
}

export const SchoolBuilderModal: React.FC<SchoolBuilderModalProps> = ({
  isOpen,
  onClose,
  onSchoolCreated,
}) => {
  const { setSchoolId, refreshSchools } = useSchool();

  // Step 1: Basic Info
  const [name, setName] = useState('');
  const [gender, setGender] = useState<SchoolGender>('girls');
  const [slug, setSlug] = useState('');
  const [isSlugManual, setIsSlugManual] = useState(false);

  // Step 2: Branding
  const [selectedPalette, setSelectedPalette] = useState(COLOR_PALETTES[0]);
  const [selectedEmblem, setSelectedEmblem] = useState('crown');
  const [customLogoUrl, setCustomLogoUrl] = useState('');
  const [useCustomLogoUrl, setUseCustomLogoUrl] = useState(false);

  // Step 3: Main Manager
  const [managerEmail, setManagerEmail] = useState('');
  const [managerName, setManagerName] = useState('');

  // Step 4: Classes
  const [selectedGrades, setSelectedGrades] = useState<GradeType[]>(['ט', 'י', 'יא', 'יב']);
  const [classesList, setClassesList] = useState<string[]>([
    "ט'1", "ט'2", "י'1", "י'2", "יא'1", "יא'2", "יב'1", "יב'2",
  ]);
  const [newClassInput, setNewClassInput] = useState('');
  const [dailyDedication, setDailyDedication] = useState('');

  // Creation State & Created School
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdSchool, setCreatedSchool] = useState<SchoolConfig | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);

  // Auto-generate slug when name changes unless manually edited
  const handleNameChange = (val: string) => {
    setName(val);
    if (!isSlugManual) {
      setSlug(generateSlugFromName(val));
    }
  };

  // Auto-set palette and default manager titles when gender changes
  const handleGenderChange = (newGender: SchoolGender) => {
    setGender(newGender);
    if (newGender === 'boys') {
      setSelectedPalette(COLOR_PALETTES[0]); // Royal Blue
      if (!managerName || managerName.includes('רכזת') || managerName.includes('מנהלת')) {
        setManagerName('ראש הישיבה / רכז ההלכה');
      }
    } else {
      setSelectedPalette(COLOR_PALETTES[3]); // Purple
      if (!managerName || managerName.includes('רכז ') || managerName.includes('ראש הישיבה')) {
        setManagerName('מנהלת האולפנה / רכזת ההלכה');
      }
    }
  };

  // Gmail validation for manager
  const managerValidation = useMemo(() => {
    if (!managerEmail.trim()) return null;
    return validateGmailAddress(managerEmail);
  }, [managerEmail]);

  // Add a class
  const handleAddClass = () => {
    const clean = newClassInput.trim();
    if (clean && !classesList.includes(clean)) {
      setClassesList([...classesList, clean]);
      setNewClassInput('');
    }
  };

  // Remove a class
  const handleRemoveClass = (cls: string) => {
    setClassesList(classesList.filter((c) => c !== cls));
  };

  // Re-generate default classes when grades toggle
  const toggleGrade = (grade: GradeType) => {
    let nextGrades: GradeType[];
    if (selectedGrades.includes(grade)) {
      if (selectedGrades.length === 1) return; // Keep at least one
      nextGrades = selectedGrades.filter((g) => g !== grade);
    } else {
      nextGrades = [...selectedGrades, grade];
    }
    setSelectedGrades(nextGrades);

    // Regenerate classes
    const generated: string[] = [];
    nextGrades.forEach((g) => {
      generated.push(`${g}'1`, `${g}'2`);
    });
    setClassesList(generated);
  };

  // Submit Handler
  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('יש להזין את שם המוסד');
      return;
    }

    const cleanSlug = (slug || generateSlugFromName(name)).trim().toLowerCase();
    if (!cleanSlug || cleanSlug.length < 2) {
      setError('יש להזין מזהה מוסד (slug) תקין בן לפחות 2 תווים');
      return;
    }

    if (!managerEmail.trim()) {
      setError('יש להזין כתובת Gmail עבור מנהל/ת המוסד');
      return;
    }

    if (!managerValidation?.isValid) {
      setError(managerValidation?.error || 'כתובת ה-Gmail של המנהל/ת אינה תקינה');
      return;
    }

    setIsSubmitting(true);

    try {
      const type: SchoolType = gender === 'boys' ? 'yeshiva' : 'ulpana';
      const logoUrl = useCustomLogoUrl && customLogoUrl.trim()
        ? customLogoUrl.trim()
        : ''; // Empty will use the handsome preset badge

      const newSchoolConfig: SchoolConfig = {
        id: cleanSlug,
        name: name.trim(),
        gender,
        type,
        logoUrl,
        primaryColor: selectedPalette.hex,
        themeKey: selectedPalette.id as any,
        defaultClasses: classesList.length > 0 ? classesList : ["ט'1", "ט'2", "י'1", "י'2"],
        superAdminEmail: SUPER_ADMIN_EMAIL,
        mainManagerEmail: managerValidation.normalizedEmail || managerEmail.trim().toLowerCase(),
        mainManagerName: managerName.trim() || (gender === 'boys' ? 'ראש הישיבה' : 'מנהלת האולפנה'),
        createdAt: new Date().toISOString(),
        dailyDedication: dailyDedication.trim(),
        active: true,
      };

      const result = await createSchoolApi(newSchoolConfig);
      await refreshSchools();
      setCreatedSchool(result.school);
      if (onSchoolCreated) {
        onSchoolCreated(result.school);
      }
    } catch (err: any) {
      console.error('[SchoolBuilder] Failed to create school:', err);
      setError(err?.message || 'שגיאה ביצירת המוסד. אנא נסה שנית.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Share message for manager
  const getShareLink = () => {
    if (typeof window === 'undefined') return '';
    const origin = window.location.origin;
    return `${origin}?school=${createdSchool?.id}`;
  };

  const getManagerWelcomeText = () => {
    if (!createdSchool) return '';
    const schoolLink = getShareLink();
    const isBoys = createdSchool.gender === 'boys';
    const title = isBoys ? 'שלום וברכה לכבוד רכז ההלכה / ראש הישיבה,' : 'שלום וברכה לכבוד מנהלת האולפנה / רכזת ההלכה,';
    const schoolTerm = isBoys ? 'בישיבת' : 'באולפנת';

    return `${title}

הוקמה עבורכם בהצלחה מערכת "מבצע הלכה יומית" ${schoolTerm} ${createdSchool.name}!

כתובת המערכת שלכם:
${schoolLink}

הנחיות כניסה למנהל/ת:
1. היכנסו לקישור הנ"ל מדפדפן המחשב או הנייד.
2. לחצו על "כניסת הנהלה" והתחברו באמצעות חשבון ה-Google שלכם: (${createdSchool.mainManagerEmail}).
3. בממשק המנהל תוכלו לאשר תלמידים, לעקוב אחר לוח המובילים, לקבוע הקדשות לחידון היומי ולנהל כיתות.

בהצלחה רבה בהגדלת תורה והאדרתה!`;
  };

  const copyToClipboard = (text: string, type: 'link' | 'msg') => {
    navigator.clipboard.writeText(text);
    if (type === 'link') {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } else {
      setCopiedMsg(true);
      setTimeout(() => setCopiedMsg(false), 2500);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden text-slate-800 text-right animate-in fade-in zoom-in-95 duration-200"
        dir="rtl"
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 flex items-center justify-between shrink-0 border-b border-indigo-900/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 flex items-center justify-center shadow-lg shrink-0">
              <School className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black font-['Heebo']">
                  הקמת מוסד לימוד חדש
                </h2>
                <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Super Admin
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                ישיבה תיכונית (בנים) או אולפנא (בנות) • פריסה מיידית ב-60 שניות
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {createdSchool ? (
            /* SUCCESS VIEW: Launch Kit */
            <div className="space-y-6 py-2">
              <div className="text-center space-y-2 bg-emerald-50 border border-emerald-200 p-6 rounded-2xl">
                <div className="w-16 h-16 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto shadow-md">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <h3 className="text-2xl font-black text-emerald-950 font-['Heebo']">
                  המוסד הוקם והופעל בהצלחה!
                </h3>
                <p className="text-sm text-emerald-800 font-medium">
                  {createdSchool.gender === 'boys' ? 'ישיבת' : 'אולפנת'} {createdSchool.name} מוכנה כעת לפעילות מלאה.
                </p>
              </div>

              {/* Live Link Card */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-2">
                <label className="text-xs font-bold text-slate-600 block">
                  קישור ייעודי למוסד (לתלמידים ולצוות):
                </label>
                <div className="flex items-center gap-2 bg-white border border-slate-300 p-2 rounded-xl">
                  <input
                    type="text"
                    readOnly
                    value={getShareLink()}
                    className="flex-1 text-xs sm:text-sm font-mono text-slate-800 bg-transparent outline-none text-left"
                    dir="ltr"
                  />
                  <button
                    onClick={() => copyToClipboard(getShareLink(), 'link')}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-xs shrink-0"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'הועתק!' : 'העתק קישור'}</span>
                  </button>
                </div>
              </div>

              {/* Instructions for Manager */}
              <div className="bg-indigo-50/70 border border-indigo-200/80 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-indigo-950 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-indigo-600" />
                    <span>הודעת פתיחה לשליחה למנהל/ת ({createdSchool.mainManagerEmail}):</span>
                  </h4>
                  <button
                    onClick={() => copyToClipboard(getManagerWelcomeText(), 'msg')}
                    className="text-xs text-indigo-700 hover:text-indigo-900 font-bold flex items-center gap-1 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-indigo-200"
                  >
                    {copiedMsg ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
                    <span>{copiedMsg ? 'הועתק!' : 'העתק הודעה'}</span>
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={8}
                  value={getManagerWelcomeText()}
                  className="w-full text-xs font-sans text-slate-700 bg-white p-3 rounded-xl border border-indigo-200 focus:outline-none resize-none leading-relaxed"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  onClick={() => {
                    setSchoolId(createdSchool.id);
                    onClose();
                  }}
                  className="w-full sm:flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>עבור לצפייה במוסד החדש כעת</span>
                </button>
                <button
                  onClick={() => {
                    setCreatedSchool(null);
                    setName('');
                    setSlug('');
                    setManagerEmail('');
                    setManagerName('');
                  }}
                  className="w-full sm:w-auto py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-all cursor-pointer"
                >
                  הקם מוסד נוסף
                </button>
              </div>
            </div>
          ) : (
            /* WIZARD FORM */
            <form onSubmit={handleCreateSchool} className="space-y-6">
              {error && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm font-bold flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              {/* 1. School Name & Gender */}
              <div className="space-y-4">
                <h3 className="text-sm font-black text-slate-900 border-b pb-2 border-slate-100 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                    1
                  </span>
                  <span>פרטי המוסד וסוג האוכלוסייה</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Gender Selector: Boys Yeshiva */}
                  <div
                    onClick={() => handleGenderChange('boys')}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-3 ${
                      gender === 'boys'
                        ? 'border-blue-600 bg-blue-50/60 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${
                      gender === 'boys' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      👨‍🎓
                    </div>
                    <div>
                      <div className="font-extrabold text-sm text-slate-900">ישיבה תיכונית (בנים)</div>
                      <div className="text-xs text-slate-500">לשון זכר: תלמיד, ראש הישיבה, ר"מ, אלוף הישיבה</div>
                    </div>
                  </div>

                  {/* Gender Selector: Girls Ulpana */}
                  <div
                    onClick={() => handleGenderChange('girls')}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-3 ${
                      gender === 'girls'
                        ? 'border-purple-600 bg-purple-50/60 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${
                      gender === 'girls' ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      👩‍🎓
                    </div>
                    <div>
                      <div className="font-extrabold text-sm text-slate-900">אולפנא (בנות)</div>
                      <div className="text-xs text-slate-500">לשון נקבה: תלמידה, מנהלת האולפנה, רכזת, אלופת האולפנה</div>
                    </div>
                  </div>
                </div>

                {/* School Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    שם המוסד המלא <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={gender === 'boys' ? 'לדוגמה: ישיבת בני עקיבא כפר הרא"ה' : 'לדוגמה: אולפנת פלך ירושלים'}
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-bold text-slate-900"
                  />
                </div>

                {/* Slug Identifier */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      מזהה מערכת באנגלית (Slug / Subdomain) <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] text-slate-400">ישמש לכתובת האתר</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      required
                      placeholder="e.g. kfar-haroeh"
                      value={slug}
                      onChange={(e) => {
                        setIsSlugManual(true);
                        setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                      }}
                      className="w-full px-4 py-2 rounded-xl border border-slate-300 font-mono text-xs sm:text-sm text-slate-900 text-left"
                      dir="ltr"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1" dir="ltr">
                    URL: https://ulpaquiz.web.app?school={slug || 'your-school'}
                  </p>
                </div>
              </div>

              {/* 2. Main Coordinator / Manager */}
              <div className="space-y-4">
                <h3 className="text-sm font-black text-slate-900 border-b pb-2 border-slate-100 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                    2
                  </span>
                  <span>מנהל/ת המוסד הראשי/ת (רכז/ת הלכה)</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      כתובת Gmail של המנהל/ת <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="rav.cohen@gmail.com"
                      value={managerEmail}
                      onChange={(e) => setManagerEmail(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm font-medium text-left ${
                        managerValidation === null
                          ? 'border-slate-300'
                          : managerValidation.isValid
                          ? 'border-emerald-500 bg-emerald-50/30'
                          : 'border-rose-400 bg-rose-50/30'
                      }`}
                      dir="ltr"
                    />
                    {managerValidation && !managerValidation.isValid && (
                      <p className="text-[11px] text-rose-600 mt-1 font-bold">
                        {managerValidation.error}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      שם ותואר המנהל/ת
                    </label>
                    <input
                      type="text"
                      placeholder={gender === 'boys' ? 'לדוגמה: הרב יוסף כהן' : 'לדוגמה: הרבנית מיכל'}
                      value={managerName}
                      onChange={(e) => setManagerName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Branding & Colors */}
              <div className="space-y-4">
                <h3 className="text-sm font-black text-slate-900 border-b pb-2 border-slate-100 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                    3
                  </span>
                  <span>מיתוג, לוגו וצבעי המוסד</span>
                </h3>

                {/* Color Palette Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    צבע מיתוג ראשי
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {COLOR_PALETTES.map((palette) => (
                      <button
                        key={palette.id}
                        type="button"
                        onClick={() => setSelectedPalette(palette)}
                        className={`p-2.5 rounded-xl border flex items-center gap-2.5 text-right transition-all cursor-pointer ${
                          selectedPalette.id === palette.id
                            ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div
                          className="w-5 h-5 rounded-full shrink-0 shadow-xs"
                          style={{ backgroundColor: palette.hex }}
                        />
                        <span className="text-xs font-bold text-slate-800 truncate">
                          {palette.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Logo / Emblem Choice */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">סמל / לוגו המוסד</label>
                    <button
                      type="button"
                      onClick={() => setUseCustomLogoUrl(!useCustomLogoUrl)}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                    >
                      {useCustomLogoUrl ? 'בחר מסמלים מובנים' : 'הזן קישור לתמונה משלך'}
                    </button>
                  </div>

                  {useCustomLogoUrl ? (
                    <input
                      type="url"
                      placeholder="https://example.com/school-logo.png"
                      value={customLogoUrl}
                      onChange={(e) => setCustomLogoUrl(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-mono text-left"
                      dir="ltr"
                    />
                  ) : (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {EMBLEM_PRESETS.map((emb) => (
                        <button
                          key={emb.id}
                          type="button"
                          onClick={() => setSelectedEmblem(emb.id)}
                          className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer shrink-0 min-w-[90px] ${
                            selectedEmblem === emb.id
                              ? 'border-indigo-600 bg-indigo-50/50'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-xs"
                            style={{ backgroundColor: selectedPalette.hex }}
                          >
                            {emb.id === 'crown' && <Crown className="w-5 h-5" />}
                            {emb.id === 'book' && <BookOpen className="w-5 h-5" />}
                            {emb.id === 'grad' && <GraduationCap className="w-5 h-5" />}
                            {emb.id === 'school' && <School className="w-5 h-5" />}
                            {emb.id === 'sparkles' && <Sparkles className="w-5 h-5" />}
                          </div>
                          <span className="text-[11px] font-bold text-slate-700">{emb.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Grades & Classes */}
              <div className="space-y-4">
                <h3 className="text-sm font-black text-slate-900 border-b pb-2 border-slate-100 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                    4
                  </span>
                  <span>שכבות גיל וכיתות פעילות</span>
                </h3>

                {/* Grade toggles */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    שכבות גיל במוסד
                  </label>
                  <div className="flex items-center gap-2">
                    {(['ט', 'י', 'יא', 'יב'] as GradeType[]).map((grade) => {
                      const isSelected = selectedGrades.includes(grade);
                      return (
                        <button
                          key={grade}
                          type="button"
                          onClick={() => toggleGrade(grade)}
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          שכבת {grade}'
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Classes chips */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    רשימת כיתות
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {classesList.map((cls) => (
                      <span
                        key={cls}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800"
                      >
                        <span>כיתה {cls}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveClass(cls)}
                          className="hover:text-rose-600 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>

                  {/* Add Class Input */}
                  <div className="flex items-center gap-2 max-w-xs">
                    <input
                      type="text"
                      placeholder="הוסף כיתה (למשל: ט'3)"
                      value={newClassInput}
                      onChange={(e) => setNewClassInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddClass();
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-medium flex-1"
                    />
                    <button
                      type="button"
                      onClick={handleAddClass}
                      className="px-3 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-xl hover:bg-slate-900 cursor-pointer"
                    >
                      הוסף
                    </button>
                  </div>
                </div>

                {/* School Dedication */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    הקדשה קבועה ללימוד במוסד (אופציונלי)
                  </label>
                  <input
                    type="text"
                    placeholder="למשל: לעילוי נשמת מייסד הישיבה / בוגרי המוסד שנפלו על קידוש השם"
                    value={dailyDedication}
                    onChange={(e) => setDailyDedication(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-medium"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-bold transition-all cursor-pointer"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !name.trim() || !managerEmail.trim()}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white font-black text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>{isSubmitting ? 'מקים ומפרוויז\'ן מוסד...' : '🚀 הקם והפעל מוסד חדש'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

