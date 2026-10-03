import { validateHostedEnvironment } from '@pokopia/security';
import { repository } from '@/lib/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const target = process.env.POKOPIA_DEPLOYMENT_TARGET;
  if (target === 'staging' || target === 'production') {
    const environment = validateHostedEnvironment(process.env, target);
    if (!environment.valid)
      return Response.json({ ok: false, state: 'configuration-unavailable' }, { status: 503 });
  }
  try {
    const data = await repository();
    data.health();
    return Response.json({ ok: true, state: 'ready' });
  } catch {
    return Response.json({ ok: false, state: 'dependency-unavailable' }, { status: 503 });
  }
}
