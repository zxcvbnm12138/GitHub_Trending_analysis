import { runDifyWorkflow } from "./dify.js";
import { buildMockReport } from "./mock.js";
import {
  createCompletedReport,
  createPendingReport,
  updateReportCompleted,
  updateReportFailed,
} from "./store.js";

export function normalizeLanguageFilter(language) {
  return language && language !== "all" ? language : null;
}

export async function generateReport({
  language,
  user = "trending-dashboard-scheduler",
  dateRange = "当日",
  allowMock = true,
} = {}) {
  const languageFilter = normalizeLanguageFilter(language);
  const difyUrl = process.env.DIFY_API_URL;
  const difyKey = process.env.DIFY_API_KEY;

  if (difyUrl && difyKey) {
    const pending = await createPendingReport(languageFilter);
    try {
      const { data, summary } = await runDifyWorkflow({
        difyUrl,
        difyKey,
        user,
        dateRange,
      });
      await updateReportCompleted(pending.id, summary, data);
      return { id: pending.id, status: "completed" };
    } catch (error) {
      await updateReportFailed(pending.id, String(error.message || error));
      throw error;
    }
  }

  if (!allowMock) {
    throw new Error(
      "Dify is not configured. Set DIFY_API_URL and DIFY_API_KEY, or enable mock generation.",
    );
  }

  const data = buildMockReport(languageFilter);
  const row = await createCompletedReport(languageFilter, data.summary, data);
  return { id: row.id, status: "completed" };
}
