import React, { useEffect, useState } from 'react';
import { Student, DailyHalacha, LeaderboardData, PrizeReportItem, PrizeMilestone } from './types';
import {
  fetchStudents,
  fetchHalachot,
  fetchLeaderboardApi,
  fetchPrizesApi,
  resetDemoApi,
  setAuthToken,
  getOrCreateManagerParticipant,
} from './lib/api';
import { signOutSSO } from './lib/authService';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { QuizModal } from './components/QuizModal';
import { MilestoneModal } from './components/MilestoneModal';
import { Leaderboards } from './components/Leaderboards';
import { AdminPanel } from './components/AdminPanel';
import { RegisterPage } from './components/RegisterPage';
import { EntryScreen } from './components/EntryScreen';
import { getStudentQuizDateWindow, getTodayInJerusalem, uniqueQuizzesByDate } from './lib/quizSchedule';

export default function App() {
  const [students, setStudents] = useState<Student[]>([]);
  const [halachot, setHalachot] = useState<DailyHalacha[]>([]);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardData | null>(null);
  const [prizeReports, setPrizeReports] = useState<PrizeReportItem[]>([]);

  // Default to null if no user is saved in localStorage, presenting the Entry Screen to newcomers!
  const [currentStudentId, setCurrentStudentId] = useState<string | 'admin' | null>(() => {
    return localStorage.getItem('halacha_current_user') || null;
  });
  const [todayDate, setTodayDate] = useState(() => getTodayInJerusalem());
  const [selectedDate, setSelectedDate] = useState<string>(todayDate);
  const [activeTab, setActiveTab] = useState<'study' | 'leaderboard' | 'register' | 'admin'>('study');

  // Modals state
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [managerParticipant, setManagerParticipant] = useState<Student | null>(null);
  const [activeMilestoneAlert, setActiveMilestoneAlert] = useState<PrizeMilestone | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    try {
      const [sData, hData, lData, pData] = await Promise.all([
        fetchStudents(),
        fetchHalachot(),
        fetchLeaderboardApi(selectedDate),
        fetchPrizesApi(),
      ]);

      setStudents(sData);
      setHalachot(hData);
      setLeaderboardData(lData);
      setPrizeReports(pData.reports);

      // Validate saved student ID
      if (
        currentStudentId !== null &&
        currentStudentId !== 'admin' &&
        !sData.some((s) => s.id === currentStudentId)
      ) {
        // If not found, reset to entry screen
        setCurrentStudentId(null);
        localStorage.removeItem('halacha_current_user');
      }
    } catch (e) {
      console.error('Error loading data', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const currentDate = getTodayInJerusalem();
      setTodayDate((previousDate) => previousDate === currentDate ? previousDate : currentDate);
    }, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    setSelectedDate(todayDate);
  }, [todayDate]);

  const handleResetDemo = async () => {
    if (confirm('האם לאפס את כל הנתונים, הניקוד והחידונים למצב ההתחלתי?')) {
      try {
        await resetDemoApi();
        await loadData();
      } catch (e) {
        console.error('Error resetting demo', e);
      }
    }
  };

  const handleLoginSuccess = (user: Student | 'admin', token?: string) => {
    const id = typeof user === 'string' ? user : user.id;
    setCurrentStudentId(id);
    localStorage.setItem('halacha_current_user', id);
    if (token) {
      setAuthToken(token);
    }
    setActiveTab(id === 'admin' ? 'admin' : 'study');
    loadData();
  };

  const handleLogout = async () => {
    setCurrentStudentId(null);
    setManagerParticipant(null);
    localStorage.removeItem('halacha_current_user');
    setAuthToken(null);
    try {
      await signOutSSO();
    } catch (e) {
      // ignore
    }
  };

  const handleQuizSubmitted = async (
    updatedStudent: Student,
    milestones: PrizeMilestone[]
  ) => {
    if (updatedStudent.managerParticipation) {
      setManagerParticipant(updatedStudent);
    }
    await loadData();
    if (milestones && milestones.length > 0) {
      setActiveMilestoneAlert(milestones[0]);
    }
  };

  const handleManagerQuiz = async () => {
    const todaysHalacha = halachot.find((halacha) => halacha.date === todayDate);
    if (!todaysHalacha || todaysHalacha.quizEnabled === false) {
      throw new Error('אין חידון זמין להיום. יש לוודא שקיימת הלכה פעילה לתאריך של היום.');
    }

    const participant = await getOrCreateManagerParticipant();
    if (participant.completedDates.includes(todayDate)) {
      throw new Error('כבר השתתפת בחידון היומי.');
    }

    setSelectedDate(todayDate);
    setManagerParticipant(participant);
    setShowQuizModal(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-amber-50/40 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-extrabold text-amber-950 text-base font-['Heebo']">
            טוען את מערכת "מבצע הלכה יומית"...
          </p>
        </div>
      </div>
    );
  }

  // If no user is logged in (First time entering), display the simple Entry Screen!
  if (!currentStudentId) {
    return (
      <EntryScreen
        onLoginSuccess={handleLoginSuccess}
        students={students}
      />
    );
  }

  const currentStudent = students.find((s) => s.id === currentStudentId) || (currentStudentId !== 'admin' ? students[0] : null);
  const studentDateWindow = new Set(getStudentQuizDateWindow(todayDate));
  const dashboardHalachot = currentStudentId === 'admin'
    ? halachot
    : uniqueQuizzesByDate(halachot.filter((halacha) => studentDateWindow.has(halacha.date)));
  const selectedHalacha = dashboardHalachot.find((halacha) => halacha.date === selectedDate);

  return (
    <div className="min-h-screen flex flex-col bg-amber-50/40 text-slate-800 font-['Assistant',sans-serif]">
      {/* Navbar Header */}
      <Navbar
        students={students}
        currentStudentId={currentStudentId}
        onSelectUser={(id) => setCurrentStudentId(id)}
        activeTab={activeTab}
        onChangeTab={(tab) => setActiveTab(tab)}
        onResetDemo={handleResetDemo}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 md:pb-8">
        {activeTab === 'study' && currentStudent && (
          <Dashboard
            student={currentStudent}
            halachot={dashboardHalachot}
            selectedDate={selectedDate}
            todayDate={todayDate}
            onSelectDate={(d) => setSelectedDate(d)}
            onStartQuiz={() => {
              if (selectedDate === todayDate && selectedHalacha && selectedHalacha.quizEnabled !== false) {
                setShowQuizModal(true);
              }
            }}
            onViewLeaderboards={() => setActiveTab('leaderboard')}
          />
        )}

        {activeTab === 'leaderboard' && currentStudent && (
          <Leaderboards
            currentStudent={currentStudent}
            leaderboardData={leaderboardData}
            selectedDate={selectedDate}
          />
        )}

        {activeTab === 'register' && (
          <RegisterPage
            onRegistrationSuccess={loadData}
            onGoToStudy={() => setActiveTab('study')}
            students={students}
          />
        )}

        {(activeTab === 'admin' || currentStudentId === 'admin') && (
          <AdminPanel
            students={students}
            halachot={halachot}
            prizeReports={prizeReports}
            onRefreshData={loadData}
            onManagerQuiz={handleManagerQuiz}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-amber-200/60 py-6 px-4 text-center text-xs text-amber-900/80 font-medium mb-16 md:mb-0">
        <p className="max-w-xl mx-auto leading-relaxed">
          מערכת "חידון הלכה יומית" לאולפנה • תשפ"ז • על פי פסקי הלכה של הגאון הרב יעקב אריאל שליט"א • מוקדש להגדלת תורה ולהאדרתה
        </p>
      </footer>

      {/* Quiz Modal */}
      {showQuizModal && (currentStudent || managerParticipant) && selectedDate === todayDate && selectedHalacha && selectedHalacha.quizEnabled !== false && (
        <QuizModal
          student={currentStudent || managerParticipant!}
          halacha={selectedHalacha}
          onClose={() => setShowQuizModal(false)}
          onQuizSubmitted={handleQuizSubmitted}
        />
      )}

      {/* Milestone Alert Modal */}
      {activeMilestoneAlert && (
        <MilestoneModal
          milestone={activeMilestoneAlert}
          onClose={() => setActiveMilestoneAlert(null)}
        />
      )}
    </div>
  );
}
