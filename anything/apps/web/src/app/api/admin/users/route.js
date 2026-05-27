import {
  listUsers,
  requireAdminUser,
} from "../../utils/user-auth.js";

export async function GET(request) {
  const guard = await requireAdminUser(request);
  if (!guard.ok) return guard.response;

  return Response.json({ users: await listUsers() });
}
