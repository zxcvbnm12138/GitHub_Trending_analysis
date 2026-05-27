import {
  requireAdminUser,
  setUserStatus,
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

  const disabled =
    typeof body.disabled === "boolean" ? body.disabled : body.status === "disabled";
  const nextStatus = disabled ? "disabled" : "active";

  if (String(guard.user.id) === id && nextStatus === "disabled") {
    return Response.json(
      { error: "You cannot disable your own admin account." },
      { status: 400 },
    );
  }

  const user = await setUserStatus({ id, status: nextStatus });
  if (!user) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ user });
}
