import { createCompletedReport } from "../store.js";
import { buildMockReport } from "../mock.js";
import { requireUser } from "../../utils/user-auth.js";

export async function POST(request) {
  const guard = await requireUser(request);
  if (!guard.ok) return guard.response;

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const language = body?.language || null;
  const languageFilter = language && language !== "all" ? language : null;

  const data = buildMockReport(languageFilter);
  const row = await createCompletedReport(guard.user.id, languageFilter, data.summary, data);

  return Response.json({ id: row.id, status: "completed" });
}
