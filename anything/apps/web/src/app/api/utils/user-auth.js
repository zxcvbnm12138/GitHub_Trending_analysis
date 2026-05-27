import {
  createHash,
  pbkdf2,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import sql, { hasDatabase } from "./sql.js";
import { getConfiguredDatabaseUrlSync } from "./app-config.js";
import { ensureDatabaseSchema } from "./db-admin.js";

const pbkdf2Async = promisify(pbkdf2);
const COOKIE_NAME = "trending_user_session";
const SESSION_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;
const PASSWORD_ITERATIONS = 120000;
const INVITE_PREFIX = "INV";

let schemaPromise = null;

function parseCookies(header) {
  const cookies = new Map();
  for (const part of String(header || "").split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) cookies.set(key, decodeURIComponent(value));
  }
  return cookies;
}

function isSecureRequest(request) {
  const forwarded = request.headers.get("x-forwarded-proto");
  return forwarded === "https" || request.url.startsWith("https://");
}

function buildCookie(value, request, maxAge = SESSION_MAX_AGE_SECONDS) {
  const secure = isSecureRequest(request) ? "; Secure" : "";
  return [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    secure,
  ]
    .filter(Boolean)
    .join("; ");
}

function hashText(value) {
  return createHash("sha256").update(String(value || "")).digest("hex");
}

function normalizeEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error("Email address is invalid.");
  }
  return value;
}

function validatePassword(password) {
  if (typeof password !== "string" || password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
}

function normalizeRole(role) {
  return role === "admin" ? "admin" : "user";
}

function userPayload(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    email: row.email,
    role: row.role,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function buildLogoutCookie(request) {
  return buildCookie("", request, 0);
}

export async function ensureAuthReady() {
  if (!hasDatabase) {
    return {
      ok: false,
      response: Response.json(
        {
          error: "database_required",
          message: "User login requires a configured PostgreSQL database.",
          database_configured: false,
        },
        { status: 503 },
      ),
    };
  }

  if (!schemaPromise) {
    schemaPromise = ensureDatabaseSchema(getConfiguredDatabaseUrlSync());
  }
  await schemaPromise;
  return { ok: true };
}

export async function hashPassword(password) {
  validatePassword(password);
  const salt = randomBytes(16).toString("hex");
  const derived = await pbkdf2Async(
    password,
    salt,
    PASSWORD_ITERATIONS,
    32,
    "sha256",
  );

  return {
    password_hash: derived.toString("hex"),
    password_salt: salt,
    password_iterations: PASSWORD_ITERATIONS,
  };
}

export async function verifyPassword(password, user) {
  if (!user?.password_hash || !user?.password_salt) return false;
  const derived = await pbkdf2Async(
    String(password || ""),
    user.password_salt,
    Number(user.password_iterations) || PASSWORD_ITERATIONS,
    32,
    "sha256",
  );
  const expected = Buffer.from(user.password_hash, "hex");
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(expected, derived);
}

export async function getUserCount() {
  const ready = await ensureAuthReady();
  if (!ready.ok) return 0;
  const [row] = await sql`SELECT COUNT(*)::int AS count FROM app_users`;
  return Number(row?.count) || 0;
}

export async function getCurrentUser(request) {
  const ready = await ensureAuthReady();
  if (!ready.ok) return null;

  const token = parseCookies(request.headers.get("cookie")).get(COOKIE_NAME);
  if (!token) return null;

  const tokenHash = hashText(token);
  const [row] = await sql`
    SELECT users.id, users.email, users.role, users.status, users.created_at, users.updated_at
    FROM user_sessions sessions
    JOIN app_users users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ${tokenHash}
      AND sessions.expires_at > NOW()
      AND users.status = 'active'
    LIMIT 1
  `;

  if (!row) return null;

  await sql`
    UPDATE user_sessions
    SET last_seen_at = NOW()
    WHERE token_hash = ${tokenHash}
  `;

  return userPayload(row);
}

export async function getAuthStatus(request) {
  const ready = await ensureAuthReady();
  if (!ready.ok) {
    return {
      database_configured: false,
      authenticated: false,
      user: null,
      allow_first_admin: false,
    };
  }

  const [countRow] = await sql`SELECT COUNT(*)::int AS count FROM app_users`;
  const count = Number(countRow?.count) || 0;
  const user = await getCurrentUser(request);

  return {
    database_configured: true,
    authenticated: Boolean(user),
    user,
    allow_first_admin: count === 0,
  };
}

export async function requireUser(request) {
  const ready = await ensureAuthReady();
  if (!ready.ok) return ready;

  const user = await getCurrentUser(request);
  if (!user) {
    return {
      ok: false,
      response: Response.json(
        { error: "unauthorized", authenticated: false },
        { status: 401 },
      ),
    };
  }

  return { ok: true, user };
}

export async function requireAdminUser(request) {
  const guard = await requireUser(request);
  if (!guard.ok) return guard;
  if (guard.user.role !== "admin") {
    return {
      ok: false,
      user: guard.user,
      response: Response.json({ error: "forbidden" }, { status: 403 }),
    };
  }
  return guard;
}

export async function createSessionCookie({ request, userId }) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashText(token);
  const expiresAt = new Date(
    Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  ).toISOString();

  await sql`
    INSERT INTO user_sessions (user_id, token_hash, expires_at)
    VALUES (${userId}, ${tokenHash}, ${expiresAt})
  `;

  return buildCookie(token, request);
}

export async function deleteCurrentSession(request) {
  const ready = await ensureAuthReady();
  if (ready.ok) {
    const token = parseCookies(request.headers.get("cookie")).get(COOKIE_NAME);
    if (token) {
      await sql`DELETE FROM user_sessions WHERE token_hash = ${hashText(token)}`;
    }
  }
  return buildLogoutCookie(request);
}

export async function loginUser({ email, password }) {
  const ready = await ensureAuthReady();
  if (!ready.ok) throw new Error("Database is not configured.");

  const normalizedEmail = normalizeEmail(email);
  const [row] = await sql`
    SELECT *
    FROM app_users
    WHERE LOWER(email) = ${normalizedEmail}
    LIMIT 1
  `;
  if (!row || row.status !== "active") {
    throw new Error("Invalid email or password.");
  }

  const ok = await verifyPassword(password, row);
  if (!ok) throw new Error("Invalid email or password.");

  return userPayload(row);
}

async function assignLegacyData(client, userId) {
  await client`
    UPDATE trending_reports
    SET user_id = ${userId}
    WHERE user_id IS NULL
  `;
  await client`
    UPDATE report_schedules
    SET user_id = ${userId}
    WHERE user_id IS NULL
  `;
  await client`
    UPDATE report_generation_jobs
    SET user_id = ${userId}
    WHERE user_id IS NULL
  `;
}

export async function registerUser({ email, password, inviteCode }) {
  const ready = await ensureAuthReady();
  if (!ready.ok) throw new Error("Database is not configured.");

  const normalizedEmail = normalizeEmail(email);
  const passwordRecord = await hashPassword(password);
  const [countRow] = await sql`SELECT COUNT(*)::int AS count FROM app_users`;
  const isFirstUser = Number(countRow?.count) === 0;

  try {
    if (isFirstUser) {
      const [created] = await sql`
        INSERT INTO app_users (
          email, password_hash, password_salt, password_iterations, role, status
        )
        VALUES (
          ${normalizedEmail},
          ${passwordRecord.password_hash},
          ${passwordRecord.password_salt},
          ${passwordRecord.password_iterations},
          'admin',
          'active'
        )
        RETURNING id, email, role, status, created_at, updated_at
      `;

      await assignLegacyData(sql, created.id);

      return userPayload(created);
    }

    const codeHash = hashText(normalizeInviteCode(inviteCode));
    const [created] = await sql`
      WITH valid_invite AS (
        UPDATE invite_codes
        SET used_count = used_count + 1
        WHERE code_hash = ${codeHash}
          AND disabled = false
          AND used_count < max_uses
          AND (expires_at IS NULL OR expires_at > NOW())
        RETURNING role
      )
      INSERT INTO app_users (
        email, password_hash, password_salt, password_iterations, role, status
      )
      SELECT
        ${normalizedEmail},
        ${passwordRecord.password_hash},
        ${passwordRecord.password_salt},
        ${passwordRecord.password_iterations},
        CASE WHEN role = 'admin' THEN 'admin' ELSE 'user' END,
        'active'
      FROM valid_invite
      RETURNING id, email, role, status, created_at, updated_at
    `;

    if (!created) throw new Error("Invite code is invalid or expired.");
    return userPayload(created);
  } catch (error) {
    if (error?.code === "23505") {
      throw new Error("Email address is already registered.");
    }
    throw error;
  }
}

export function normalizeInviteCode(code) {
  const value = String(code || "").trim().toUpperCase();
  if (!value) throw new Error("Invite code is required.");
  return value.replace(/\s+/g, "");
}

export function generateInviteCode() {
  return `${INVITE_PREFIX}-${randomBytes(9).toString("base64url").toUpperCase()}`;
}

export function hashInviteCode(code) {
  return hashText(normalizeInviteCode(code));
}

export async function listInviteCodes() {
  const rows = await sql`
    SELECT
      invites.id,
      invites.role,
      invites.max_uses,
      invites.used_count,
      invites.expires_at,
      invites.disabled,
      invites.created_at,
      users.email AS created_by_email
    FROM invite_codes invites
    LEFT JOIN app_users users ON users.id = invites.created_by
    ORDER BY invites.created_at DESC
    LIMIT 100
  `;
  return rows.map((row) => ({
    ...row,
    id: String(row.id),
  }));
}

export async function createInviteCode({
  role,
  maxUses,
  expiresAt,
  createdBy,
}) {
  const code = generateInviteCode();
  const [row] = await sql`
    INSERT INTO invite_codes (
      code_hash, role, max_uses, expires_at, created_by
    )
    VALUES (
      ${hashInviteCode(code)},
      ${normalizeRole(role)},
      ${Math.max(1, Math.min(Number(maxUses) || 1, 100))},
      ${expiresAt || null},
      ${createdBy}
    )
    RETURNING id, role, max_uses, used_count, expires_at, disabled, created_at
  `;

  return {
    invite: { ...row, id: String(row.id) },
    code,
  };
}

export async function listUsers() {
  const rows = await sql`
    SELECT
      users.id,
      users.email,
      users.role,
      users.status,
      users.created_at,
      users.updated_at,
      MAX(sessions.last_seen_at) AS last_seen_at
    FROM app_users users
    LEFT JOIN user_sessions sessions ON sessions.user_id = users.id
    GROUP BY users.id
    ORDER BY users.created_at ASC
  `;
  return rows.map(userPayload);
}

export async function setUserStatus({ id, status }) {
  const nextStatus = status === "disabled" ? "disabled" : "active";
  const [row] = await sql`
    UPDATE app_users
    SET status = ${nextStatus},
        updated_at = NOW()
    WHERE id = ${id}
    RETURNING id, email, role, status, created_at, updated_at
  `;

  if (nextStatus === "disabled") {
    await sql`DELETE FROM user_sessions WHERE user_id = ${id}`;
  }

  return userPayload(row);
}
