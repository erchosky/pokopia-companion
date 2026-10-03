import { describe, expect, it } from 'vitest';
import { validateMeasurementImport } from './measurement-import';

const valid = {
  schemaVersion: 1,
  idempotencyKey: 'recipe-yield:portal-pod:v1:r1',
  metric: 'recipe.output_batch',
  subject: 'portal-pod',
  gameVersion: '1.1.0',
  value: 2,
  unit: 'item',
  repetition: 1,
  evidenceReference: 'captures/portal-pod-r1.mp4#t=00:13',
  status: 'measured',
  observedAt: '2026-08-12T00:00:00Z',
  setup: { recipe: 'portal-pod' },
  conditions: { platform: 'Switch 2' },
} as const;

describe('measurement import validation', () => {
  it('validates a complete observation and only advances it to candidate review', () => {
    const result = validateMeasurementImport(valid);
    expect(result.valid).toBe(true);
    expect(result.nextStage).toBe('candidate_review');
    expect(result.measurement?.value).toBe(2);
  });

  it('rejects direct-looking observations without reproducible evidence', () => {
    const result = validateMeasurementImport({ ...valid, evidenceReference: null });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('measured observations require an evidenceReference');
  });

  it('keeps unknown observations null instead of coercing them to zero', () => {
    const result = validateMeasurementImport({
      ...valid,
      status: 'unknown',
      value: null,
      evidenceReference: null,
    });
    expect(result.valid).toBe(true);
    expect(result.measurement?.value).toBeNull();
  });
});
