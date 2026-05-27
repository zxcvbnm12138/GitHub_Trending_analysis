import { runDifyWorkflow } from "../dify.js";
import {
  createPendingReport,
  updateReportCompleted,
  updateReportFailed,
} from "../store.js";

async function completeReport({ reportId, difyUrl, difyKey, dateRange }) {
  try {
    const { data, summary } = await runDifyWorkflow({
      difyUrl,
      difyKey,
      user: `trending-dashboard-report-${reportId}`,
      dateRange,
    });

    await updateReportCompleted(reportId, summary, data);
  } catch (err) {
    console.error("Dify async report generation failed", err);
    await updateReportFailed(reportId, String(err.message || err));
  }
}

export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch (e) {
    body = {};
  }

  const language = body?.language || null;
  const languageFilter = language && language !== "all" ? language : null;

  const pending = await createPendingReport(languageFilter);
  const reportId = pending.id;

  const difyUrl = process.env.DIFY_API_URL;
  const difyKey = process.env.DIFY_API_KEY;

  if (!difyUrl || !difyKey) {
    await updateReportFailed(
      reportId,
      "Dify is not configured. Set DIFY_API_URL and DIFY_API_KEY, or use the mock generator.",
    );
    return Response.json(
      {
        id: reportId,
        status: "failed",
        error:
          "Dify is not configured. Add DIFY_API_URL and DIFY_API_KEY, or call /api/reports/generate-mock.",
      },
      { status: 400 },
    );
  }

  completeReport({
    reportId,
    difyUrl,
    difyKey,
    dateRange: body?.date_range || "当日",
  });

  return Response.json({ id: reportId, status: "pending" }, { status: 202 });
}
