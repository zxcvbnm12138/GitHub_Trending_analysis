import { runDifyWorkflow } from "@/app/api/reports/dify";
import {
  createPendingReport,
  ensureSchedule,
  markScheduleRan,
  updateReportCompleted,
  updateReportFailed,
} from "@/app/api/reports/store";

export async function POST() {
  const schedule = await ensureSchedule();
  if (!schedule || !schedule.enabled) {
    return Response.json({
      ran: false,
      reason: "schedule disabled or missing",
    });
  }
  if (!schedule.next_run_at || new Date(schedule.next_run_at) > new Date()) {
    return Response.json({ ran: false, reason: "not yet due" });
  }

  const languages =
    Array.isArray(schedule.languages) && schedule.languages.length
      ? schedule.languages
      : ["all"];

  const useDify = !!(process.env.DIFY_API_URL && process.env.DIFY_API_KEY);
  const created = [];

  for (const lang of languages) {
    const languageFilter = lang && lang !== "all" ? lang : null;
    if (useDify) {
      // Fire a quick insert; the user can re-run manually if Dify fails. We do attempt synchronously.
      let pending;
      try {
        pending = await createPendingReport(languageFilter);
        const { data, summary } = await runDifyWorkflow({
          difyUrl: process.env.DIFY_API_URL,
          difyKey: process.env.DIFY_API_KEY,
          user: "trending-dashboard-scheduler",
        });
        await updateReportCompleted(pending.id, summary, data);
        created.push(pending.id);
      } catch (e) {
        console.error("scheduled dify run failed", e);
        if (pending?.id) {
          await updateReportFailed(pending.id, String(e.message || e));
        }
      }
    } else {
      // Fallback to mock
      const mockRes = await fetch(
        new URL(
          "/api/reports/generate-mock",
          process.env.NEXT_PUBLIC_CREATE_APP_URL || "http://localhost",
        ).toString(),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ language: lang }),
        },
      ).catch(() => null);
      if (mockRes && mockRes.ok) {
        const j = await mockRes.json();
        created.push(j.id);
      }
    }
  }

  // schedule next run
  const [hStr, mStr] = String(schedule.cron_time || "09:00").split(":");
  const h = parseInt(hStr, 10) || 9;
  const m = parseInt(mStr, 10) || 0;
  const next = new Date();
  next.setHours(h, m, 0, 0);
  if (next <= new Date()) next.setDate(next.getDate() + 1);

  await markScheduleRan({ id: schedule.id, nextRunAt: next.toISOString() });

  return Response.json({ ran: true, created });
}
