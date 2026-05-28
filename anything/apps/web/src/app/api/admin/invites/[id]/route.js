import {
  requireAdminUser,
  setInviteCodeDisabled,
} from "../../../utils/user-auth.js";

export async function PATCH(request, { params }) {
  const guard = await requireAdminUser(request);
  if (!guard.ok) return guard.response;

  const id = String(params.id || "");
  if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const invite = await setInviteCodeDisabled({
    id,
    disabled: body.disabled === true,
  });

  if (!invite) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ invite });
}
