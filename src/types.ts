export type GradeType = 'ט' | 'י' | 'יא' | 'יב';

export interface Question {
  id: string;
  text: string;
  options: [string, string, string, string]; // exactly 4 options
  correctOptionIndex: number; // 0, 1, 2, or 3
  explanation?: string;
}

export interface DailyHalacha {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  topic: string;
  source?: string; // e.g., 'ספר אהלי הלכה - הרב אהרון דרשביץ שליט"א'
  content: string;
  questions: [Question, Question, Question, Question]; // exactly 4 questions
}

export interface QuizSubmission {
  date: string;
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
  password?: string;
  points: number; // cumulative total points
  completedDates: string[]; // YYYY-MM-DD
  submissions: Record<string, QuizSubmission>;
  status?: 'approved' | 'pending' | 'rejected';
  registeredAt?: string;
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
  student: Student;
  qualifyingMilestones: PrizeMilestone[];
  nextMilestone: PrizeMilestone | null;
  pointsNeeded: number;
}
