import { PrizeMilestone } from '../types';

export type SchoolType = 'girls' | 'boys';

export interface SchoolBranding {
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
  schoolName?: string;
  welcomeTitle?: string;
  welcomeSubtitle?: string;
}

export interface SchoolSettings {
  allowStudentRegistration?: boolean;
  requireInvitationCode?: boolean;
  customWelcomeMessage?: string;
}

export interface School {
  id: string;
  name: string;
  type: SchoolType;
  subdomain?: string;
  branding: SchoolBranding;
  adminEmails: string[];
  classes: string[];
  prizeMilestones?: PrizeMilestone[];
  settings?: SchoolSettings;
  createdAt: string;
  isActive: boolean;
}

export interface TenantContextType {
  currentSchool: School;
  currentSchoolId: string;
  setSchoolId: (schoolId: string) => void;
  availableSchools: School[];
  genderText: ReturnType<typeof import('../lib/gender').getGenderText>;
  isSuperAdmin: boolean;
  canManageSchool: (schoolId: string) => boolean;
  refreshSchools: () => Promise<void>;
  saveSchool: (school: School) => Promise<void>;
}

export const DEFAULT_SCHOOL_ID = 'shvut-rachel';

export const DEFAULT_SCHOOLS: School[] = [
  {
    id: 'shvut-rachel',
    name: 'אולפנת שבות רחל',
    type: 'girls',
    subdomain: 'shvut-rachel',
    branding: {
      schoolName: 'אולפנת שבות רחל',
      logoUrl: '/logo-uash.png',
      primaryColor: '#d97706',
      welcomeTitle: 'ברוכה הבאה לחידון הלכה יומית',
      welcomeSubtitle: 'לימוד יומי, צבירת נקודות ופרסים לאולפנה',
    },
    adminEmails: ['skilead770@gmail.com'],
    classes: ["ט'1", "ט'2", "י'1", "י'2", "יא'1", "יא'2", "יב'1", "יב'2"],
    createdAt: '2026-09-01T00:00:00Z',
    isActive: true,
  },
  {
    id: 'yeshivat-demo',
    name: 'ישיבה תיכונית לדוגמה',
    type: 'boys',
    subdomain: 'yeshivat-demo',
    branding: {
      schoolName: 'ישיבה תיכונית לדוגמה',
      logoUrl: '',
      primaryColor: '#2563eb',
      welcomeTitle: 'ברוך הבא לחידון הלכה יומית',
      welcomeSubtitle: 'לימוד יומי, צבירת נקודות ופרסים לתלמידי הישיבה',
    },
    adminEmails: ['skilead770@gmail.com'],
    classes: ["שיעור א' 1", "שיעור א' 2", "שיעור ב' 1", "שיעור ב' 2", "שיעור ג' 1", "שיעור ג' 2", "שיעור ד' 1", "שיעור ד' 2"],
    createdAt: '2026-10-12T00:00:00Z',
    isActive: true,
  },
];
