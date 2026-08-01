import React, { useEffect, useState } from 'react';
import { Student, DailyHalacha, LeaderboardData, PrizeReportItem, PrizeMilestone } from './types';
import {
  fetchStudents,
  fetchHalachot,
  fetchLeaderboardApi,
  fetchPrizesApi,
  resetDemoApi,
} from './lib/api';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { QuizModal } from './components/QuizModal';
import { MilestoneModal } from './components/MilestoneModal';
import { Leaderboards } from './components/Leaderboards';
import { AdminPanel } from './components/AdminPanel';

export default function App() {
  const [students, setStudents] = useState<Student[]>([]);
  const [halachot, setHalachot] = useState<DailyHalacha[]>([]);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardData | null>(null);
  const [prizeReports, setPrizeReports] = useState<PrizeReportItem[]>([]);

  const [currentStudentId, setCurrentStudentId] = useState<string | 'admin'>('s1');
  const [selectedDate, setSelectedDate] = useState<string>('2026-07-31');
  const [activeTab, setActiveTab] = useState<'study' | 'leaderboard' | 'admin'>('study');

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

      // Ensure valid current student if not admin
      if (currentStudentId !== 'admin' && !sData.some((s) => s.id === currentStudentId)) {
        if (sData.length > 0) setCurrentStudentId(sData[0].id);
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
    try {
      await resetDemoApi();
      await loadData();
    } catch (e) {
      console.error('Error resetting demo', e);
    }
  };

  const handleQuizSubmitted = async (
    updatedStudent: Student,
    milestones: PrizeMilestone[]
  ) => {
    // Update state & leaderboard
    await loadData();

    // Show milestone modal if any target was reached!
    if (milestones && milestones.length > 0) {
      setActiveMilestoneAlert(milestones[0]);
    }
  };

  const currentStudent = students.find((s) => s.id === currentStudentId) || students[0];

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
