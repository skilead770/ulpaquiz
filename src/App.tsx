import React, { useEffect, useState } from 'react';
import { Student, DailyHalacha, LeaderboardData, PrizeReportItem, PrizeMilestone } from './types';
import {
  fetchStudents,
  fetchHalachot,
  fetchLeaderboardApi,
  fetchPrizesApi,
  resetDemoApi,
  setAuthToken,
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

export default function App() {
  const [students, setStudents] = useState<Student[]>([]);
  const [halachot, setHalachot] = useState<DailyHalacha[]>([]);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardData | null>(null);
  const [prizeReports, setPrizeReports] = useState<PrizeReportItem[]>([]);

  // Default to null if no user is saved in localStorage, presenting the Entry Screen to newcomers!
  const [currentStudentId, setCurrentStudentId] = useState<string | 'admin' | null>(() => {
    return localStorage.getItem('halacha_current_user') || null;
  });
  const [selectedDate, setSelectedDate] = useState<string>('2026-07-31');
  const [activeTab, setActiveTab] = useState<'study' | 'leaderboard' | 'register' | 'admin'>('study');

  // Modals state
  const [showQuizModal, setShowQuizModal] = useState(false);
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
    await loadData();
    if (milestones && milestones.length > 0) {
      setActiveMilestoneAlert(milestones[0]);
    }
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'study' && currentStudent && (
          <Dashboard
            student={currentStudent}
            halachot={halachot}
            selectedDate={selectedDate}
            onSelectDate={(d) => setSelectedDate(d)}
            onStartQuiz={() => setShowQuizModal(true)}
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
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-amber-200/60 py-6 text-center text-xs text-amber-900/80 font-medium">
        <p>
          מערכת "מבצע הלכה יומית" לאולפנה • תשפ"ו • מוקדש להגדלת תורה ולהאדרתה
        </p>
      </footer>

      {/* Quiz Modal */}
      {showQuizModal && currentStudent && halachot.length > 0 && (
        <QuizModal
          student={currentStudent}
          halacha={halachot.find((h) => h.date === selectedDate) || halachot[0]}
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
