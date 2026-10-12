import React, { useState, useMemo } from 'react';
import {
  Building2,
  Plus,
  Search,
  Check,
  Copy,
  ExternalLink,
  Edit3,
  Trash2,
  CopyCheck,
  ShieldCheck,
  Users,
  GraduationCap,
  Sparkles,
  Palette,
  Eye,
  Settings,
  CheckCircle2,
  AlertTriangle,
  X,
  RefreshCw,
  ArrowRight,
  Globe,
  Sliders,
  UploadCloud,
  Image as ImageIcon,
  Link as LinkIcon,
} from 'lucide-react';
import { School, SchoolType } from '../../types/tenant';
import { useTenant } from '../../context/SchoolContext';
import { SUPER_ADMIN_EMAIL } from '../../lib/config';

interface SchoolsManagerTabProps {
  onSwitchSchool?: (schoolId: string) => void;
}

const COLOR_PRESETS = [
  { label: 'ענבר / כתום', value: '#d97706' },
  { label: 'כחול מלכותי', value: '#2563eb' },
  { label: 'אינדיגו עמוק', value: '#4f46e5' },
  { label: 'ירוק אמרלד', value: '#059669' },
  { label: 'סגול / בורדו', value: '#7c3aed' },
  { label: 'ורוד פטל', value: '#db2777' },
  { label: 'טורקיז / ים', value: '#0891b2' },
  { label: 'שחור פחם', value: '#1e293b' },
];

const ULPANA_CLASSES_PRESET = ["ט'1", "ט'2", "י'1", "י'2", "יא'1", "יא'2", "יב'1", "יב'2"];
const YESHIVA_CLASSES_PRESET = ["שיעור א' 1", "שיעור א' 2", "שיעור ב' 1", "שיעור ב' 2", "שיעור ג' 1", "שיעור ד' 1"];
const JUNIOR_CLASSES_PRESET = ["ז'1", "ז'2", "ח'1", "ח'2", "ט'1", "ט'2"];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const SchoolsManagerTab: React.FC<SchoolsManagerTabProps> = ({ onSwitchSchool }) => {
  const {
    availableSchools,
    currentSchoolId,
    setSchoolId,
    saveSchool,
    deleteSchool,
    refreshSchools,
    syncAllManagers,
  } = useTenant();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'girls' | 'boys' | 'active' | 'inactive'>('all');

  // Copy feedback state
  const [copiedSchoolId, setCopiedSchoolId] = useState<string | null>(null);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'clone'>('create');
  const [activeFormTab, setActiveFormTab] = useState<'general' | 'branding' | 'classes' | 'managers' | 'settings'>('general');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Delete modal state
  const [schoolToDelete, setSchoolToDelete] = useState<School | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Logo upload state & ref
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [logoMode, setLogoMode] = useState<'upload' | 'url'>('upload');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isProcessingLogo, setIsProcessingLogo] = useState(false);
  const [logoFileSize, setLogoFileSize] = useState<string | null>(null);

  // Form Fields
  const [editingId, setEditingId] = useState<string>('');
  const [name, setName] = useState('');
  const [type, setType] = useState<SchoolType>('girls');
  const [slugId, setSlugId] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [primaryColor, setPrimaryColor] = useState('#d97706');
  const [logoUrl, setLogoUrl] = useState('');
  const [welcomeTitle, setWelcomeTitle] = useState('');
  const [welcomeSubtitle, setWelcomeSubtitle] = useState('');
  const [classes, setClasses] = useState<string[]>([]);
  const [newClassInput, setNewClassInput] = useState('');
  const [adminEmails, setAdminEmails] = useState<string[]>([SUPER_ADMIN_EMAIL]);
  const [newEmailInput, setNewEmailInput] = useState('');
  const [allowRegistration, setAllowRegistration] = useState(true);
  const [requireCode, setRequireCode] = useState(false);
  const [customWelcome, setCustomWelcome] = useState('');

  const handleSyncManagers = async () => {
    try {
      setIsSyncing(true);
      const count = await syncAllManagers();
      setSyncFeedback(`סונכרנו בהצלחה ${count} מנהלים ל-Firestore!`);
      setTimeout(() => setSyncFeedback(null), 4000);
    } catch (err) {
      console.error('Failed to sync managers:', err);
      alert('שגיאה בסנכרון מנהלים ל-Firestore');
    } finally {
      setIsSyncing(false);
    }
  };

  const processImageFile = (file: File) => {
    setUploadError(null);
    if (!file.type.startsWith('image/')) {
      setUploadError('יש לבחור קובץ תמונה בלבד (PNG, JPG, WebP, SVG)');
      return;
    }

    if (file.type === 'image/svg+xml') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          setLogoUrl(result);
          setLogoFileSize(`${(file.size / 1024).toFixed(1)} KB (SVG)`);
        }
      };
      reader.onerror = () => setUploadError('שגיאה בקריאת קובץ ה-SVG');
      reader.readAsDataURL(file);
      return;
    }

    setIsProcessingLogo(true);
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new window.Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const maxDim = 256;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            setUploadError('לא ניתן לעבד את התמונה');
            setIsProcessingLogo(false);
            return;
          }

          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          const dataUrl = canvas.toDataURL('image/png');
          setLogoUrl(dataUrl);
          const kb = Math.round((dataUrl.length * 3) / 4 / 1024);
          setLogoFileSize(`${kb} KB (מותאם אישית)`);
        } catch (err) {
          console.error('Error resizing logo image:', err);
          setUploadError('שגיאה בעיבוד התמונה');
        } finally {
          setIsProcessingLogo(false);
        }
      };
      img.onerror = () => {
        setUploadError('קובץ התמונה פגום או לא נתמך');
        setIsProcessingLogo(false);
      };
      img.src = readerEvent.target?.result as string;
    };
    reader.onerror = () => {
      setUploadError('שגיאה בטעינת הקובץ');
      setIsProcessingLogo(false);
    };
    reader.readAsDataURL(file);
  };

  // Auto-generate slug when name changes in create mode
  const handleNameChange = (val: string) => {
    setName(val);
    if (modalMode === 'create' && !slugId) {
      // If English letters exist, slugify; else create a clean transliterated/default slug
      const slug = slugify(val);
      if (slug) setSlugId(slug);
    }
  };

  // Change school type handler with smart defaults
  const handleTypeChange = (newType: SchoolType) => {
    setType(newType);
    if (newType === 'girls') {
      if (!welcomeTitle || welcomeTitle.includes('ברוך הבא')) {
        setWelcomeTitle('ברוכה הבאה לחידון הלכה יומית');
      }
      if (!welcomeSubtitle || welcomeSubtitle.includes('הישיבה')) {
        setWelcomeSubtitle('לימוד יומי, צבירת נקודות ופרסים לאולפנה');
      }
      if (classes.length === 0 || classes === YESHIVA_CLASSES_PRESET) {
        setClasses([...ULPANA_CLASSES_PRESET]);
      }
      if (primaryColor === '#2563eb') {
        setPrimaryColor('#d97706');
      }
    } else {
      if (!welcomeTitle || welcomeTitle.includes('ברוכה הבאה')) {
        setWelcomeTitle('ברוך הבא לחידון הלכה יומית');
      }
      if (!welcomeSubtitle || welcomeSubtitle.includes('לאולפנה')) {
        setWelcomeSubtitle('לימוד יומי, צבירת נקודות ופרסים לתלמידי הישיבה');
      }
      if (classes.length === 0 || classes === ULPANA_CLASSES_PRESET) {
        setClasses([...YESHIVA_CLASSES_PRESET]);
      }
      if (primaryColor === '#d97706') {
        setPrimaryColor('#2563eb');
      }
    }
  };

  // Open Create Modal
  const openCreateModal = () => {
    setModalMode('create');
    setEditingId('');
    setName('');
    setType('girls');
    setSlugId('');
    setSubdomain('');
    setIsActive(true);
    setPrimaryColor('#d97706');
    setLogoUrl('/logo-uash.png');
    setWelcomeTitle('ברוכה הבאה לחידון הלכה יומית');
    setWelcomeSubtitle('לימוד יומי, צבירת נקודות ופרסים לאולפנה');
    setClasses([...ULPANA_CLASSES_PRESET]);
    setNewClassInput('');
    setAdminEmails([SUPER_ADMIN_EMAIL]);
    setNewEmailInput('');
    setAllowRegistration(true);
    setRequireCode(false);
    setCustomWelcome('');
    setUploadError(null);
    setLogoFileSize(null);
    setLogoMode('upload');
    setActiveFormTab('general');
    setFormError(null);
    setFormSuccess(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (school: School) => {
    setModalMode('edit');
    setEditingId(school.id);
    setName(school.name);
    setType(school.type || 'girls');
    setSlugId(school.id);
    setSubdomain(school.subdomain || school.id);
    setIsActive(school.isActive !== false);
    setPrimaryColor(school.branding?.primaryColor || '#d97706');
    setLogoUrl(school.branding?.logoUrl || '');
    setUploadError(null);
    setLogoFileSize(school.branding?.logoUrl?.startsWith('data:') ? 'מותאם אישית' : null);
    setLogoMode(school.branding?.logoUrl?.startsWith('http') ? 'url' : 'upload');
    setWelcomeTitle(school.branding?.welcomeTitle || '');
    setWelcomeSubtitle(school.branding?.welcomeSubtitle || '');
    setClasses([...(school.classes || [])]);
    setNewClassInput('');
    const emails = Array.isArray(school.adminEmails) ? school.adminEmails : [];
    if (!emails.some((e) => e.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase())) {
      emails.unshift(SUPER_ADMIN_EMAIL);
    }
    setAdminEmails([...emails]);
    setNewEmailInput('');
    setAllowRegistration(school.settings?.allowStudentRegistration !== false);
    setRequireCode(Boolean(school.settings?.requireInvitationCode));
    setCustomWelcome(school.settings?.customWelcomeMessage || '');
    setActiveFormTab('general');
    setFormError(null);
    setFormSuccess(null);
    setIsModalOpen(true);
  };

  // Open Clone/Duplicate Modal
  const openCloneModal = (sourceSchool: School) => {
    setModalMode('clone');
    setEditingId('');
    setName(`${sourceSchool.name} (עותק)`);
    setType(sourceSchool.type || 'girls');
    setSlugId(`${sourceSchool.id}-copy`);
    setSubdomain(`${sourceSchool.id}-copy`);
    setIsActive(true);
    setPrimaryColor(sourceSchool.branding?.primaryColor || '#d97706');
    setLogoUrl(sourceSchool.branding?.logoUrl || '');
    setUploadError(null);
    setLogoFileSize(sourceSchool.branding?.logoUrl?.startsWith('data:') ? 'מותאם אישית' : null);
    setLogoMode(sourceSchool.branding?.logoUrl?.startsWith('http') ? 'url' : 'upload');
    setWelcomeTitle(sourceSchool.branding?.welcomeTitle || '');
    setWelcomeSubtitle(sourceSchool.branding?.welcomeSubtitle || '');
    setClasses([...(sourceSchool.classes || [])]);
    setNewClassInput('');
    setAdminEmails([SUPER_ADMIN_EMAIL]);
    setNewEmailInput('');
    setAllowRegistration(sourceSchool.settings?.allowStudentRegistration !== false);
    setRequireCode(Boolean(sourceSchool.settings?.requireInvitationCode));
    setCustomWelcome(sourceSchool.settings?.customWelcomeMessage || '');
    setActiveFormTab('general');
    setFormError(null);
    setFormSuccess(null);
    setIsModalOpen(true);
  };

  // Class chip operations
  const handleAddClass = () => {
    const trimmed = newClassInput.trim();
    if (!trimmed) return;
    if (classes.includes(trimmed)) {
      setFormError('כיתה זו כבר קיימת ברשימה');
      return;
    }
    setClasses((prev) => [...prev, trimmed]);
    setNewClassInput('');
    setFormError(null);
  };

  const handleRemoveClass = (cls: string) => {
    setClasses((prev) => prev.filter((c) => c !== cls));
  };

  // Admin email operations
  const handleAddEmail = () => {
    const trimmed = newEmailInput.trim().toLowerCase();
    if (!trimmed) return;
    if (!trimmed.includes('@') || !trimmed.includes('.')) {
      setFormError('כתובת אימייל אינה תקינה');
      return;
    }
    if (adminEmails.map((e) => e.toLowerCase()).includes(trimmed)) {
      setFormError('אימייל זה כבר מוגדר כמנהל מוסד');
      return;
    }
    setAdminEmails((prev) => [...prev, trimmed]);
    setNewEmailInput('');
    setFormError(null);
  };

  const handleRemoveEmail = (email: string) => {
    if (email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      setFormError('לא ניתן להסיר את חשבון המנהל הראשי (Super Admin)');
      return;
    }
    setAdminEmails((prev) => prev.filter((e) => e !== email));
  };

  // Save School Form Submission
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const cleanName = name.trim();
    const cleanSlug = slugId.trim().toLowerCase();

    if (!cleanName) {
      setFormError('נא להזין שם מוסד');
      setActiveFormTab('general');
      return;
    }

    if (!cleanSlug) {
      setFormError('נא להזין מזהה ייחודי (Slug ID)');
      setActiveFormTab('general');
      return;
    }

    if (!/^[a-z0-9-]+$/.test(cleanSlug)) {
      setFormError('מזהה המוסד חייב לכלול אותיות באנגלית קטנות, מספרים ומקפים בלבד (ללא רווחים)');
      setActiveFormTab('general');
      return;
    }

    // Check duplicate ID
    if (modalMode === 'create' || modalMode === 'clone') {
      const exists = availableSchools.some((s) => s.id === cleanSlug);
      if (exists) {
        setFormError(`מוסד עם המזהה "${cleanSlug}" כבר קיים במערכת. אנא בחר מזהה ייחודי.`);
        setActiveFormTab('general');
        return;
      }
    }

    if (classes.length === 0) {
      setFormError('נא להגדיר לפחות כיתה אחת עבור המוסד');
      setActiveFormTab('classes');
      return;
    }

    const finalAdminEmails = [...adminEmails];
    if (!finalAdminEmails.some((e) => e.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase())) {
      finalAdminEmails.unshift(SUPER_ADMIN_EMAIL);
    }

    const schoolPayload: School = {
      id: modalMode === 'edit' ? editingId : cleanSlug,
      name: cleanName,
      type,
      subdomain: subdomain.trim() || cleanSlug,
      branding: {
        schoolName: cleanName,
        logoUrl: logoUrl.trim(),
        primaryColor: primaryColor.trim() || (type === 'boys' ? '#2563eb' : '#d97706'),
        welcomeTitle: welcomeTitle.trim() || (type === 'boys' ? 'ברוך הבא לחידון הלכה יומית' : 'ברוכה הבאה לחידון הלכה יומית'),
        welcomeSubtitle: welcomeSubtitle.trim() || (type === 'boys' ? 'לימוד יומי, צבירת נקודות ופרסים לתלמידי הישיבה' : 'לימוד יומי, צבירת נקודות ופרסים לאולפנה'),
      },
      adminEmails: finalAdminEmails,
      classes,
      settings: {
        allowStudentRegistration: allowRegistration,
        requireInvitationCode: requireCode,
        customWelcomeMessage: customWelcome.trim(),
      },
      createdAt: modalMode === 'edit'
        ? (availableSchools.find((s) => s.id === editingId)?.createdAt || new Date().toISOString())
        : new Date().toISOString(),
      isActive,
    };

    try {
      setIsSaving(true);
      await saveSchool(schoolPayload);
      setFormSuccess('המוסד נשמר ופורסם בהצלחה!');
      setTimeout(() => {
        setIsModalOpen(false);
        setFormSuccess(null);
      }, 900);
    } catch (err: unknown) {
      console.error('Failed to save school:', err);
      const msg = err instanceof Error ? err.message : 'שגיאה בשמירת המוסד';
      setFormError(`שגיאה בשמירת המוסד: ${msg}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle Active/Published status directly from list
  const handleTogglePublish = async (school: School) => {
    try {
      const updated: School = {
        ...school,
        isActive: !school.isActive,
      };
      await saveSchool(updated);
    } catch (err) {
      console.error('Failed to toggle publish:', err);
      alert('שגיאה בעדכון סטטוס המוסד');
    }
  };

  // Delete School confirmed
  const handleConfirmDelete = async () => {
    if (!schoolToDelete) return;
    if (availableSchools.length <= 1) {
      alert('לא ניתן למחוק את המוסד האחרון במערכת');
      setSchoolToDelete(null);
      return;
    }
    if (schoolToDelete.id === 'shvut-rachel') {
      alert('לא ניתן למחוק את מוסד ברירת המחדל (שבות רחל)');
      setSchoolToDelete(null);
      return;
    }

    try {
      setIsDeleting(true);
      await deleteSchool(schoolToDelete.id);
      if (currentSchoolId === schoolToDelete.id) {
        setSchoolId('shvut-rachel');
        onSwitchSchool?.('shvut-rachel');
      }
      setSchoolToDelete(null);
    } catch (err) {
      console.error('Failed to delete school:', err);
      alert('שגיאה במחיקת המוסד');
    } finally {
      setIsDeleting(false);
    }
  };

  // Copy Direct Link to Clipboard
  const handleCopyDirectLink = (schoolId: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://ulpaquiz.web.app';
    const link = `${origin}/?school=${schoolId}`;
    navigator.clipboard.writeText(link);
    setCopiedSchoolId(schoolId);
    setTimeout(() => {
      setCopiedSchoolId(null);
    }, 2000);
  };

  // Filtered schools
  const filteredSchools = useMemo(() => {
    return availableSchools.filter((school) => {
      // Filter tab
      if (filterType === 'girls' && school.type !== 'girls') return false;
      if (filterType === 'boys' && school.type !== 'boys') return false;
      if (filterType === 'active' && school.isActive === false) return false;
      if (filterType === 'inactive' && school.isActive !== false) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = school.name.toLowerCase().includes(q);
        const matchId = school.id.toLowerCase().includes(q);
        const matchAdmin = (school.adminEmails || []).some((e) => e.toLowerCase().includes(q));
        if (!matchName && !matchId && !matchAdmin) return false;
      }

      return true;
    });
  }, [availableSchools, filterType, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = availableSchools.length;
    const active = availableSchools.filter((s) => s.isActive !== false).length;
    const girls = availableSchools.filter((s) => s.type === 'girls').length;
    const boys = availableSchools.filter((s) => s.type === 'boys').length;
    return { total, active, girls, boys };
  }, [availableSchools]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="bg-gradient-to-r from-amber-900 via-amber-800 to-amber-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-amber-700/40 relative overflow-hidden">
        <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-black">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>פאנל ניהול על (Super Admin Only)</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black font-['Heebo'] flex items-center gap-3">
              <Building2 className="w-8 h-8 text-amber-400" />
              <span>הקמה וניהול מוסדות לימוד</span>
            </h2>
            <p className="text-xs sm:text-sm text-amber-200 max-w-2xl leading-relaxed">
              מערכת רב-מוסדית מלאה (Multi-Tenant). כל מוסד מבודד לחלוטין עם מאגר תלמידים, כיתות, מנהלים, מיתוג ונוסח עברי מותאם לבנים או לבנות.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto shrink-0 flex-wrap">
            <button
              type="button"
              onClick={handleSyncManagers}
              disabled={isSyncing}
              title="סנכרן את כל מנהלי המוסדות לקולקציית managers ב-Firestore"
              className="px-4 py-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 font-black text-xs sm:text-sm rounded-2xl transition-all flex items-center gap-2 cursor-pointer"
            >
              <ShieldCheck className={`w-4 h-4 text-amber-300 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'מסנכרן...' : 'סנכרן מנהלים ל-Firestore'}</span>
            </button>
            <button
              type="button"
              onClick={refreshSchools}
              title="רענן רשימת מוסדות"
              className="p-3 bg-white/10 hover:bg-white/20 text-amber-200 rounded-2xl border border-white/10 transition-all cursor-pointer"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="px-5 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-sm rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2 cursor-pointer transform active:scale-95"
            >
              <Plus className="w-5 h-5" />
              <span>הקם ופרסם מוסד חדש</span>
            </button>
          </div>
        </div>

        {/* Sync feedback notification */}
        {syncFeedback && (
          <div className="mt-4 p-3 bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs sm:text-sm font-bold rounded-2xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{syncFeedback}</span>
          </div>
        )}

        {/* Quick KPI stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-white/10">
          <div className="bg-black/20 p-3.5 rounded-2xl border border-white/10 backdrop-blur-xs">
            <span className="text-[11px] font-bold text-amber-300 block">סה״כ מוסדות</span>
            <span className="text-2xl font-black text-white">{stats.total}</span>
          </div>
          <div className="bg-black/20 p-3.5 rounded-2xl border border-white/10 backdrop-blur-xs">
            <span className="text-[11px] font-bold text-emerald-300 block">מוסדות פעילים</span>
            <span className="text-2xl font-black text-emerald-400">{stats.active}</span>
          </div>
          <div className="bg-black/20 p-3.5 rounded-2xl border border-white/10 backdrop-blur-xs">
            <span className="text-[11px] font-bold text-rose-300 block">אולפנות / בנות</span>
            <span className="text-2xl font-black text-rose-300">{stats.girls}</span>
          </div>
          <div className="bg-black/20 p-3.5 rounded-2xl border border-white/10 backdrop-blur-xs">
            <span className="text-[11px] font-bold text-sky-300 block">ישיבות / בנים</span>
            <span className="text-2xl font-black text-sky-300">{stats.boys}</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-amber-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="חיפוש לפי שם, מזהה או אימייל..."
            className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-amber-200 bg-amber-50/50 text-xs sm:text-sm font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filterType === 'all'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
            }`}
          >
            הכל ({availableSchools.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('girls')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filterType === 'girls'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
            }`}
          >
            👧 אולפנות ({stats.girls})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('boys')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filterType === 'boys'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
            }`}
          >
            👦 ישיבות ({stats.boys})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('active')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filterType === 'active'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            פעילים ({stats.active})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('inactive')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filterType === 'inactive'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            מושבתים ({stats.total - stats.active})
          </button>
        </div>
      </div>

      {/* Schools Cards Grid */}
      {filteredSchools.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-amber-200 space-y-3">
          <Building2 className="w-12 h-12 text-amber-300 mx-auto" />
          <h3 className="text-lg font-bold text-amber-950">לא נמצאו מוסדות התואמים את החיפוש</h3>
          <p className="text-xs text-slate-500">נסה לשנות את הסינון או חפש מילה אחרת</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredSchools.map((school) => {
            const isCurrentlyManaged = school.id === currentSchoolId;
            const isBoys = school.type === 'boys';
            const themeColor = school.branding?.primaryColor || (isBoys ? '#2563eb' : '#d97706');
            const isPublished = school.isActive !== false;

            return (
              <div
                key={school.id}
                className={`bg-white rounded-3xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md ${
                  isCurrentlyManaged
                    ? 'border-amber-500 ring-2 ring-amber-500/20'
                    : 'border-amber-200/80 hover:border-amber-300'
                }`}
              >
                {/* Card Top / Header */}
                <div className="p-5 sm:p-6 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      {/* Logo or Monogram */}
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl text-white shadow-sm shrink-0 border border-black/5 overflow-hidden"
                        style={{ backgroundColor: themeColor }}
                      >
                        {school.branding?.logoUrl ? (
                          <img
                            src={school.branding.logoUrl}
                            alt={school.name}
                            className="w-full h-full object-contain p-1.5"
                            onError={(e) => {
                              // Fallback on broken image
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <span>{school.name.slice(0, 2)}</span>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-black text-slate-900 font-['Heebo']">
                            {school.name}
                          </h3>
                          {isCurrentlyManaged && (
                            <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300">
                              מוסד פעיל כעת
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-md ${
                              isBoys
                                ? 'bg-sky-50 text-sky-800 border border-sky-200'
                                : 'bg-rose-50 text-rose-800 border border-rose-200'
                            }`}
                          >
                            <span>{isBoys ? '👦 ישיבה (בנים)' : '👧 אולפנה (בנות)'}</span>
                          </span>

                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-md ${
                              isPublished
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-300'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isPublished ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            <span>{isPublished ? 'פעיל ומפורסם' : 'מושבת'}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Direct link copy */}
                    <button
                      type="button"
                      onClick={() => handleCopyDirectLink(school.id)}
                      title="העתק קישור ישיר למוסד זה (כולל פרמטר ?school=)"
                      className="p-2 rounded-xl text-slate-500 hover:text-amber-700 hover:bg-amber-50 border border-slate-200 transition-all cursor-pointer shrink-0"
                    >
                      {copiedSchoolId === school.id ? (
                        <div className="flex items-center gap-1 text-emerald-600 text-[11px] font-bold">
                          <Check className="w-4 h-4" />
                          <span>הועתק!</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[11px] font-bold">
                          <Copy className="w-4 h-4" />
                          <span className="hidden sm:inline">קישור</span>
                        </div>
                      )}
                    </button>
                  </div>

                  {/* Slug / Subdomain display */}
                  <div className="bg-slate-50 rounded-xl px-3 py-2 border border-slate-200/80 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-bold">מזהה מערכת (Slug):</span>
                    <code className="font-mono font-bold text-amber-900 bg-amber-100/60 px-2 py-0.5 rounded">
                      {school.id}
                    </code>
                  </div>

                  {/* Welcome Title Preview */}
                  {school.branding?.welcomeTitle && (
                    <div className="text-xs text-slate-600 bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
                      <span className="font-bold text-amber-950 block mb-0.5">ברכת פתיחה:</span>
                      <p className="font-medium text-slate-700">"{school.branding.welcomeTitle}"</p>
                    </div>
                  )}

                  {/* Classes & Managers stats */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className="flex items-center gap-1.5 text-slate-700 bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <GraduationCap className="w-4 h-4 text-amber-700 shrink-0" />
                      <span className="font-bold">{school.classes?.length || 0} כיתות מוגדרות</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-700 bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <Users className="w-4 h-4 text-amber-700 shrink-0" />
                      <span className="font-bold">{school.adminEmails?.length || 1} מנהלים מורשים</span>
                    </div>
                  </div>

                  {/* Classes preview tags */}
                  {school.classes && school.classes.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap text-[11px]">
                      {school.classes.slice(0, 6).map((c) => (
                        <span key={c} className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-semibold">
                          {c}
                        </span>
                      ))}
                      {school.classes.length > 6 && (
                        <span className="text-slate-400 font-bold">+{school.classes.length - 6} נוספות</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Bottom / Action Toolbar */}
                <div className="bg-slate-50/80 px-5 py-3.5 border-t border-amber-100 flex items-center justify-between gap-2 flex-wrap">
                  {/* Left: Switch school button */}
                  {isCurrentlyManaged ? (
                    <span className="text-xs font-black text-amber-700 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>מוסד זה מנוהל כעת</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setSchoolId(school.id);
                        onSwitchSchool?.(school.id);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <span>עבור לניהול מוסד זה</span>
                      <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                    </button>
                  )}

                  {/* Right Actions */}
                  <div className="flex items-center gap-1">
                    {/* Toggle publish */}
                    <button
                      type="button"
                      onClick={() => handleTogglePublish(school)}
                      title={isPublished ? 'השבת מוסד (לא יהיה נגיש לתלמידים)' : 'פרסם מוסד (אפשר גישה)'}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        isPublished
                          ? 'text-amber-800 bg-amber-100/80 border-amber-300 hover:bg-amber-200'
                          : 'text-emerald-800 bg-emerald-100/80 border-emerald-300 hover:bg-emerald-200'
                      }`}
                    >
                      {isPublished ? 'השבת' : 'פרסם'}
                    </button>

                    {/* Edit */}
                    <button
                      type="button"
                      onClick={() => openEditModal(school)}
                      title="ערוך הגדרות מוסד, מיתוג ומנהלים"
                      className="p-1.5 rounded-xl text-slate-600 hover:text-amber-700 hover:bg-white border border-transparent hover:border-slate-200 transition-all cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    {/* Clone */}
                    <button
                      type="button"
                      onClick={() => openCloneModal(school)}
                      title="שכפל מוסד זה כתבנית להקמת מוסד חדש"
                      className="p-1.5 rounded-xl text-slate-600 hover:text-amber-700 hover:bg-white border border-transparent hover:border-slate-200 transition-all cursor-pointer"
                    >
                      <CopyCheck className="w-4 h-4" />
                    </button>

                    {/* Delete */}
                    {school.id !== 'shvut-rachel' && (
                      <button
                        type="button"
                        onClick={() => setSchoolToDelete(school)}
                        title="מחק מוסד"
                        className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================
          CREATE / EDIT / CLONE MODAL WIZARD
      ========================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-amber-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-amber-900 to-amber-800 text-white p-5 sm:p-6 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/10 text-amber-300 flex items-center justify-center border border-white/10">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black font-['Heebo']">
                    {modalMode === 'create'
                      ? 'הקמת מוסד לימוד חדש'
                      : modalMode === 'edit'
                      ? `עריכת מוסד: ${name}`
                      : `שכפול מוסד: ${name}`}
                  </h3>
                  <p className="text-xs text-amber-200">
                    הגדרת זיהוי, מיתוג גרפי, שכבות וכיתות, מנהלים מורשים והגדרות פרסום
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-white/70 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Subtabs */}
            <div className="bg-amber-50/70 border-b border-amber-200 px-5 pt-3 flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0">
              <button
                type="button"
                onClick={() => setActiveFormTab('general')}
                className={`pb-2.5 px-3 text-xs font-black border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  activeFormTab === 'general'
                    ? 'border-amber-600 text-amber-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>1. פרטים ומזהה</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveFormTab('branding')}
                className={`pb-2.5 px-3 text-xs font-black border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  activeFormTab === 'branding'
                    ? 'border-amber-600 text-amber-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Palette className="w-4 h-4" />
                <span>2. מיתוג ומראה</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveFormTab('classes')}
                className={`pb-2.5 px-3 text-xs font-black border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  activeFormTab === 'classes'
                    ? 'border-amber-600 text-amber-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                <span>3. כיתות ({classes.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveFormTab('managers')}
                className={`pb-2.5 px-3 text-xs font-black border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  activeFormTab === 'managers'
                    ? 'border-amber-600 text-amber-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>4. מנהלים ({adminEmails.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveFormTab('settings')}
                className={`pb-2.5 px-3 text-xs font-black border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  activeFormTab === 'settings'
                    ? 'border-amber-600 text-amber-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>5. הגדרות ורישום</span>
              </button>
            </div>

            {/* Modal Body / Scrollable Form */}
            <form onSubmit={handleSaveForm} className="overflow-y-auto p-5 sm:p-6 space-y-6 flex-1">
              {formError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}

              {/* TAB 1: GENERAL & IDENTITY */}
              {activeFormTab === 'general' && (
                <div className="space-y-5">
                  {/* School Type Selector Cards */}
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-2">
                      סוג המוסד והתאמה מגדרית *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div
                        onClick={() => handleTypeChange('girls')}
                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3.5 ${
                          type === 'girls'
                            ? 'border-amber-500 bg-amber-50/50 shadow-xs'
                            : 'border-slate-200 hover:border-amber-200 bg-white'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-lg shrink-0">
                          👧
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm text-slate-900">אולפנה / מוסד בנות</span>
                            {type === 'girls' && <Check className="w-4 h-4 text-amber-600" />}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                            נוסח לשון נקבה ("ברוכה הבאה", "עני על החידון", תלמידות, אלופות).
                          </p>
                        </div>
                      </div>

                      <div
                        onClick={() => handleTypeChange('boys')}
                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3.5 ${
                          type === 'boys'
                            ? 'border-amber-500 bg-amber-50/50 shadow-xs'
                            : 'border-slate-200 hover:border-amber-200 bg-white'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-lg shrink-0">
                          👦
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm text-slate-900">ישיבה / מוסד בנים</span>
                            {type === 'boys' && <Check className="w-4 h-4 text-amber-600" />}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                            נוסח לשון זכר ("ברוך הבא", "ענה על החידון", תלמידים, אלופים).
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* School Name */}
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1.5">
                      שם המוסד המלא *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="לדוגמה: אולפנת אוריה / ישיבת בני עקיבא כפר הרא״ה"
                      className="w-full px-4 py-3 rounded-xl border border-amber-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  {/* Slug ID */}
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1.5">
                      מזהה מערכת ייחודי (Slug ID) *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={slugId}
                        onChange={(e) => setSlugId(e.target.value.toLowerCase().trim())}
                        disabled={modalMode === 'edit'}
                        placeholder="ulpanat-oriya / yeshivat-kfar-haroeh"
                        className={`w-full px-4 py-3 rounded-xl border font-mono text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                          modalMode === 'edit'
                            ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                            : 'border-amber-300'
                        }`}
                      />
                      {modalMode === 'edit' && (
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 bg-slate-200 px-2 py-0.5 rounded">
                          מזהה קבוע
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      משמש בקישור ישיר: <code className="text-amber-800">?school={slugId || 'slug'}</code>. אותיות קטנות באנגלית, ספרות ומקפים בלבד.
                    </p>
                  </div>

                  {/* Active / Publish toggle */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black text-slate-900 block">
                        סטטוס פרסום (פעיל / מושבת)
                      </span>
                      <p className="text-[11px] text-slate-500">
                        כאשר המוסד פעיל, תלמידים יכולים להיכנס, להירשם ולענות על החידונים היומיים.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsActive(!isActive)}
                      className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors cursor-pointer ${
                        isActive ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          isActive ? 'translate-x-1' : 'translate-x-7'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: BRANDING & APPEARANCE */}
              {activeFormTab === 'branding' && (
                <div className="space-y-5">
                  {/* Theme Color Picker */}
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-2">
                      צבע מותג ראשי
                    </label>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {COLOR_PRESETS.map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          onClick={() => setPrimaryColor(color.value)}
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                            primaryColor === color.value ? 'ring-3 ring-amber-500 ring-offset-2 scale-110' : 'hover:scale-105'
                          }`}
                          style={{ backgroundColor: color.value }}
                          title={color.label}
                        >
                          {primaryColor === color.value && <Check className="w-4 h-4 text-white" />}
                        </button>
                      ))}
                      <div className="flex items-center gap-1.5 border border-amber-300 rounded-xl px-2 py-1 bg-white">
                        <span className="text-xs font-bold text-slate-500">מותאם:</span>
                        <input
                          type="color"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                        />
                        <span className="font-mono text-xs font-bold text-slate-700">{primaryColor}</span>
                      </div>
                    </div>
                  </div>

                  {/* Logo Section with Upload and URL options */}
                  <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200/80 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-amber-700" />
                        <span>לוגו / סמל המוסד</span>
                      </label>

                      {/* Mode Toggle */}
                      <div className="flex items-center bg-white p-1 rounded-xl border border-amber-200 text-xs font-bold">
                        <button
                          type="button"
                          onClick={() => setLogoMode('upload')}
                          className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                            logoMode === 'upload'
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <UploadCloud className="w-3.5 h-3.5" />
                          <span>העלאת קובץ</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setLogoMode('url')}
                          className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                            logoMode === 'url'
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <LinkIcon className="w-3.5 h-3.5" />
                          <span>קישור (URL)</span>
                        </button>
                      </div>
                    </div>

                    {/* Hidden file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          processImageFile(file);
                        }
                        // Reset input so re-selecting same file triggers event
                        e.target.value = '';
                      }}
                    />

                    {uploadError && (
                      <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{uploadError}</span>
                      </div>
                    )}

                    {/* UPLOAD MODE */}
                    {logoMode === 'upload' && (
                      <div className="space-y-3">
                        {logoUrl ? (
                          <div className="p-4 bg-white rounded-2xl border border-amber-200 shadow-xs flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-white shrink-0 border border-slate-200 overflow-hidden shadow-xs p-1"
                                style={{ backgroundColor: primaryColor }}
                              >
                                <img
                                  src={logoUrl}
                                  alt="סמל המוסד"
                                  className="w-full h-full object-contain"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs font-black text-slate-800 block truncate">
                                  סמל מוסד פעיל
                                </span>
                                <span className="text-[11px] font-bold text-amber-700 block">
                                  {logoFileSize || (logoUrl.startsWith('data:') ? 'תמונה מוטמעת' : 'קובץ קיים')}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isProcessingLogo}
                                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-xl border border-amber-300 transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <UploadCloud className="w-3.5 h-3.5" />
                                <span>החלף לוגו</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setLogoUrl('');
                                  setLogoFileSize(null);
                                }}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 text-xs font-bold rounded-xl border border-slate-200 transition-all cursor-pointer"
                              >
                                הסר
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const file = e.dataTransfer.files?.[0];
                              if (file) processImageFile(file);
                            }}
                            className="border-2 border-dashed border-amber-300 hover:border-amber-500 rounded-2xl p-6 bg-white text-center cursor-pointer transition-all hover:bg-amber-50/30 group"
                          >
                            <div className="w-12 h-12 mx-auto mb-2 rounded-2xl bg-amber-100 group-hover:bg-amber-200 text-amber-700 flex items-center justify-center transition-all">
                              <UploadCloud className="w-6 h-6" />
                            </div>
                            <span className="text-xs sm:text-sm font-black text-slate-800 block mb-1">
                              {isProcessingLogo ? 'מעבד ומכווץ תמונה...' : 'לחצי כאן להעלאת לוגו או גררי קובץ'}
                            </span>
                            <span className="text-[11px] font-bold text-slate-500 block">
                              תמיכה בקבצי תמונה: PNG, JPG, WebP, SVG (התאמה אוטומטית של גודל)
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* URL MODE */}
                    {logoMode === 'url' && (
                      <div className="flex items-center gap-3">
                        <input
                          type="text"
                          value={logoUrl}
                          onChange={(e) => {
                            setLogoUrl(e.target.value);
                            setLogoFileSize(null);
                          }}
                          placeholder="/logo-uash.png או קישור https://..."
                          className="flex-1 px-4 py-2.5 rounded-xl border border-amber-300 text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                        />
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-white shrink-0 border border-slate-200 overflow-hidden"
                          style={{ backgroundColor: primaryColor }}
                        >
                          {logoUrl ? (
                            <img
                              src={logoUrl}
                              alt="תצוגה מקדימה"
                              className="w-full h-full object-contain p-1"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <span>{name.slice(0, 2) || 'סמל'}</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Quick Presets */}
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[11px] font-bold text-slate-500">בחירה מהירה:</span>
                      <button
                        type="button"
                        onClick={() => {
                          setLogoUrl('/logo-uash.png');
                          setLogoFileSize(null);
                        }}
                        className="text-[11px] font-bold text-amber-700 hover:underline bg-white px-2 py-1 rounded-lg border border-amber-200"
                      >
                        סמל אולפנת שבות רחל
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLogoUrl('');
                          setLogoFileSize(null);
                        }}
                        className="text-[11px] font-bold text-slate-600 hover:underline bg-white px-2 py-1 rounded-lg border border-slate-200"
                      >
                        ללא לוגו (מונוגרמה בלבד)
                      </button>
                    </div>
                  </div>

                  {/* Welcome Title */}
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1.5">
                      כותרת ברכת פתיחה ראשית
                    </label>
                    <input
                      type="text"
                      value={welcomeTitle}
                      onChange={(e) => setWelcomeTitle(e.target.value)}
                      placeholder={type === 'boys' ? 'ברוך הבא לחידון הלכה יומית' : 'ברוכה הבאה לחידון הלכה יומית'}
                      className="w-full px-4 py-2.5 rounded-xl border border-amber-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  {/* Welcome Subtitle */}
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1.5">
                      תת-כותרת / סלוגן
                    </label>
                    <input
                      type="text"
                      value={welcomeSubtitle}
                      onChange={(e) => setWelcomeSubtitle(e.target.value)}
                      placeholder={type === 'boys' ? 'לימוד יומי, צבירת נקודות ופרסים לתלמידי הישיבה' : 'לימוד יומי, צבירת נקודות ופרסים לאולפנה'}
                      className="w-full px-4 py-2.5 rounded-xl border border-amber-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  {/* Live Banner Preview */}
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <span className="text-[11px] font-black text-slate-500 block mb-2">תצוגה מקדימה של הבאנר:</span>
                    <div
                      className="p-5 rounded-2xl text-white shadow-md flex items-center gap-4"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center font-bold text-xl overflow-hidden shrink-0">
                        {logoUrl ? (
                          <img src={logoUrl} alt="לוגו" className="w-full h-full object-contain p-1" />
                        ) : (
                          <span>{name.slice(0, 2) || 'סמל'}</span>
                        )}
                      </div>
                      <div>
                        <h4 className="font-black text-base">{welcomeTitle || 'ברוכים הבאים לחידון הלכה יומית'}</h4>
                        <p className="text-xs text-white/80">{welcomeSubtitle || 'לימוד יומי, צבירת נקודות ופרסים'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: CLASSES MANAGEMENT */}
              {activeFormTab === 'classes' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h4 className="text-xs font-black text-slate-900">הגדרת כיתות ושכבות לימוד</h4>
                      <p className="text-[11px] text-slate-500">הכיתות שהתלמידים יוכלו לבחור בעת ההרשמה</p>
                    </div>

                    {/* Presets */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setClasses([...ULPANA_CLASSES_PRESET])}
                        className="text-[11px] font-bold bg-amber-100 text-amber-800 hover:bg-amber-200 px-2.5 py-1 rounded-lg transition-colors"
                      >
                        תבנית אולפנה (ט'1-יב'2)
                      </button>
                      <button
                        type="button"
                        onClick={() => setClasses([...YESHIVA_CLASSES_PRESET])}
                        className="text-[11px] font-bold bg-sky-100 text-sky-800 hover:bg-sky-200 px-2.5 py-1 rounded-lg transition-colors"
                      >
                        תבנית ישיבה (שיעור א'-ד')
                      </button>
                      <button
                        type="button"
                        onClick={() => setClasses([...JUNIOR_CLASSES_PRESET])}
                        className="text-[11px] font-bold bg-slate-100 text-slate-800 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors"
                      >
                        חטיבה (ז'-ט')
                      </button>
                      <button
                        type="button"
                        onClick={() => setClasses([])}
                        className="text-[11px] font-bold text-rose-600 hover:underline px-2 py-1"
                      >
                        נקה הכל
                      </button>
                    </div>
                  </div>

                  {/* Add Class Input */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newClassInput}
                      onChange={(e) => setNewClassInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddClass();
                        }
                      }}
                      placeholder="הזן שם כיתה, לדוגמה: ט'3 או שיעור ג' 2..."
                      className="flex-1 px-4 py-2.5 rounded-xl border border-amber-300 text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddClass}
                      className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>הוסף כיתה</span>
                    </button>
                  </div>

                  {/* Class Chips List */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-500 block mb-2">
                      כיתות מוגדרות ({classes.length}):
                    </span>
                    {classes.length === 0 ? (
                      <p className="text-xs text-rose-600 font-bold">לא הוגדרו כיתות עדיין. בחר תבנית למעלה או הוסף כיתות ידנית.</p>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        {classes.map((cls) => (
                          <div
                            key={cls}
                            className="bg-white border border-amber-200 text-amber-950 font-bold text-xs px-3 py-1.5 rounded-xl shadow-2xs flex items-center gap-2"
                          >
                            <span>{cls}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveClass(cls)}
                              className="text-slate-400 hover:text-rose-600 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: MANAGERS ASSIGNMENT */}
              {activeFormTab === 'managers' && (
                <div className="space-y-5">
                  <div>
                    <h4 className="text-xs font-black text-slate-900">מנהלים מורשים למוסד זה</h4>
                    <p className="text-[11px] text-slate-500">
                      כתובות האימייל שיקבלו הרשאות כניסה לפאנל הניהול של מוסד זה.
                    </p>
                  </div>

                  {/* Add Manager Input */}
                  <div className="flex items-center gap-2">
                    <input
                      type="email"
                      value={newEmailInput}
                      onChange={(e) => setNewEmailInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddEmail();
                        }
                      }}
                      placeholder="manager@example.com..."
                      className="flex-1 px-4 py-2.5 rounded-xl border border-amber-300 text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddEmail}
                      className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>הוסף מנהל</span>
                    </button>
                  </div>

                  {/* Manager List */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                    <span className="text-[11px] font-bold text-slate-500 block mb-1">
                      מנהלים בעלי הרשאה ({adminEmails.length}):
                    </span>
                    {adminEmails.map((email) => {
                      const isSuper = email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
                      return (
                        <div
                          key={email}
                          className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs font-bold"
                        >
                          <div className="flex items-center gap-2">
                            <ShieldCheck className={`w-4 h-4 ${isSuper ? 'text-amber-500' : 'text-slate-400'}`} />
                            <span className="text-slate-900">{email}</span>
                            {isSuper && (
                              <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-md">
                                מנהל ראשי (Super Admin)
                              </span>
                            )}
                          </div>

                          {!isSuper && (
                            <button
                              type="button"
                              onClick={() => handleRemoveEmail(email)}
                              className="text-slate-400 hover:text-rose-600 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 5: SETTINGS & REGISTRATION */}
              {activeFormTab === 'settings' && (
                <div className="space-y-5">
                  <div>
                    <h4 className="text-xs font-black text-slate-900">הגדרות הרשמה והודעות פתיחה</h4>
                    <p className="text-[11px] text-slate-500">התאמת מדיניות ההצטרפות של תלמידים חדשים למוסד</p>
                  </div>

                  {/* Allow Registration */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black text-slate-900 block">
                        אפשר הרשמה עצמאית של תלמידים
                      </span>
                      <p className="text-[11px] text-slate-500">
                        אם כבוי, תלמידים חדשים לא יוכלו להירשם באופן עצמאי למוסד זה.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAllowRegistration(!allowRegistration)}
                      className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors cursor-pointer ${
                        allowRegistration ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          allowRegistration ? 'translate-x-1' : 'translate-x-7'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Require Invitation Code */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black text-slate-900 block">
                        חייב קוד הזמנה בהרשמה
                      </span>
                      <p className="text-[11px] text-slate-500">
                        דורש מהתלמידים להזין קוד כיתה ייעודי בעת הרישום למוסד.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRequireCode(!requireCode)}
                      className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors cursor-pointer ${
                        requireCode ? 'bg-amber-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          requireCode ? 'translate-x-1' : 'translate-x-7'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Custom Welcome Message */}
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1.5">
                      הודעת פתיחה מותאמת אישית (אופציונלי)
                    </label>
                    <textarea
                      value={customWelcome}
                      onChange={(e) => setCustomWelcome(e.target.value)}
                      rows={3}
                      placeholder="הודעה מיוחדת מההנהלה או רב המוסד שתוצג בראש הדשבורד..."
                      className="w-full px-4 py-2.5 rounded-xl border border-amber-300 text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              )}

              {/* Form Navigation & Submit Button */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-black transition-colors cursor-pointer"
                >
                  ביטול
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {isSaving ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    <span>{modalMode === 'edit' ? 'עדכן ושמור שינויים' : 'הקם ופרסם מוסד'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          DELETE CONFIRMATION MODAL
      ========================================================= */}
      {schoolToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-rose-200 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 font-['Heebo']">
                  מחיקת מוסד: {schoolToDelete.name}
                </h3>
                <p className="text-xs text-slate-500">פעולה זו תמחק את הגדרות המוסד מ-Firestore</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-rose-50 p-3 rounded-xl border border-rose-100">
              האם אתה בטוח שברצונך למחוק מוסד זה? שים לב: תלמידים המשויכים למוסד זה לא יוכלו לגשת אליו עד שיועברו למוסד אחר.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSchoolToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>אישור מחיקה</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

