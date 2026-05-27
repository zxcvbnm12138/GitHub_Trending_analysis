import { createCompletedReport } from "../store.js";
import { buildMockReport } from "../mock.js";

export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const language = body?.language || null;
  const languageFilter = language && language !== "all" ? language : null;

  const data = buildMockReport(languageFilter);
  const row = await createCompletedReport(languageFilter, data.summary, data);

  return Response.json({ id: row.id, status: "completed" });
}
