export function logInfo(msg: string, meta?: Record<string, unknown>) {
  const ts = new Date().toISOString();
  const parts = meta ? Object.entries(meta).map(([k, v]) => `${k}=${v}`) : [];
  console.log(`${ts} INFO ${msg}${parts.length ? ' /* ' + parts.join(' ') : ''}`);
}

export function logWarn(msg: string, meta?: Record<string, unknown>) {
  const ts = new Date().toISOString();
  const parts = meta ? Object.entries(meta).map(([k, v]) => `${k}=${v}`) : [];
  console.warn(`${ts} WARN ${msg}${parts.length ? ' /* ' + parts.join(' ') : ''}`);
}

export function logError(msg: string, err?: unknown) {
  const ts = new Date().toISOString();
  const errStr = err instanceof Error ? `err=${err.message}` : '';
  console.error(`${ts} ERROR ${msg}${errStr ? ' /* ' + errStr : ''}`);
}
