import Link from 'next/link';
import type { GraphEntityRef, KnowledgeRelationship } from '@pokopia/knowledge';

export function RelationshipPanel({
  entity,
  relationships,
  alternatives,
}: {
  entity: GraphEntityRef;
  relationships: readonly KnowledgeRelationship[];
  alternatives: readonly KnowledgeRelationship[];
}) {
  const primary = relationships.slice(0, 8);
  const advanced = relationships.slice(8);
  return (
    <section className="relationship-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Knowledge Graph</p>
          <h2>Cómo se conecta</h2>
        </div>
        <p>{relationships.length} relaciones semánticas</p>
      </div>
      {primary.length ? (
        <div className="relationship-list">
          {primary.map((relationship) => (
            <RelationshipRow entity={entity} relationship={relationship} key={relationship.id} />
          ))}
        </div>
      ) : (
        <p className="unknown-state">No hay relaciones semánticas suficientes para esta ficha.</p>
      )}
      {advanced.length ? (
        <details className="advanced-details">
          <summary>Ver {advanced.length} relaciones adicionales</summary>
          <div className="relationship-list">
            {advanced.map((relationship) => (
              <RelationshipRow entity={entity} relationship={relationship} key={relationship.id} />
            ))}
          </div>
        </details>
      ) : null}
      {alternatives.length ? (
        <div className="related-alternatives">
          <strong>Alternativas por capacidad compartida</strong>
          <div className="chip-list">
            {alternatives.slice(0, 6).map((relationship) => (
              <EntityLink entity={relationship.to} key={relationship.id} />
            ))}
          </div>
          <small>Son candidatos comparables, no una afirmación de superioridad.</small>
        </div>
      ) : null}
    </section>
  );
}

function RelationshipRow({
  entity,
  relationship,
}: {
  entity: GraphEntityRef;
  relationship: KnowledgeRelationship;
}) {
  const other =
    relationship.from.kind === entity.kind && relationship.from.slug === entity.slug
      ? relationship.to
      : relationship.from;
  return (
    <article className="relationship-row">
      <span className={`confidence-dot confidence-${relationship.confidence}`} aria-hidden="true" />
      <div>
        <span>{relationship.predicate.replaceAll('_', ' ')}</span>
        <EntityLink entity={other} />
      </div>
      <details>
        <summary>{humanConfidence(relationship.confidence)}</summary>
        <p>
          {relationship.relationshipClass.replaceAll('_', ' ')} ·{' '}
          {relationship.derivationMethod ?? 'Direct extraction'}
        </p>
        {relationship.evidence.map((evidence) => (
          <p key={`${evidence.source.url}:${evidence.statement}`}>
            {evidence.statement}{' '}
            <a href={evidence.source.url} target="_blank" rel="noreferrer">
              Fuente ↗
            </a>
          </p>
        ))}
      </details>
    </article>
  );
}

function EntityLink({ entity }: { entity: GraphEntityRef }) {
  const href = entityHref(entity);
  return href ? (
    <Link className="chip" href={href}>
      {entity.name}
    </Link>
  ) : (
    <span className="chip">{entity.name}</span>
  );
}

function entityHref(entity: GraphEntityRef): string | null {
  if (entity.kind === 'pokemon') return `/pokemon/${entity.slug}`;
  if (entity.kind === 'item') return `/items/${entity.slug}`;
  if (entity.kind === 'recipe') return `/recipes/${entity.slug}`;
  if (entity.kind === 'town') return `/towns/${entity.slug}`;
  if (entity.kind === 'automation') return `/automation#${entity.slug}`;
  return null;
}

function humanConfidence(confidence: KnowledgeRelationship['confidence']): string {
  if (confidence === 'high') return 'Likely';
  if (confidence === 'medium') return 'Needs review';
  if (confidence === 'low') return 'Needs testing';
  return 'Unknown';
}
