# Cloud sync readiness

Iteration 4.5 does not implement or enable cloud synchronization. Player progress remains local and
usable without login. This document defines the minimum contract for a later, separately authorized
implementation.

## Current state

The local schema is version 4. Entity progress uses stable domain keys such as
`item:portal-pod`, `town:palettetown:level` and `treasure_map:treasure-map-1`. Entries distinguish
`confirmed` from `inferred`; absence means `unknown`. Every entry has `updatedAt`. Goals have a stable
local ID and `createdAt`. Favorites, recent activity and town residents are bounded.

Iteration 4.5 validates and normalizes this state. Corrupt, partial or future-version data cannot
manufacture confirmed progress: a bounded original backup is retained locally, valid fields are
salvaged and My Pokopia shows a recovery notice. No backup is uploaded.

## Future synchronization envelope

```json
{
  "schemaVersion": 4,
  "deviceId": "client-generated-random-id",
  "operationId": "client-generated-idempotency-id",
  "baseRevision": 42,
  "changedAt": "RFC-3339 timestamp",
  "changes": []
}
```

`user_id` must come from the verified server session and must never be accepted from this envelope.
The server derives ownership for every write. `operationId` is unique per user and makes retries
idempotent. `baseRevision` provides optimistic concurrency; the server returns the new revision and a
bounded conflict payload instead of silently overwriting.

## Identity and stable IDs

- User-state rows belong to the authenticated subject validated server-side.
- Canonical entity IDs are resolved server-side from the stable `kind:slug` key. A client cannot
  write an arbitrary entity UUID.
- Goal IDs remain client-generated UUIDs and unique within the user. Duplicate operation IDs return
  the previous result.
- Device IDs identify an installation for conflict explanations, not authorization.
- Timestamps supplied by a client are evidence for ordering but not trusted clocks. The server also
  stores `received_at` and a monotonic revision.

## Conflict policy

Conflicts are field-aware and preserve intent:

- `confirmed` always requires an explicit user operation. An inference never overwrites a confirmed
  value.
- Concurrent different confirmed values produce a conflict requiring the user to choose; no
  last-write-wins promotion.
- Independent entity keys merge.
- Goals/favorites use add/remove operations with idempotency IDs instead of array replacement.
- Recent activity may use server-received ordering and bounded last-write-wins because it is
  non-authoritative convenience data.
- A newer unknown/absence does not erase a known value unless the operation explicitly clears it.

## PostgreSQL mapping

Existing `user_*` tables already contain owner-scoped RLS. A future migration must add a user sync
revision, idempotency ledger and explicit conflict records without rewriting released migrations.
The current `user_entity_progress.status` vocabulary must be mapped deliberately to local tri-state
semantics; `unknown` should remain absence, and `inferred` must not be mislabeled as user-confirmed.

All sync writes require both grants and RLS. Tests must replay writes as two authenticated subjects,
attempt another user's ID, retry the same operation, race the same base revision and exercise
`INSERT/UPDATE/UPSERT ... RETURNING`.

## Readiness gaps

Cloud sync remains blocked until individual authentication, session refresh/revocation, migration
deployment, backup/restore, conflict UX, monitoring and a privacy/retention decision exist. No hosted
Supabase configuration was inspected or changed in Iteration 4.5.
