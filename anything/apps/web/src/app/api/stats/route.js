import { getStats } from "@/app/api/reports/store";

export async function GET() {
  return Response.json(await getStats());
}
