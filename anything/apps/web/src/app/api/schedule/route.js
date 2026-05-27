import { ensureSchedule, updateSchedule } from "../reports/store.js";
import { syncScheduleJob } from "./queue.js";
import { computeNextRunAt } from "./time.js";
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
  const cronTime = body.cron_time || row.cron_time;
  const languages =
    Array.isArray(body.languages) && body.languages.length
      ? body.languages
      : row.languages;

  const next = computeNextRunAt(cronTime);

  const updated = await updateSchedule({
    id: row.id,
    userId: guard.user.id,
    enabled,
    cronTime,
    languages,
    nextRunAt: next.toISOString(),
  });
  await syncScheduleJob(updated);

  return Response.json({ schedule: updated });
}
