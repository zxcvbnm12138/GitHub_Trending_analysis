import { ensureSchedule, updateSchedule } from "../reports/store.js";
import { syncScheduleJob } from "./queue.js";
import { computeNextRunAt } from "./time.js";

export async function GET() {
  const row = await ensureSchedule();
  return Response.json({ schedule: row });
}

export async function POST(request) {
  const body = await request.json();
  const row = await ensureSchedule();

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
    enabled,
    cronTime,
    languages,
    nextRunAt: next.toISOString(),
  });
  await syncScheduleJob(updated);

  return Response.json({ schedule: updated });
}
