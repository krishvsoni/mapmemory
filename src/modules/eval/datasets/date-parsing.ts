const MONTH_INDEX: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

export function parseLocomoDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const match = raw.match(/(\d{1,2}):(\d{2})\s*(am|pm)\s+on\s+(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})/i);
  if (!match) return null;
  const [, hourText, minuteText, meridiem, dayText, monthText, yearText] = match;
  const month = MONTH_INDEX[(monthText ?? '').toLowerCase()];
  if (month === undefined) return null;

  let hour = Number(hourText) % 12;
  if ((meridiem ?? '').toLowerCase() === 'pm') hour += 12;
  return new Date(Date.UTC(Number(yearText), month, Number(dayText), hour, Number(minuteText)));
}

export function parseLongMemEvalDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const match = raw.match(/(\d{4})\/(\d{2})\/(\d{2})(?:\s*\([A-Za-z]+\))?\s*(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)));
}
