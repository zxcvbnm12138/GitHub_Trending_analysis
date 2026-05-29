import { ensureSchedule, updateSchedule } from "../reports/store.js";
import { syncScheduleJob } from "./queue.js";
import {
  DEFAULT_CRON_TIMES,
  computeNextRunAt,
  normalizeCronTimes,
  normalizeScheduleTimeZone,
} from "./time.js";
import { requireUser } from "../utils/user-auth.js";

export async function GET(request) {
  const guard = await requireUser(request);
  if (!guard.ok) return guard.response;

  const row = await ensureSchedule(guard.user.id);
  return Response.json({ schedule: row });
}

export async function POST(request) {
  const guard = await requireUser(request);
  if (!guard.ok) return guard.response;

  const body = await request.json();
  const row = await ensureSchedule(guard.user.id);

  const enabled =
    typeof body.enabled === "boolean" ? body.enabled : row.enabled;
  const cronTimes = normalizeCronTimes(
    Array.isArray(body.cron_times) && body.cron_times.length
      ? body.cron_times
      : row.cron_times || row.cron_time || DEFAULT_CRON_TIMES,
  );
  const timezone = normalizeScheduleTimeZone(body.timezone || row.timezone);
  const languages =
    Array.isArray(body.languages) && body.languages.length
      ? body.languages
      : row.languages;

  const next = computeNextRunAt(cronTimes, new Date(), timezone);

  const updated = await updateSchedule({
    id: row.id,
    userId: guard.user.id,
    enabled,
    cronTimes,
    timezone,
    languages,
    nextRunAt: next.toISOString(),
  });
  await syncScheduleJob(updated);

  return Response.json({ schedule: updated });
}
