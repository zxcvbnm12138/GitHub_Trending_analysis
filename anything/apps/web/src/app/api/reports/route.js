import { listReports } from "./store.js";

export async function GET(request) {
  const url = new URL(request.url);
  const language = url.searchParams.get("language");
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") || "100", 10),
    200,
  );

  const rows = await listReports({ language, limit });

  return Response.json({ reports: rows });
}
