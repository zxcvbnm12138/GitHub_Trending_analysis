import { generateReport } from "../../reports/generator.js";
import {
  listEnabledSchedules,
  markScheduleRan,
} from "../../reports/store.js";
import { syncScheduleJob } from "../queue.js";
import {
  DEFAULT_CRON_TIMES,
  computeNextRunAt,
  normalizeCronTimes,
  normalizeScheduleTimeZone,
  reportDateFromRunAt,
} from "../time.js";
import { getRuntimeConfig } from "../../utils/app-config.js";

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
  const schedules = await listEnabledSchedules();
  if (!schedules.length) {
    return Response.json({
      ran: false,
      reason: "schedule disabled or missing",
      force,
    });
  }

  const runtime = await getRuntimeConfig();
  const useDify = runtime.dify.configured;
  const created = [];
  const skipped = [];
  const failed = [];
  let nextRunAt = null;

  for (const schedule of schedules) {
    if (
      !force &&
      (!schedule.next_run_at || new Date(schedule.next_run_at) > new Date())
    ) {
      skipped.push({
        schedule_id: schedule.id,
        user_id: schedule.user_id,
        reason: "not yet due",
        next_run_at: schedule.next_run_at,
      });
      nextRunAt = nextRunAt || schedule.next_run_at;
      continue;
    }

    const languages =
      Array.isArray(schedule.languages) && schedule.languages.length
        ? schedule.languages
        : ["all"];
    const timezone = normalizeScheduleTimeZone(schedule.timezone);
    const cronTimes = normalizeCronTimes(schedule.cron_times || schedule.cron_time);
    const reportDate = schedule.next_run_at
      ? reportDateFromRunAt(schedule.next_run_at, timezone)
      : undefined;

    const scheduleCreated = [];

    for (const lang of languages) {
      try {
        const report = await generateReport({
          userId: schedule.user_id,
          language: lang,
          user: `trending-dashboard-user-${schedule.user_id}-scheduler`,
          allowMock: !useDify,
          reportDate,
        });
        const item = {
          schedule_id: schedule.id,
          user_id: schedule.user_id,
          language: lang,
          id: report.id,
        };
        created.push(item);
        scheduleCreated.push(item);
      } catch (e) {
        console.error("scheduled report generation failed", e);
        failed.push({
          schedule_id: schedule.id,
          user_id: schedule.user_id,
          language: lang,
          id: null,
          error: String(e.message || e),
        });
      }
    }

    const shouldAdvanceSchedule = scheduleCreated.length > 0;
    const next = shouldAdvanceSchedule
      ? computeNextRunAt(cronTimes || DEFAULT_CRON_TIMES, new Date(), timezone)
      : null;

    if (next) {
      nextRunAt = next.toISOString();
      await markScheduleRan({
        id: schedule.id,
        userId: schedule.user_id,
        nextRunAt: nextRunAt,
      });
      await syncScheduleJob({ ...schedule, next_run_at: nextRunAt });
    }
  }

  return Response.json({
    ran: created.length > 0,
    created,
    skipped,
    failed,
    force,
    next_run_at: nextRunAt,
  });
}

export async function GET(request) {
  return handleTick(request);
}

export async function POST(request) {
  return handleTick(request);
}
