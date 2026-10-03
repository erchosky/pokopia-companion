export interface BoundedJsonOptions {
  readonly maximumBytes: number;
  readonly maximumDepth?: number;
  readonly maximumNodes?: number;
}

function assertComplexity(value: unknown, maximumDepth: number, maximumNodes: number): void {
  const pending: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  let visited = 0;
  while (pending.length) {
    const current = pending.pop()!;
    visited += 1;
    if (visited > maximumNodes || current.depth > maximumDepth)
      throw new Error('payload-too-complex');
    if (current.value && typeof current.value === 'object')
      for (const child of Object.values(current.value))
        pending.push({ value: child, depth: current.depth + 1 });
  }
}

export async function readBoundedJson<T>(
  request: Request,
  options: number | BoundedJsonOptions,
): Promise<T> {
  const {
    maximumBytes,
    maximumDepth = 12,
    maximumNodes = 12_000,
  } = typeof options === 'number' ? { maximumBytes: options } : options;
  const contentType = request.headers.get('content-type');
  if (contentType && !/^application\/(?:[a-z0-9.+-]*\+)?json(?:\s*;|$)/i.test(contentType))
    throw new Error('unsupported-content-type');
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maximumBytes) throw new Error('payload-too-large');
  if (!request.body) return {} as T;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel();
      throw new Error('payload-too-large');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const parsed = JSON.parse(new TextDecoder().decode(bytes)) as T;
  assertComplexity(parsed, maximumDepth, maximumNodes);
  return parsed;
}
