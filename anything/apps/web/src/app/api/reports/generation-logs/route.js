import { listGenerationLogs } from "../store.js";
import { requireUser } from "../../utils/user-auth.js";

export async function GET(request) {
  const guard = await requireUser(request);
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") || "100", 10), 1),
    200,
  );

  const logs = await listGenerationLogs({ userId: guard.user.id, limit });
  return Response.json({ logs });
}
