import {
  Student,
  DailyHalacha,
  LeaderboardData,
  PrizeReportItem,
  PrizeMilestone,
} from '../types';

export async function fetchStudents(): Promise<Student[]> {
  const res = await fetch('/api/students');
  if (!res.ok) throw new Error('Failed to fetch students');
  return res.json();
}

export async function fetchHalachot(): Promise<DailyHalacha[]> {
  const res = await fetch('/api/halachot');
  if (!res.ok) throw new Error('Failed to fetch halachot');
  return res.json();
}

export async function fetchHalachaByDate(date: string): Promise<DailyHalacha> {
  const res = await fetch(`/api/halachot/${date}`);
  if (!res.ok) throw new Error('Failed to fetch halacha for date');
  return res.json();
}

export async function submitQuizApi(
  studentId: string,
  date: string,
  answers: Record<string, number>
) {
  const res = await fetch('/api/submit-quiz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId, date, answers }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'נכשלה הגשת החידון');
  }
  return data;
}

export async function fetchLeaderboardApi(date: string): Promise<LeaderboardData> {
  const res = await fetch(`/api/leaderboard?date=${date}`);
  if (!res.ok) throw new Error('Failed to fetch leaderboard');
  return res.json();
}

export async function fetchPrizesApi(): Promise<{
  reports: PrizeReportItem[];
  milestones: PrizeMilestone[];
}> {
  const res = await fetch('/api/prizes');
  if (!res.ok) throw new Error('Failed to fetch prizes');
  return res.json();
}

export async function bulkImportStudentsApi(students: Partial<Student>[]) {
  const res = await fetch('/api/students/bulk-import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ students }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'נכשלה ייבוא התלמידות');
  return data;
}

export async function addStudentApi(student: Partial<Student>) {
  const res = await fetch('/api/students', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(student),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'נכשלה הוספת התלמידה');
  return data;
}

export async function deleteStudentApi(id: string) {
  const res = await fetch(`/api/students/${id}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'נכשלה מחיקת התלמידה');
  return data;
}

export async function saveHalachaApi(halacha: DailyHalacha) {
  const res = await fetch('/api/halachot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(halacha),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'נכשלה שמירת ההלכה');
  return data;
}

export async function deleteHalachaApi(id: string) {
  const res = await fetch(`/api/halachot/${id}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'נכשלה מחיקת ההלכה');
  return data;
}

export async function generateAiHalachaApi(topic: string, date: string) {
  const res = await fetch('/api/admin/generate-ai-halacha', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, date }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'נכשלה יצירת ההלכה');
  return data;
}

export async function registerStudentApi(studentData: {
  fullName: string;
  grade: string;
  className: string;
  username: string;
  password?: string;
}) {
  const res = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(studentData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'נכשלה הרשמת התלמידה');
  return data;
}

export async function approveStudentApi(id: string) {
  const res = await fetch(`/api/students/${id}/approve`, {
    method: 'POST',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'נכשל אישור התלמידה');
  return data;
}

export async function rejectStudentApi(id: string) {
  const res = await fetch(`/api/students/${id}/reject`, {
    method: 'POST',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'נכשלה דחיית התלמידה');
  return data;
}

export async function resetDemoApi() {
  const res = await fetch('/api/reset-demo', {
    method: 'POST',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'נכשל איפוס הנתונים');
  return data;
}
