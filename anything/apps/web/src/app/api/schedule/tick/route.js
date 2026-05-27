import { generateReport, normalizeLanguageFilter } from "../../reports/generator.js";
import {
  ensureSchedule,
  findReportForDate,
  markScheduleRan,
} from "../../reports/store.js";
import { syncScheduleJob } from "../queue.js";
import { computeNextRunAt } from "../time.js";

function isAuthorized(request) {
  const secret = process.env.SCHEDULE_TICK_TOKEN || process.env.CRON_SECRET;
  if (!secret) return true;

  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const auth = request.headers.get("authorization") || "";

  return token === secret || auth === `Bearer ${secret}`;
}

async function handleTick(request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";
  const schedule = await ensureSchedule();
  if (!schedule || !schedule.enabled) {
    return Response.json({
      ran: false,
      reason: "schedule disabled or missing",
      force,
    });
  }
  if (
    !force &&
    (!schedule.next_run_at || new Date(schedule.next_run_at) > new Date())
  ) {
    return Response.json({
      ran: false,
      reason: "not yet due",
      next_run_at: schedule.next_run_at,
      force,
    });
  }

  const languages =
    Array.isArray(schedule.languages) && schedule.languages.length
      ? schedule.languages
      : ["all"];

  const useDify = !!(process.env.DIFY_API_URL && process.env.DIFY_API_KEY);
  const created = [];
  const skipped = [];
  const failed = [];

  for (const lang of languages) {
    const languageFilter = normalizeLanguageFilter(lang);
    if (!force && schedule.next_run_at) {
      const dueDate = new Date(schedule.next_run_at).toISOString().slice(0, 10);
      const existing = await findReportForDate(languageFilter, dueDate);
      if (existing) {
        skipped.push({
          language: lang,
          id: existing.id,
          status: existing.status,
          reason: "already generated for scheduled date",
        });
        continue;
      }
    }

    try {
      const report = await generateReport({
        language: lang,
        user: "trending-dashboard-scheduler",
        allowMock: !useDify,
      });
      created.push(report.id);
    } catch (e) {
      console.error("scheduled report generation failed", e);
      failed.push({
        language: lang,
        id: null,
        error: String(e.message || e),
      });
    }
  }

  const shouldAdvanceSchedule = created.length > 0 || skipped.length > 0;
  const next = shouldAdvanceSchedule
    ? computeNextRunAt(schedule.cron_time || "09:00")
    : null;

  if (next) {
    await markScheduleRan({ id: schedule.id, nextRunAt: next.toISOString() });
    await syncScheduleJob({ ...schedule, next_run_at: next.toISOString() });
  }

  return Response.json({
    ran: created.length > 0,
    created,
    skipped,
    failed,
    force,
    next_run_at: next?.toISOString() || schedule.next_run_at,
  });
}

export async function GET(request) {
  return handleTick(request);
}

export async function POST(request) {
  return handleTick(request);
}
