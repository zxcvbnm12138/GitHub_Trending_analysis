import {
  getAdminConfigPayload,
  mutateAppConfig,
} from "../../utils/app-config.js";
import { requireAdminUser } from "../../utils/user-auth.js";

function badRequest(message) {
  return Response.json({ error: message }, { status: 400 });
}

function validateDifyBaseUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("invalid protocol");
    }
    return value.replace(/\/+$/, "");
  } catch {
    throw new Error("Dify base URL must be a valid http(s) URL.");
  }
}

function validateDatabaseUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (!["postgres:", "postgresql:"].includes(url.protocol)) {
      throw new Error("invalid protocol");
    }
    return value;
  } catch {
    throw new Error("Database URL must be a valid postgres connection URL.");
  }
}

export async function GET(request) {
  const guard = await requireAdminUser(request);
  if (!guard.ok) return guard.response;

  return Response.json({
    ...(await getAdminConfigPayload({ authenticated: true })),
    initialized: true,
    authenticated: true,
    user: guard.user,
  });
}

export async function POST(request) {
  const guard = await requireAdminUser(request);
  if (!guard.ok) return guard.response;

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  try {
    await mutateAppConfig(async (current) => {
      const next = {
        ...current,
        dify: { ...current.dify },
        database: { ...current.database },
      };

      if (typeof body.dify_base_url === "string") {
        next.dify.base_url = validateDifyBaseUrl(body.dify_base_url.trim());
      }

      if (body.clear_dify_app_key === true) {
        next.dify.app_key = "";
      } else if (typeof body.dify_app_key === "string" && body.dify_app_key) {
        next.dify.app_key = body.dify_app_key.trim();
      }

      if (body.clear_database_url === true) {
        next.database.url = "";
      } else if (typeof body.database_url === "string" && body.database_url) {
        next.database.url = validateDatabaseUrl(body.database_url.trim());
      }

      return next;
    });
  } catch (error) {
    return badRequest(String(error.message || error));
  }

  return Response.json({
    ...(await getAdminConfigPayload({ authenticated: true })),
    initialized: true,
    authenticated: true,
    user: guard.user,
  });
}
