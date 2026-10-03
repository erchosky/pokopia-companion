const SENSITIVE_KEY =
  /password|secret|token|cookie|authorization|database.?url|service.?role|session/i;
const CONNECTION_STRING = /\b(?:postgres(?:ql)?|redis):\/\/[^\s"']+/gi;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;

export type SafeLogValue =
  null | boolean | number | string | readonly SafeLogValue[] | SafeLogFields;
export interface SafeLogFields {
  readonly [key: string]: SafeLogValue | undefined;
}

function redactString(value: string): string {
  return value.replace(CONNECTION_STRING, '[REDACTED_URL]').replace(BEARER, 'Bearer [REDACTED]');
}

export function redactLogValue(value: unknown, key = ''): SafeLogValue {
  if (SENSITIVE_KEY.test(key)) return '[REDACTED]';
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return redactString(value).slice(0, 2_000);
  if (Array.isArray(value)) return value.slice(0, 50).map((entry) => redactLogValue(entry));
  if (value instanceof Error)
    return { name: value.name, message: redactString(value.message).slice(0, 500) };
  if (typeof value === 'object' && value) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 100)
        .map(([entryKey, entryValue]) => [entryKey, redactLogValue(entryValue, entryKey)]),
    );
  }
  return String(value).slice(0, 500);
}

export function securityLog(
  level: 'info' | 'warn' | 'error',
  event: string,
  fields: SafeLogFields = {},
): void {
  const redactedFields = redactLogValue(fields) as SafeLogFields;
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...redactedFields,
  });
  if (level === 'error') console.error(entry);
  else if (level === 'warn') console.warn(entry);
  else console.info(entry);
}
