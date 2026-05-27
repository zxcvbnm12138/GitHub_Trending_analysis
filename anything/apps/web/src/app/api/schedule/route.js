import { ensureSchedule, updateSchedule } from "@/app/api/reports/store";

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

  // compute next_run_at from cron_time today; if past, tomorrow
  const [hStr, mStr] = String(cronTime).split(":");
  const h = parseInt(hStr, 10) || 9;
  const m = parseInt(mStr, 10) || 0;
  const now = new Date();
  const next = new Date(now);
  next.setHours(h, m, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);

  const updated = await updateSchedule({
    id: row.id,
    enabled,
    cronTime,
    languages,
    nextRunAt: next.toISOString(),
  });

  return Response.json({ schedule: updated });
}
