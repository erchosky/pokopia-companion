import { describe, expect, it } from 'vitest';
import { redactLogValue } from './logging.js';

describe('structured log redaction', () => {
  it('redacts nested credentials, bearer values and connection URLs', () => {
    const output = redactLogValue({
      password: 'hunter2',
      nested: { sessionToken: 'abc', safe: 'ok' },
      message: 'failed postgresql://user:pass@db.example/pokopia Bearer abc.def',
    });
    expect(output).toEqual({
      password: '[REDACTED]',
      nested: { sessionToken: '[REDACTED]', safe: 'ok' },
      message: 'failed [REDACTED_URL] Bearer [REDACTED]',
    });
  });
});
