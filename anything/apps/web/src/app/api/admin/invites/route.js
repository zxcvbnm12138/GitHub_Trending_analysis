import {
  createInviteCode,
  listInviteCodes,
  requireAdminUser,
} from "../../utils/user-auth.js";

export async function GET(request) {
  const guard = await requireAdminUser(request);
  if (!guard.ok) return guard.response;

  return Response.json({ invites: await listInviteCodes() });
}

export async function POST(request) {
  const guard = await requireAdminUser(request);
  if (!guard.ok) return guard.response;

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const days = Number(body.expires_in_days);
  const expiresAt =
    Number.isFinite(days) && days > 0
      ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
      : null;

  const result = await createInviteCode({
    role: body.role,
    maxUses: body.max_uses,
    expiresAt,
    createdBy: guard.user.id,
  });

  return Response.json(result, { status: 201 });
}
