import { describe, expect, it } from 'vitest';
import { readBoundedJson } from './bounded-json';

describe('bounded JSON reader', () => {
  it('rejects a declared oversized payload before parsing', async () => {
    const request = new Request('http://localhost/api/goals', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': '70000' },
      body: '{}',
    });
    await expect(readBoundedJson(request, 64 * 1024)).rejects.toThrow('payload-too-large');
  });

  it('rejects a streamed payload after crossing the byte budget', async () => {
    const request = new Request('http://localhost/api/goals', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: 'x'.repeat(100) }),
    });
    await expect(readBoundedJson(request, 32)).rejects.toThrow('payload-too-large');
  });

  it('rejects excessive nesting and non-JSON media types', async () => {
    const nested = `${'['.repeat(20)}null${']'.repeat(20)}`;
    await expect(
      readBoundedJson(
        new Request('https://example.test', {
          method: 'POST',
          body: nested,
          headers: { 'content-type': 'application/json' },
        }),
        {
          maximumBytes: 1_024,
          maximumDepth: 8,
        },
      ),
    ).rejects.toThrow('payload-too-complex');
    await expect(
      readBoundedJson(
        new Request('https://example.test', {
          method: 'POST',
          body: '{}',
          headers: { 'content-type': 'text/plain' },
        }),
        1_024,
      ),
    ).rejects.toThrow('unsupported-content-type');
  });
});
