import * as Hebcal from '@hebcal/core';
import { DailyHalacha, CustomCalendarAnnotation } from '../../types';
import { stripHebrewVowels } from './aiHelpers';

export const hebrewWeekdays = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export const halachaHebrewYear = 5787;
export const halachaHebrewYearText = 'תשפ״ז';
const hebcalEventsByYear = new Map<number, ReturnType<typeof Hebcal.calendar>>();

export function hebrewDayNumber(day: number) {
  const units = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  if (day === 15) return 'טו';
  if (day === 16) return 'טז';
  if (day < 10) return units[day];
  if (day < 20) return `י${units[day - 10]}`;
  if (day === 30) return 'ל';
  return `כ${units[day - 20]}`;
}

export function getHebcalEventsForYear(year: number) {
  let events = hebcalEventsByYear.get(year);
  if (!events) {
    events = Hebcal.calendar({ year, isHebrewYear: true, il: true, sedrot: true });
    hebcalEventsByYear.set(year, events);
  }
  return events;
}

export function makeHebrewCalendarEntry(
  date: Hebcal.HDate,
  halacha: DailyHalacha | null,
  customAnnotation?: CustomCalendarAnnotation | null
) {
  const parshaEvent = getHebcalEventsForYear(date.getFullYear()).find(
    (event) => event.getDate().abs() === date.abs() && event.getDesc().startsWith('Parashat ')
  );
  const holidayNames = (Hebcal.getHolidaysOnDate(date, true) || []).map((event) =>
    stripHebrewVowels(event.render('he'))
  );
  const parsha = parshaEvent ? stripHebrewVowels(parshaEvent.render('he')) : '';
  const uniqueHolidays = Array.from(new Set(holidayNames));
  const defaultAnnotations = [parsha, ...uniqueHolidays].filter(Boolean);

  let finalAnnotations = defaultAnnotations;
  const customText = customAnnotation?.text?.trim();
  if (customText) {
    if (customAnnotation?.mode === 'replace') {
      finalAnnotations = [customText];
    } else {
      finalAnnotations = [...defaultAnnotations, customText];
    }
  }

  const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

  return {
    halacha,
    date,
    dateKey,
    monthKey: `${date.getFullYear()}-${date.getMonth()}`,
    dayLabel: hebrewDayNumber(date.getDate()),
    weekday: hebrewWeekdays[date.getDay()],
    parsha,
    holidayNames: uniqueHolidays,
    defaultAnnotations,
    annotations: finalAnnotations,
    customAnnotation: customAnnotation || null,
  };
}

export type HebrewCalendarDayEntry = ReturnType<typeof makeHebrewCalendarEntry>;

export function parseDocumentHebrewHeading(line: string) {
  const heading = line.replace(/\*/g, '').replace(/^[#*-]\s*/, '').trim();
  const weekdayMatch = heading.match(/^(?:יום\s+)?(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)(?:\s|$)/);
  const dateHeading = heading.replace(/^(?:יום\s+)?(?:ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)\s+/, '');
  const dateMatch = dateHeading.match(
    /^([א-ת][א-ת״׳"']*)\s+(?:ב)?(תשרי|מרחשוון|מרחשון|חשוון|חשון|כסלו|טבת|שבט|אדר\s*[אב](?:[״׳"']?)?|ניסן|אייר|סיון|סיוון|תמוז|אב|אלול)(?=$|[\s,])/u
  );

  if (!dateMatch) return null;

  const dateText = dateMatch[0].trim().replace(/"/g, '״').replace(/'/g, '׳');
  let date: Hebcal.HDate;
  try {
    date = Hebcal.HDate.fromGematriyaString(`${dateText} ${halachaHebrewYearText}`);
  } catch {
    return null;
  }

  const calendarWeekday = hebrewWeekdays[date.getDay()];
  const hasShabbatLabel = /(?:^|[\s,])שבת(?:\s|$)/.test(heading);
  if (hasShabbatLabel && calendarWeekday !== 'שבת') {
    throw new Error(
      `אי התאמה בכותרת "${heading}": התאריך לפי לוח תשפ״ז חל ביום ${calendarWeekday}, אך הכותרת מציינת שבת ופרשה.`
    );
  }

  const weekdayCorrection = weekdayMatch && weekdayMatch[1] !== calendarWeekday
    ? `${weekdayMatch[1]} → ${calendarWeekday}`
    : '';
  const normalizedHeading = weekdayCorrection
    ? heading.replace(/^(יום\s+)?(?:ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)(?=\s)/, (_, prefix = '') => `${prefix}${calendarWeekday}`)
    : heading;

  const gregorianParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date.greg());
  const gregorianDate = ['year', 'month', 'day']
    .map((part) => gregorianParts.find((value) => value.type === part)?.value)
    .join('-');

  return { date, gregorianDate, heading: normalizedHeading, weekdayCorrection };
}

export function makeHebrewDateEntry(halacha: DailyHalacha) {
  try {
    const parsedHeading = parseDocumentHebrewHeading(halacha.hebrewDate || '');
    if (!parsedHeading || parsedHeading.date.getFullYear() !== halachaHebrewYear) return null;
    return makeHebrewCalendarEntry(parsedHeading.date, halacha);
  } catch {
    return null;
  }
}
