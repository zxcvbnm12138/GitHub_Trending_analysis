import { deleteReport, getReport } from "../store.js";
import { requireUser } from "../../utils/user-auth.js";

export async function GET(request, { params }) {
  const guard = await requireUser(request);
  if (!guard.ok) return guard.response;

  const id = parseInt(params.id, 10);
  if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });

  const row = await getReport(guard.user.id, id);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ report: row });
}

export async function DELETE(request, { params }) {
  const guard = await requireUser(request);
  if (!guard.ok) return guard.response;

  const id = parseInt(params.id, 10);
  if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });
  await deleteReport(guard.user.id, id);
  return Response.json({ ok: true });
}
