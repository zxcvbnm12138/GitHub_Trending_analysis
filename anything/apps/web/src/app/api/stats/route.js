import { getStats } from "../reports/store.js";
import { requireUser } from "../utils/user-auth.js";

export async function GET(request) {
  const guard = await requireUser(request);
  if (!guard.ok) return guard.response;

  return Response.json(await getStats(guard.user.id));
}
