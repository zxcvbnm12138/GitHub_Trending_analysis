import { deleteCurrentSession } from "../../utils/user-auth.js";

async function handleLogout(request) {
  const cookie = await deleteCurrentSession(request);
  return Response.json(
    { authenticated: false },
    { headers: { "Set-Cookie": cookie } },
  );
}

export async function POST(request) {
  return handleLogout(request);
}

export async function DELETE(request) {
  return handleLogout(request);
}
