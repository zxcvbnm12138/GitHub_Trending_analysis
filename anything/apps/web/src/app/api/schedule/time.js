export function computeNextRunAt(cronTime = "09:00", from = new Date()) {
  const [hStr, mStr] = String(cronTime).split(":");
  const h = parseInt(hStr, 10) || 9;
  const m = parseInt(mStr, 10) || 0;
  const next = new Date(from);
  next.setHours(h, m, 0, 0);
  if (next <= from) next.setDate(next.getDate() + 1);
  return next;
}

export function reportDateFromRunAt(runAt) {
  return new Date(runAt).toISOString().slice(0, 10);
}
