import {
  createSessionCookie,
  loginUser,
} from "../../utils/user-auth.js";

export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  try {
    const user = await loginUser({
      email: body.email,
      password: body.password,
    });
    const cookie = await createSessionCookie({ request, userId: user.id });
    return Response.json(
      { authenticated: true, user },
      { headers: { "Set-Cookie": cookie } },
    );
  } catch (error) {
    return Response.json(
      { error: String(error.message || error) },
      { status: 401 },
    );
  }
}
