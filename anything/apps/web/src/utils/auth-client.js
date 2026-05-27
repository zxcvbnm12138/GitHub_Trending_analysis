export async function fetchAuthStatus() {
  const response = await fetch("/api/auth/me");
  const body = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 503) {
    throw new Error(body?.error || `auth ${response.status}`);
  }
  return body;
}
