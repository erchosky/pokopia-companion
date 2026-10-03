export const measurementImportStatuses = ['measured', 'unknown', 'error', 'excluded'] as const;

export type MeasurementImportStatus = (typeof measurementImportStatuses)[number];

export interface GameplayMeasurementImport {
  readonly schemaVersion: 1;
  readonly idempotencyKey: string;
  readonly metric: string;
  readonly subject: string;
  readonly gameVersion: string | null;
  readonly value: number | null;
  readonly unit: string;
  readonly repetition: number;
  readonly evidenceReference: string | null;
  readonly status: MeasurementImportStatus;
  readonly observedAt: string;
  readonly setup: Readonly<Record<string, unknown>>;
  readonly conditions: Readonly<Record<string, unknown>>;
}

export interface MeasurementImportValidation {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly measurement: GameplayMeasurementImport | null;
  readonly nextStage: 'candidate_review' | null;
}

const metricPattern = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const subjectPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateMeasurementImport(input: unknown): MeasurementImportValidation {
  const errors: string[] = [];
  if (!isRecord(input))
    return {
      valid: false,
      errors: ['measurement must be a JSON object'],
      measurement: null,
      nextStage: null,
    };

  if (input.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  const idempotencyKey = requiredString(input.idempotencyKey, 'idempotencyKey', errors);
  const metric = requiredString(input.metric, 'metric', errors);
  const subject = requiredString(input.subject, 'subject', errors);
  const unit = requiredString(input.unit, 'unit', errors);
  const status = input.status;
  if (typeof metric === 'string' && !metricPattern.test(metric))
    errors.push('metric must use lowercase dot, dash or underscore notation');
  if (typeof subject === 'string' && !subjectPattern.test(subject))
    errors.push('subject must be a lowercase slug');
  if (!measurementImportStatuses.includes(status as MeasurementImportStatus))
    errors.push(`status must be one of: ${measurementImportStatuses.join(', ')}`);

  const repetition = input.repetition;
  if (!Number.isInteger(repetition) || Number(repetition) < 1)
    errors.push('repetition must be a positive integer');
  const value = input.value;
  if (value !== null && (typeof value !== 'number' || !Number.isFinite(value)))
    errors.push('value must be a finite number or null');
  if (status === 'measured' && typeof value !== 'number')
    errors.push('measured observations require a numeric value');
  if (status !== 'measured' && value !== null)
    errors.push('non-measured observations require value null');

  const evidenceReference = nullableString(input.evidenceReference, 'evidenceReference', errors);
  if (status === 'measured' && evidenceReference === null)
    errors.push('measured observations require an evidenceReference');
  const gameVersion = nullableString(input.gameVersion, 'gameVersion', errors);
  const observedAt = requiredString(input.observedAt, 'observedAt', errors);
  if (typeof observedAt === 'string' && Number.isNaN(Date.parse(observedAt)))
    errors.push('observedAt must be an ISO-8601 timestamp');
  const setup = recordField(input.setup, 'setup', errors);
  const conditions = recordField(input.conditions, 'conditions', errors);

  if (errors.length > 0) return { valid: false, errors, measurement: null, nextStage: null };
  return {
    valid: true,
    errors: [],
    measurement: {
      schemaVersion: 1,
      idempotencyKey: idempotencyKey!,
      metric: metric!,
      subject: subject!,
      gameVersion,
      value: value as number | null,
      unit: unit!,
      repetition: repetition as number,
      evidenceReference,
      status: status as MeasurementImportStatus,
      observedAt: observedAt!,
      setup,
      conditions,
    },
    nextStage: 'candidate_review',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, key: string, errors: string[]): string | null {
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push(`${key} must be a non-empty string`);
    return null;
  }
  return value.trim();
}

function nullableString(value: unknown, key: string, errors: string[]): string | null {
  if (value === null) return null;
  return requiredString(value, key, errors);
}

function recordField(value: unknown, key: string, errors: string[]): Record<string, unknown> {
  if (!isRecord(value)) {
    errors.push(`${key} must be a JSON object`);
    return {};
  }
  return value;
}
