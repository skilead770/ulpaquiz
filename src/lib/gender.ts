import { SchoolType } from '../types/tenant';
import { PrizeMilestone } from '../types';

export interface GenderVocabulary {
  welcomeGreeting: string;
  student: string;
  students: string;
  login: string;
  loginPrompt: string;
  register: string;
  registered: string;
  registerPrompt: string;
  institutionType: string;
  institutionManagement: string;
  institutionHead: string;
  institutionCoordinator: string;
  welcomePlural: string;
  newStudentRegistration: string;
  registerAnotherStudent: string;
  enterDailyQuiz: string;
  startQuiz: string;
  checkYourself: string;
  completedQuiz: string;
  completedTodayNotice: string;
  congratsAllCorrect: string;
  congratsScore: (score: number) => string;
  champion: string;
  persistent: string;
  outstanding: string;
  leadingStudent: string;
  leadingStudents: string;
  studentPossessive: string;
  studentsPossessive: string;
  chooseClass: string;
  submitAnswers: string;
  confirmReadHalacha: string;
  managerRole: string;
  managersRole: string;
  managerQuizParticipation: string;
  approveStudent: string;
  rejectStudent: string;
  addStudent: string;
  studentListTitle: string;
  pendingStudentsTitle: string;
  defaultPrizeMilestones: PrizeMilestone[];
}

export function getGenderText(type: SchoolType = 'girls'): GenderVocabulary {
  const isBoys = type === 'boys';

  return {
    welcomeGreeting: isBoys
      ? 'ברוך הבא לחידון הלכה יומית'
      : 'ברוכה הבאה לחידון הלכה יומית',
    student: isBoys ? 'תלמיד' : 'תלמידה',
    students: isBoys ? 'תלמידים' : 'תלמידות',
    studentPossessive: isBoys ? 'של התלמיד' : 'של התלמידה',
    studentsPossessive: isBoys ? 'של התלמידים' : 'של התלמידות',
    login: isBoys ? 'התחבר' : 'התחברי',
    loginPrompt: isBoys ? 'התחבר לחשבונך' : 'התחברי לחשבונך',
    register: isBoys ? 'הירשם' : 'הירשמי',
    registered: isBoys ? 'רשום' : 'רשומה',
    registerPrompt: isBoys ? 'הירשם למערכת' : 'הירשמי למערכת',
    chooseClass: isBoys ? 'בחר כיתה' : 'בחרי כיתה',
    submitAnswers: isBoys ? 'הגש תשובות' : 'הגישי תשובות',
    confirmReadHalacha: 'קראתי ולמדתי את ההלכה לפני המענה על השאלות',
    managerRole: isBoys ? 'מנהל' : 'מנהלת',
    managersRole: isBoys ? 'מנהלים' : 'מנהלות',
    managerQuizParticipation: isBoys ? 'השתתפות כמנהל' : 'השתתפות כמנהלת',
    approveStudent: isBoys ? 'אישור תלמיד' : 'אישור תלמידה',
    rejectStudent: isBoys ? 'דחיית תלמיד' : 'דחיית תלמידה',
    addStudent: isBoys ? 'הוספת תלמיד' : 'הוספת תלמידה',
    studentListTitle: isBoys ? 'רשימת תלמידים' : 'רשימת תלמידות',
    pendingStudentsTitle: isBoys ? 'תלמידים ממתינים לאישור' : 'תלמידות ממתינות לאישור',
    institutionType: isBoys ? 'ישיבה' : 'אולפנה',
    institutionManagement: isBoys ? 'הנהלת הישיבה' : 'הנהלת האולפנה',
    institutionHead: isBoys ? 'ראש הישיבה' : 'ראש האולפנה',
    institutionCoordinator: isBoys ? 'רכז ההלכה בישיבה' : 'רכזת ההלכה באולפנה',
    welcomePlural: isBoys ? 'ברוכים הבאים' : 'ברוכות הבאות',
    newStudentRegistration: isBoys ? 'הרשמת תלמיד חדש' : 'הרשמת תלמידה חדשה',
    registerAnotherStudent: isBoys ? 'הרשמת תלמיד נוסף' : 'הרשמת תלמידה נוספת',
    enterDailyQuiz: isBoys ? 'היכנס לחידון היומי' : 'היכנסי לחידון היומי',
    startQuiz: isBoys ? 'התחל חידון' : 'התחילי חידון',
    checkYourself: isBoys ? 'בחן את עצמך' : 'בחני את עצמך',
    completedQuiz: isBoys ? 'ענה על החידון' : 'ענתה על החידון',
    completedTodayNotice: 'כבר ענית על החידון להיום! כל הכבוד על ההתמדה.',
    congratsAllCorrect: 'כל הכבוד! ענית נכון על כל השאלות!',
    congratsScore: (score: number) =>
      `כל הכבוד! ענית נכון על ${score} מתוך 4 שאלות!`,
    champion: isBoys ? 'אלוף' : 'אלופה',
    persistent: isBoys ? 'מתמיד' : 'מתמידה',
    outstanding: isBoys ? 'מצטיין' : 'מצטיינת',
    leadingStudent: isBoys ? 'תלמיד מוביל' : 'תלמידה מובילה',
    leadingStudents: isBoys ? 'תלמידים מובילים' : 'תלמידות מובילות',
    defaultPrizeMilestones: [
      {
        points: 10,
        title: isBoys ? 'מצטיין התחלה' : 'מצטיינת התחלה',
        rewardDescription: isBoys
          ? 'סימניה מעוצבת + ארטיק בהפסקה'
          : 'סימניה מעוצבת לאולפנה + ארטיק בהפסקה',
        iconName: 'Bookmark',
      },
      {
        points: 25,
        title: isBoys ? 'לומד מתמיד' : 'לומדת מתמידה',
        rewardDescription: 'כרטיס גירוד פרסים אישי / מחברת מעוצבת',
        iconName: 'BookOpen',
      },
      {
        points: 50,
        title: isBoys ? 'אלוף ההלכה' : 'אלופת ההלכה',
        rewardDescription: isBoys
          ? 'ספר הלכה יוקרתי עם הקדשה אישית מראש הישיבה'
          : 'ספר הלכה יוקרתי עם הקדשה אישית מראש האולפנה',
        iconName: 'Award',
      },
      {
        points: 100,
        title: 'כתר תורה',
        rewardDescription: 'שובר מתנה לקניית ספרים / ארוחת בוקר חגיגית עם הצוות',
        iconName: 'Crown',
      },
    ],
  };
}
