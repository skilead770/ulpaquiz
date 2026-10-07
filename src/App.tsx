import React, { useEffect, useRef, useState } from 'react';
import { Student, DailyHalacha, LeaderboardData, PrizeReportItem, PrizeMilestone } from './types';
import {
  fetchStudents,
  fetchHalachot,
  fetchLeaderboardApi,
  fetchPrizesApi,
  resetDemoApi,
  setAuthToken,
  getOrCreateManagerParticipant,
  subscribeToDailyQuizDedication,
  fetchAdvanceQuizDates,
  syncAdvanceQuizAvailability,
} from './lib/api';
import {
  resolveFirebaseUserSession,
  signOutSSO,
  subscribeToAuth,
} from './lib/authService';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { QuizModal } from './components/QuizModal';
import { MilestoneModal } from './components/MilestoneModal';
import { Leaderboards } from './components/Leaderboards';
import { AdminPanel } from './components/AdminPanel';
import { RegisterPage } from './components/RegisterPage';
import { EntryScreen } from './components/EntryScreen';
import {
  getStudentQuizDateWindow,
  getTodayInJerusalem,
  uniqueQuizzesByDate,
} from './lib/quizSchedule';

export default function App() {
  const [students, setStudents] = useState<Student[]>([]);
  const [halachot, setHalachot] = useState<DailyHalacha[]>([]);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardData | null>(null);
  const [prizeReports, setPrizeReports] = useState<PrizeReportItem[]>([]);
  const [dailyQuizDedication, setDailyQuizDedication] = useState('');
  const [studentsLoadError, setStudentsLoadError] = useState<string | null>(null);
  const [isHalachotLoading, setIsHalachotLoading] = useState(false);
  const [halachotLoadError, setHalachotLoadError] = useState<string | null>(null);

  const [currentStudentId, setCurrentStudentId] = useState<string | 'admin' | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const resolvedAuthUid = useRef<string | null>(null);
  const authResolutionSequence = useRef(0);
  const [todayDate, setTodayDate] = useState(() => getTodayInJerusalem());
  const [availableQuizDates, setAvailableQuizDates] = useState<string[]>([todayDate]);
  const [selectedDate, setSelectedDate] = useState<string>(todayDate);
  const [activeTab, setActiveTab] = useState<'study' | 'leaderboard' | 'register' | 'admin'>('study');

  // Modals state
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [managerParticipant, setManagerParticipant] = useState<Student | null>(null);
  const [activeMilestoneAlert, setActiveMilestoneAlert] = useState<PrizeMilestone | null>(null);

  useEffect(() => subscribeToDailyQuizDedication(
    setDailyQuizDedication,
    (error) => console.error('[Firestore] Could not load the daily quiz dedication:', error)
  ), []);

  useEffect(() => {
    if (!isAuthReady || !currentStudentId || currentStudentId === 'admin') {
      setAvailableQuizDates([todayDate]);
      return;
    }

    let isMounted = true;
    setAvailableQuizDates([todayDate]);
    void fetchAdvanceQuizDates(todayDate)
      .then((advanceDates) => {
        if (isMounted) setAvailableQuizDates([todayDate, ...advanceDates]);
      })
      .catch((error: unknown) => {
        console.error('[Firestore] Could not load advance quiz dates:', error);
        if (isMounted) setAvailableQuizDates([todayDate]);
      });

    return () => {
      isMounted = false;
    };
  }, [currentStudentId, isAuthReady, todayDate]);

  useEffect(() => {
    if (currentStudentId !== 'admin') return;
    void syncAdvanceQuizAvailability().catch((error: unknown) => {
      console.error('[Firestore] Could not sync advance quiz dates:', error);
    });
  }, [currentStudentId]);

  const loadData = async () => {
    setIsHalachotLoading(true);
    setHalachotLoadError(null);
    const studentsLoad = fetchStudents()
      .then((loadedStudents) => {
        setStudents(loadedStudents);
        setStudentsLoadError(null);
      })
      .catch((error: unknown) => {
        console.error('[Data] Could not load students:', error);
        setStudentsLoadError(
          error instanceof Error
            ? error.message
            : 'לא ניתן לטעון את רשימת התלמידות'
        );
      });
    const isAdmin = currentStudentId === 'admin';
    const today = getTodayInJerusalem();
    let datesToFetch: string[] | undefined = undefined;
    if (!isAdmin) {
      const windowDates = getStudentQuizDateWindow(today);
      const [year, month, day] = today.split('-').map(Number);
      const pastDates = [-3, -2, -1].map((offset) =>
        new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10)
      );
      datesToFetch = Array.from(new Set([...pastDates, ...windowDates]));
    }

    const halachotLoad = fetchHalachot(datesToFetch)
      .then(setHalachot)
      .catch((error: unknown) => {
        console.error('[Data] Could not load halachot:', error);
        setHalachotLoadError(
          error instanceof Error
            ? error.message
            : 'לא ניתן לטעון את ההלכה והחידון היומי'
        );
      })
      .finally(() => setIsHalachotLoading(false));

    void Promise.allSettled([
      fetchLeaderboardApi(selectedDate),
      fetchPrizesApi(),
    ]).then(([leaderboardResult, prizesResult]) => {
      if (leaderboardResult.status === 'fulfilled') {
        setLeaderboardData(leaderboardResult.value);
      } else {
        console.error('[Data] Could not load the leaderboard:', leaderboardResult.reason);
      }
      if (prizesResult.status === 'fulfilled') {
        setPrizeReports(Array.isArray(prizesResult.value?.reports) ? prizesResult.value.reports : []);
      } else {
        console.error('[Data] Could not load prize reports:', prizesResult.reason);
      }
    });

    await Promise.allSettled([studentsLoad, halachotLoad]);
  };

  useEffect(() => {
    let isMounted = true;
    const unsubscribe = subscribeToAuth((user) => {
      const resolutionId = ++authResolutionSequence.current;
      if (!isMounted) return;
      if (!user) {
        resolvedAuthUid.current = null;
        setCurrentStudentId(null);
        setManagerParticipant(null);
        setAuthToken(null);
        setIsAuthReady(true);
        return;
      }

      void (async () => {
        try {
          const token = await user.getIdToken();
          if (!isMounted || resolutionId !== authResolutionSequence.current) return;
          setAuthToken(token);

          if (resolvedAuthUid.current === user.uid) {
            setIsAuthReady(true);
            return;
          }

          const session = await resolveFirebaseUserSession(user);

          if (!isMounted || resolutionId !== authResolutionSequence.current) return;

          if (session.role === 'admin' && session.success) {
            resolvedAuthUid.current = user.uid;
            setCurrentStudentId('admin');
            setActiveTab('admin');
          } else if (
            session.role === 'student' &&
            session.success &&
            session.student?.status === 'approved'
          ) {
            resolvedAuthUid.current = user.uid;
            setStudents((currentStudents) => [
              ...currentStudents.filter((student) => student.id !== session.student!.id),
              session.student!,
            ]);
            setCurrentStudentId(session.student.id);
            setActiveTab('study');
          } else {
            resolvedAuthUid.current = null;
            setCurrentStudentId(null);
            setStudents([]);
            setAuthToken(null);
          }
          setIsAuthReady(true);
        } catch (error) {
          console.error('[Auth] Could not restore the signed-in user session:', error);
          if (isMounted && resolutionId === authResolutionSequence.current) {
            resolvedAuthUid.current = null;
            setCurrentStudentId(null);
            setStudents([]);
            setAuthToken(null);
            setIsAuthReady(true);
          }
        }
      })();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;
    if (!currentStudentId) {
      return;
    }
    void loadData();
  }, [currentStudentId, isAuthReady, selectedDate]);

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

  const handleLoginSuccess = (user: Student | 'admin', token: string) => {
    const id = typeof user === 'string' ? user : user.id;
    if (typeof user !== 'string') {
      setStudents((currentStudents) => [
        ...currentStudents.filter((student) => student.id !== user.id),
        user,
      ]);
    }
    setCurrentStudentId(id);
    setAuthToken(token);
    setActiveTab(id === 'admin' ? 'admin' : 'study');
  };

  const handleLogout = async () => {
    setCurrentStudentId(null);
    setManagerParticipant(null);
    resolvedAuthUid.current = null;
    setAuthToken(null);
    try {
      await signOutSSO();
    } catch (error) {
      console.error('[Auth] Sign-out failed:', error);
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

  if (!isAuthReady) {
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
      />
    );
  }

  const currentStudent = currentStudentId === 'admin'
    ? null
    : students.find((student) => student.id === currentStudentId) ?? null;
  const studentDateWindow = new Set(getStudentQuizDateWindow(todayDate));
  const dashboardHalachot = (currentStudentId === 'admin'
    ? halachot
    : uniqueQuizzesByDate(halachot.filter((halacha) => studentDateWindow.has(halacha.date)))
  ).slice().sort((a, b) => a.date.localeCompare(b.date));
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
        dailyDedication={dailyQuizDedication}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24 md:pb-8">
        {activeTab === 'study' && currentStudent && (
          <Dashboard
            student={currentStudent}
            halachot={dashboardHalachot}
            isLoadingHalachot={isHalachotLoading}
            halachotLoadError={halachotLoadError}
            onRetryLoad={loadData}
            selectedDate={selectedDate}
            todayDate={todayDate}
            availableQuizDates={availableQuizDates}
            onSelectDate={(d) => setSelectedDate(d)}
            onStartQuiz={() => {
              if (
                availableQuizDates.includes(selectedDate) &&
                selectedHalacha &&
                selectedHalacha.quizEnabled !== false
              ) {
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
            studentsLoadError={studentsLoadError}
            onRefreshData={loadData}
            onManagerQuiz={handleManagerQuiz}
            onDailyDedicationChange={setDailyQuizDedication}
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
      {showQuizModal &&
        (currentStudent || managerParticipant) &&
        availableQuizDates.includes(selectedDate) &&
        selectedHalacha &&
        selectedHalacha.quizEnabled !== false && (
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
