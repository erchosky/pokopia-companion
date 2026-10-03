import { repository } from '@/lib/data';
export const runtime = 'nodejs';
export async function GET() {
  try {
    await repository();
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, error: 'Service unavailable.' }, { status: 503 });
  }
}
