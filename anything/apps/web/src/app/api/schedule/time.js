export const DEFAULT_SCHEDULE_TIMEZONE = "Asia/Shanghai";
export const DEFAULT_CRON_TIMES = ["09:00", "14:00", "22:00"];

export function normalizeScheduleTimeZone(
  timeZone,
  fallback = DEFAULT_SCHEDULE_TIMEZONE,
) {
  const candidate = typeof timeZone === "string" && timeZone.trim()
    ? timeZone.trim()
    : fallback;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format();
    return candidate;
  } catch {
    return fallback || DEFAULT_SCHEDULE_TIMEZONE;
  }
}

export function normalizeCronTime(cronTime, fallback = "09:00") {
  const [hStr, mStr] = String(cronTime).split(":");
  const rawHour = Number.parseInt(hStr, 10);
  const rawMinute = Number.parseInt(mStr, 10);
  if (
    !Number.isInteger(rawHour) ||
    rawHour < 0 ||
    rawHour > 23 ||
    !Number.isInteger(rawMinute) ||
    rawMinute < 0 ||
    rawMinute > 59
  ) {
    return fallback;
  }
  return `${String(rawHour).padStart(2, "0")}:${String(rawMinute).padStart(2, "0")}`;
}

export function normalizeCronTimes(cronTimes, fallback = DEFAULT_CRON_TIMES) {
  const values = Array.isArray(cronTimes)
    ? cronTimes
    : typeof cronTimes === "string" && cronTimes.trim()
      ? [cronTimes]
      : [];
  const normalized = values.map((value) => normalizeCronTime(value, "")).filter(Boolean);
  const unique = [...new Set(normalized)];
  const sorted = unique.sort((a, b) => minutesOfDay(a) - minutesOfDay(b));
  return sorted.length ? sorted : fallback;
}

function parseCronTime(cronTime) {
  const normalized = normalizeCronTime(cronTime);
  const [hStr, mStr] = normalized.split(":");
  return {
    hour: Number.parseInt(hStr, 10),
    minute: Number.parseInt(mStr, 10),
  };
}

function minutesOfDay(cronTime) {
  const { hour, minute } = parseCronTime(cronTime);
  return hour * 60 + minute;
}

function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
}

function offsetMs(date, timeZone) {
  const parts = zonedParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - date.getTime();
}

function zonedDateTimeToUtc(parts, timeZone) {
  const wallTime = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second || 0,
  );
  const firstOffset = offsetMs(new Date(wallTime), timeZone);
  let utc = wallTime - firstOffset;
  const finalOffset = offsetMs(new Date(utc), timeZone);
  if (finalOffset !== firstOffset) utc = wallTime - finalOffset;
  return new Date(utc);
}

function nextCalendarDate(parts) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

export function formatDateInTimeZone(date, timeZone) {
  const zone = normalizeScheduleTimeZone(timeZone);
  const parts = zonedParts(new Date(date), zone);
  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
}

export function computeNextRunAt(
  cronTimes = DEFAULT_CRON_TIMES,
  from = new Date(),
  timeZone = DEFAULT_SCHEDULE_TIMEZONE,
) {
  const zone = normalizeScheduleTimeZone(timeZone);
  const times = normalizeCronTimes(cronTimes);
  const current = zonedParts(from, zone);

  for (const cronTime of times) {
    const { hour, minute } = parseCronTime(cronTime);
    const next = zonedDateTimeToUtc(
      {
        year: current.year,
        month: current.month,
        day: current.day,
        hour,
        minute,
        second: 0,
      },
      zone,
    );
    if (next > from) return next;
  }

  const { hour, minute } = parseCronTime(times[0]);
  return zonedDateTimeToUtc(
    {
      ...nextCalendarDate(current),
      hour,
      minute,
      second: 0,
    },
    zone,
  );
}

export function reportDateFromRunAt(runAt, timeZone) {
  return formatDateInTimeZone(runAt, timeZone);
}
