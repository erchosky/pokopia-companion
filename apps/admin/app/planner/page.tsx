import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findRepositoryRoot } from '@pokopia/game-data';
import { Badge, Card, Metric, PageIntro } from '@pokopia/ui';

export const metadata = { title: 'Planner 5.5' };

type CapabilityAudit = {
  readonly capabilities: readonly {
    readonly id: string;
    readonly state: string;
    readonly reason: string;
  }[];
};
type PerformanceAudit = {
  readonly cases: readonly {
    readonly id: string;
    readonly goals: number;
    readonly runtimeMs: number;
    readonly nodes: number;
    readonly edges: number;
  }[];
};
type RegressionAudit = {
  readonly sameInputSamePlan: boolean;
  readonly fingerprint: string;
  readonly invariants: readonly string[];
};

export default function PlannerInspectionPage() {
  const capabilities = read<CapabilityAudit>('capability-flags.json');
  const performance = read<PerformanceAudit>('performance.json');
  const regression = read<RegressionAudit>('deterministic-regression.json');
  const twenty = performance.cases.find((entry) => entry.id === '20-goals');
  return (
    <main>
      <PageIntro eyebrow="Admin / dev" title="Inspección del Planner 5.5">
        <p>
          Diagnósticos reproducibles de capabilities, determinismo y tamaño del grafo. No contiene
          player state ni secretos.
        </p>
      </PageIntro>
      <div className="metric-grid">
        <Metric label="Capabilities" value={capabilities.capabilities.length} />
        <Metric label="Determinista" value={regression.sameInputSamePlan ? 'PASS' : 'FAIL'} />
        <Metric label="20 goals" value={`${twenty?.runtimeMs ?? '—'} ms`} />
        <Metric label="Fingerprint" value={regression.fingerprint} />
      </div>
      <div className="grid grid-wide">
        {capabilities.capabilities.map((capability) => (
          <Card key={capability.id}>
            <Badge tone={capability.state === 'unavailable' ? 'warn' : 'accent'}>
              {capability.state}
            </Badge>
            <h2>{capability.id}</h2>
            <p>{capability.reason}</p>
          </Card>
        ))}
      </div>
      <div className="section-heading">
        <h2>Performance y search-space control</h2>
      </div>
      <div className="result-list">
        {performance.cases.map((entry) => (
          <Card className="result" key={entry.id}>
            <span className="result-index">{entry.goals}</span>
            <div>
              <h2>{entry.id}</h2>
              <p>
                {entry.runtimeMs} ms · {entry.nodes} nodes · {entry.edges} edges
              </p>
            </div>
          </Card>
        ))}
      </div>
      <Card>
        <h2>Invariantes auditadas</h2>
        <ul>
          {regression.invariants.map((invariant) => (
            <li key={invariant}>{invariant}</li>
          ))}
        </ul>
      </Card>
    </main>
  );
}

function read<T>(name: string): T {
  return JSON.parse(
    readFileSync(join(findRepositoryRoot(), 'audit-data/iteration-5-5', name), 'utf8'),
  ) as T;
}
