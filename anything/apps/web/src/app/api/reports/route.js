import { listReports } from "./store.js";
import { requireUser } from "../utils/user-auth.js";

export async function GET(request) {
  const guard = await requireUser(request);
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const language = url.searchParams.get("language");
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") || "100", 10),
    200,
  );

  const rows = await listReports({ userId: guard.user.id, language, limit });

  return Response.json({ reports: rows });
}
