import * as Hebcal from '@hebcal/core';
import type { QuizAvailability } from '../types';

const hebcalEventsByYear = new Map<number, ReturnType<typeof Hebcal.calendar>>();

function parseHebrewCalendarDate(gregorianDate: string): Hebcal.HDate | null {
  const match = gregorianDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, year, month, day] = match;
  const gregorian = new Date(Number(year), Number(month) - 1, Number(day), 12);
  if (
    gregorian.getFullYear() !== Number(year) ||
    gregorian.getMonth() !== Number(month) - 1 ||
    gregorian.getDate() !== Number(day)
  ) {
    return null;
  }
  return new Hebcal.HDate(gregorian);
}

function getHebcalEventsForDate(date: Hebcal.HDate) {
  let events = hebcalEventsByYear.get(date.getFullYear());
  if (!events) {
    events = Hebcal.calendar({ year: date.getFullYear(), isHebrewYear: true, il: true, sedrot: true });
    hebcalEventsByYear.set(date.getFullYear(), events);
  }
  return events.filter((event) => event.getDate().abs() === date.abs());
}

function isYomTovDate(gregorianDate: string): boolean {
  const date = parseHebrewCalendarDate(gregorianDate);
  if (!date) return false;
  return getHebcalEventsForDate(date).some((event) => (event.getFlags() & Hebcal.flags.CHAG) !== 0);
}

function isShabbatOrYomTovDate(gregorianDate: string): boolean {
  const date = parseHebrewCalendarDate(gregorianDate);
  if (!date) return false;
  return date.getDay() === 6 || isYomTovDate(gregorianDate);
}

function getNextGregorianDate(gregorianDate: string): string | null {
  const match = gregorianDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return null;
  }
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

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

export function getAvailableQuizDates(today: string = getTodayInJerusalem()): string[] {
  const todayHebrewDate = parseHebrewCalendarDate(today);
  const tomorrow = getNextGregorianDate(today);
  if (!todayHebrewDate || !tomorrow) return [];

  const canAnswerAhead = todayHebrewDate.getDay() === 5 || isYomTovDate(tomorrow);
  if (!canAnswerAhead) return [today];

  const availableDates = [today];
  let nextDate: string | null = tomorrow;
  while (nextDate && isShabbatOrYomTovDate(nextDate)) {
    availableDates.push(nextDate);
    nextDate = getNextGregorianDate(nextDate);
  }
  return availableDates;
}

export function getUpcomingQuizAvailability(
  today: string = getTodayInJerusalem(),
  daysAhead = 370
): QuizAvailability[] {
  const availabilityByDate = new Map<string, QuizAvailability>();
  let sourceDate: string | null = today;

  for (let offset = 0; offset < daysAhead && sourceDate; offset += 1) {
    const sourceHebrewDate = parseHebrewCalendarDate(sourceDate);
    const nextDate = getNextGregorianDate(sourceDate);
    if (!sourceHebrewDate || !nextDate) break;

    const reason = sourceHebrewDate.getDay() === 5
      ? 'friday'
      : isYomTovDate(nextDate)
        ? 'erev-yom-tov'
        : null;
    if (reason) {
      getAvailableQuizDates(sourceDate).slice(1).forEach((date) => {
        if (!availabilityByDate.has(date)) {
          availabilityByDate.set(date, { date, availableOn: sourceDate!, reason });
        }
      });
    }
    sourceDate = nextDate;
  }

  return Array.from(availabilityByDate.values());
}

export function isQuizDateAvailable(today: string, quizDate: string): boolean {
  return getAvailableQuizDates(today).includes(quizDate);
}

export function getHebrewDateOnly(gregorianDate: string): string {
  const hDate = parseHebrewCalendarDate(gregorianDate);
  if (!hDate) return '';
  const cleaned = hDate
    .renderGematriya()
    .replace(/[\u0591-\u05C7]/g, '')
    .replace(/׳/g, "'")
    .replace(/״/g, '"')
    .trim();
  const parts = cleaned.split(/\s+/);
  // Remove the Hebrew year (the last part) to keep strictly [Day in gematriya] [Month]
  return parts.length > 1 ? parts.slice(0, -1).join(' ') : cleaned;
}

export function formatShortHebrewDateLabel(hebrewDate?: string): string {
  if (!hebrewDate) return '';
  const trimmed = hebrewDate.trim();
  if (!trimmed || trimmed.length > 50) return '';

  // Extract day and month if present in hebrewDate (e.g. "יום שישי ח' בטבת", "כ\"ב אלול תשפ\"ז", "ט' באלול, שבת פרשת כי תצא")
  const match = trimmed.match(
    /([א-ת]['"״׳]?[א-ת]?)\s+(ב?(?:תשרי|חשון|מרחשון|כסלו|טבת|שבט|אדר(?:\s+(?:[אב]'|ראשון|שני))?|ניסן|אייר|סיון|סיוון|תמוז|אב|אלול))/
  );
  if (match) {
    const day = match[1].replace(/׳/g, "'").replace(/״/g, '"');
    const month = match[2];
    return `${day} ${month}`;
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    const monthNames = ['תשרי', 'חשון', 'כסלו', 'טבת', 'שבט', 'אדר', 'אייר', 'סיוון', 'תמוז', 'אב', 'אלול'];
    if (monthNames.some((m) => parts[1].includes(m))) {
      return `${parts[0]} ${parts[1]}`;
    }
  }

  return '';
}

export function getHebrewDayAndDateLabel(gregorianDate: string): string {
  const [y, m, d] = gregorianDate.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d, 12, 0, 0);
  const dayIndex = dateObj.getDay();
  const dayNames = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'];
  const dayName = dayNames[dayIndex] || '';

  const hebDateOnly = getHebrewDateOnly(gregorianDate);
  if (hebDateOnly) {
    return `${dayName} | ${hebDateOnly}`;
  }

  return `${dayName} | ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

function getShabbatLabel(gregorianDate: string): string | null {
  const date = parseHebrewCalendarDate(gregorianDate);
  if (!date) return null;
  if (date.getDay() !== 6) return null;

  const shabbatEvents = getHebcalEventsForDate(date);
  const parshaEvent = shabbatEvents.find((event) => event.getDesc().startsWith('Parashat '));
  if (parshaEvent) {
    const parsha = parshaEvent.render('he')
      .replace(/[\u0591-\u05C7]/g, '')
      .trim()
      .replace(/^פרשת\s*/, '');
    return `שבת פרשת ${parsha}`;
  }

  const holidayEvent = shabbatEvents.find((event) => !event.getDesc().startsWith('Parashat '));
  if (!holidayEvent) return 'שבת';

  const holiday = holidayEvent.render('he').replace(/[\u0591-\u05C7]/g, '').trim();
  return `שבת ${holiday}`;
}

export function formatQuizDateLabel(hebrewDate: string | undefined, gregorianDate: string): string {
  const hebDateOnly = formatShortHebrewDateLabel(hebrewDate) || getHebrewDateOnly(gregorianDate) || gregorianDate;
  const shabbatLabel = getShabbatLabel(gregorianDate);
  if (shabbatLabel) {
    return `${shabbatLabel} • ${hebDateOnly}`;
  }

  const [y, m, d] = gregorianDate.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d, 12, 0, 0);
  const dayNames = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'];
  const dayName = dayNames[dateObj.getDay()] || '';

  return dayName ? `${dayName} • ${hebDateOnly}` : hebDateOnly;
}

export function uniqueQuizzesByDate<T extends { date: string }>(quizzes: T[]): T[] {
  const seenDates = new Set<string>();

  return quizzes.filter((quiz) => {
    if (seenDates.has(quiz.date)) return false;
    seenDates.add(quiz.date);
    return true;
  });
}