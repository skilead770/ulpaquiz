export type GradeType = 'ט' | 'י' | 'יא' | 'יב';

export const DEFAULT_CLASSES: string[] = [
  "ט'1",
  "ט'2",
  "י'1",
  "י'2",
  "יא'1",
  "יא'2",
  "יב'1",
  "יב'2",
];

export function inferGradeFromClass(className: string): GradeType {
  const clean = (className || '').trim();
  if (clean.startsWith('יב') || clean.includes('יב')) return 'יב';
  if (clean.startsWith('יא') || clean.includes('יא')) return 'יא';
  if (clean.startsWith('י') || clean.includes("י'")) return 'י';
  return 'ט';
}

export function parseClassRank(className: string): { gradeRank: number; classNum: number; raw: string } {
  const clean = (className || '').trim();
  let gradeRank = 99;
  if (/^ז['"״\s]?|\bז\b/i.test(clean)) gradeRank = 7;
  else if (/^ח['"״\s]?|\bח\b/i.test(clean)) gradeRank = 8;
  else if (/^ט['"״\s]?|\bט\b/i.test(clean)) gradeRank = 9;
  else if (/^יב['"״\s]?|י["״]ב/i.test(clean)) gradeRank = 12;
  else if (/^יא['"״\s]?|י["״]א/i.test(clean)) gradeRank = 11;
  else if (/^י['"״\s]?|\bי\b/i.test(clean)) gradeRank = 10;

  const matchNum = clean.match(/\d+/);
  const classNum = matchNum ? parseInt(matchNum[0], 10) : 999;
  return { gradeRank, classNum, raw: clean };
}

export function compareClasses(a: string, b: string): number {
  const rankA = parseClassRank(a);
  const rankB = parseClassRank(b);
  if (rankA.gradeRank !== rankB.gradeRank) return rankA.gradeRank - rankB.gradeRank;
  if (rankA.classNum !== rankB.classNum) return rankA.classNum - rankB.classNum;
  return rankA.raw.localeCompare(rankB.raw, 'he');
}

export function sortClasses(classes: string[]): string[] {
  return [...classes].sort(compareClasses);
}

export function getStudentRegistrationDocumentId(email: string): string {
  return `s-reg-${email.trim().toLowerCase().replace(/[^a-zA-Z0-9_]/g, '_')}`;
}

export interface QuestionAuthor {
  studentId?: string;
  studentName: string;
  className: string;
}

export interface Question {
  id: string;
  text: string;
  options: [string, string, string, string]; // exactly 4 options
  correctOptionIndex: number; // 0, 1, 2, or 3
  explanation?: string;
  suggestedBy?: QuestionAuthor;
}

export interface DailyHalacha {
  id: string;
  date: string; // YYYY-MM-DD
  quizEnabled?: boolean;
  hebrewDate?: string; // e.g. "א' תשרי תשפ\"ז", "י\"ד חשון תשפ\"ז"
  title: string;
  topic: string;
  source?: string; // e.g., 'ספר אהלי הלכה'
  content: string;
  questions: [Question, Question, Question, Question]; // exactly 4 questions
  suggestedBy?: QuestionAuthor;
}

export interface QuestionSuggestion {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail?: string;
  className: string;
  grade: GradeType;
  topic: string;
  source?: string;
  questionText: string;
  options: [string, string, string, string];
  correctOptionIndex: number; // 0..3
  explanation?: string;
  status: 'pending' | 'approved' | 'rejected';
  pointsAwarded?: number;
  adminFeedback?: string;
  targetDate?: string; // YYYY-MM-DD
  createdAt: string; // ISO string
  reviewedAt?: string;
  reviewedBy?: string;
}

export type QuestionFeedbackType = 'error_report' | 'halachic_note' | 'suggestion' | 'other';

export interface QuestionFeedback {
  id: string;
  date: string; // YYYY-MM-DD
  halachaId?: string;
  halachaTitle?: string;
  questionId: string;
  questionText: string;
  studentId: string;
  studentName: string;
  studentEmail?: string;
  className: string;
  feedbackType: QuestionFeedbackType;
  comment: string;
  status: 'pending' | 'reviewed' | 'resolved';
  createdAt: string; // ISO string
  resolvedAt?: string;
  resolvedBy?: string;
  adminResponse?: string;
}

export interface QuizAvailability {
  date: string;
  availableOn: string;
  reason: 'friday' | 'erev-yom-tov';
}

export interface CustomCalendarAnnotation {
  text: string;
  mode?: 'append' | 'replace';
  updatedAt?: string;
  updatedBy?: string;
}

export type CalendarAnnotationsMap = Record<string, CustomCalendarAnnotation>;

export interface QuizSubmission {
  date: string;
  halachaId?: string;
  score: number; // 0 to 4
  earnedPoints: number; // 1 for participation, 2 if perfect 4/4
  submittedAt: string;
  answers: Record<string, number>; // questionId -> selectedOptionIndex
}

export interface Student {
  id: string;
  fullName: string;
  className: string; // e.g. "ט'1", "י'2"
  grade: GradeType;
  username: string;
  email?: string;
  password?: string;
  points: number; // cumulative total points
  completedDates: string[]; // YYYY-MM-DD
  submissions: Record<string, QuizSubmission>;
  status?: 'approved' | 'pending' | 'rejected';
  registeredAt?: string;
  invitationCode?: string;
  managerParticipation?: boolean;
}

export interface PublicStudentSummary {
  id: string;
  fullName: string;
  className: string;
  grade: GradeType;
  points: number;
  completedDates: string[];
}

export interface Invitation {
  id: string;
  code: string;
  className: string;
  grade: GradeType;
  maxUses: number;
  usedCount: number;
  createdAt: string;
  active: boolean;
}

export interface ClassLeaderboardItem {
  className: string;
  grade: GradeType;
  totalPoints: number;
  studentCount: number;
  completedTodayCount: number;
  isLeading?: boolean;
}

export interface GradeLeaderboardItem {
  grade: GradeType;
  totalPoints: number;
  studentCount: number;
  completedTodayCount: number;
  isLeading?: boolean;
}

export interface StudentLeaderboardItem {
  id: string;
  fullName: string;
  className: string;
  grade: GradeType;
  points: number;
  completedToday: boolean;
  isLeading?: boolean;
}

export interface LeaderboardData {
  topStudents: StudentLeaderboardItem[];
  classLeague: ClassLeaderboardItem[];
  gradeLeague: GradeLeaderboardItem[];
  leadingStudents: StudentLeaderboardItem[]; // handles ties for 1st place!
  leadingClasses: ClassLeaderboardItem[]; // handles ties for 1st place!
  leadingGrades: GradeLeaderboardItem[]; // handles ties for 1st place!
}

export interface PrizeMilestone {
  points: number;
  title: string;
  rewardDescription: string;
  iconName: string;
}

export interface PrizeReportItem {
  student: Pick<PublicStudentSummary, 'id' | 'fullName' | 'className' | 'grade' | 'points'>;
  qualifyingMilestones: PrizeMilestone[];
  nextMilestone: PrizeMilestone | null;
  pointsNeeded: number;
}

export interface Manager {
  email: string;
  name: string;
  role: 'superadmin' | 'admin';
  addedAt: string;
}

export type SchoolGender = 'boys' | 'girls';
export type SchoolType = 'ulpana' | 'yeshiva';

export interface GenderVocabulary {
  student: string;
  students: string;
  headmaster: string;
  teacher: string;
  coordinator: string;
  schoolTerm: string;
  school: string;
  welcome: string;
  login: string;
  register: string;
  study: string;
  leaderboard: string;
  admin: string;
  completedQuiz: string;
  earnedPoints: string;
  champion: string;
  pendingNotice: string;
  studyConfirm: string;
  registerNewStudent: string;
  studentLeague: string;
  waitingApproval: string;
  approvedStudent: string;
  noStudentsYet: string;
  congratulationsChampion: string;
}

export interface SchoolConfig {
  id: string; // unique slug e.g. "even-shmuel", "kfar-haroeh"
  name: string; // Hebrew name e.g. "אולפנת אבן שמואל"
  gender: SchoolGender;
  type: SchoolType;
  logoUrl: string;
  primaryColor: string; // hex color for buttons, badges, gradients
  themeKey?: 'amber' | 'royal-blue' | 'purple' | 'emerald' | 'navy';
  customDomain?: string;
  defaultClasses: string[];
  superAdminEmail: string;
  mainManagerEmail: string;
  mainManagerName?: string;
  createdAt: string;
  dailyDedication?: string;
  active: boolean;
}

