import { deleteReport, getReport } from "../store.js";

export async function GET(request, { params }) {
  const id = parseInt(params.id, 10);
  if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });

  const row = await getReport(id);
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ report: row });
}

export async function DELETE(request, { params }) {
  const id = parseInt(params.id, 10);
  if (!id) return Response.json({ error: "Invalid id" }, { status: 400 });
  await deleteReport(id);
  return Response.json({ ok: true });
}
