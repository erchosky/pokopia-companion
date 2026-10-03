import { createGoalCatalog, evaluateGoals, type GoalDefinition } from '@pokopia/goals';
import { clientIdentity, RATE_LIMIT_POLICIES, securityLog } from '@pokopia/security';
import { knowledgeGraph, repository } from '@/lib/data';
import { readBoundedJson } from '@/lib/bounded-json';
import { sanitizeGoalRequest } from '@/lib/goal-input';
import { webRateLimiter } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const subject = clientIdentity(request.headers, {
    platform: process.env.VERCEL === '1' ? 'vercel' : 'generic',
    trustProxyHeaders: process.env.POKOPIA_TRUST_PROXY_HEADERS === 'true',
  });
  const limit = await webRateLimiter().consume(RATE_LIMIT_POLICIES.goalEvaluation, subject);
  if (!limit.allowed) {
    securityLog('warn', 'goals.rate_limited', { subject, reason: limit.reason });
    return Response.json(
      { error: 'Too many goal evaluations. Try again shortly.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1_000))),
        },
      },
    );
  }
  let body: unknown;
  try {
    body = await readBoundedJson<unknown>(request, {
      maximumBytes: 64 * 1024,
      maximumDepth: 8,
      maximumNodes: 6_000,
    });
  } catch (error) {
    const oversized = error instanceof Error && error.message === 'payload-too-large';
    return Response.json(
      { error: oversized ? 'Progress payload too large.' : 'Invalid JSON payload.' },
      { status: oversized ? 413 : 400 },
    );
  }
  let goals: readonly GoalDefinition[];
  let entries: ReturnType<typeof sanitizeGoalRequest>['entries'];
  let inventory: ReturnType<typeof sanitizeGoalRequest>['inventory'];
  try {
    ({ goals, entries, inventory } = sanitizeGoalRequest(body));
  } catch {
    return Response.json({ error: 'Invalid goal progress payload.' }, { status: 400 });
  }
  const [data, graph] = await Promise.all([repository(), knowledgeGraph()]);
  const catalog = createGoalCatalog(data, graph, goals);
  return Response.json({ evaluations: evaluateGoals(goals, catalog, { entries, inventory }) });
}
