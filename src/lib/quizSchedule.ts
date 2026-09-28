export function getTodayInJerusalem(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || '';

  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function getStudentQuizDateWindow(today: string = getTodayInJerusalem()): string[] {
  const [year, month, day] = today.split('-').map(Number);

  return Array.from({ length: 5 }, (_, offset) =>
    new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10)
  );
}

export function uniqueQuizzesByDate<T extends { date: string }>(quizzes: T[]): T[] {
  const seenDates = new Set<string>();

  return quizzes.filter((quiz) => {
    if (seenDates.has(quiz.date)) return false;
    seenDates.add(quiz.date);
    return true;
  });
}