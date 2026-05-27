import { getAuthStatus } from "../../utils/user-auth.js";

export async function GET(request) {
  return Response.json(await getAuthStatus(request));
}
