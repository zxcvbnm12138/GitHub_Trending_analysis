import { getStats } from "../reports/store.js";

export async function GET() {
  return Response.json(await getStats());
}
