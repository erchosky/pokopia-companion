# My Pokopia V4

My Pokopia remains local-first. Version 4 uses `pokopia-progress-v4` and migrates V3, V2 and the
legacy array without deleting or coercing existing entries.

## Added tracking

- Important Requests: completed / explicitly not completed / unknown.
- Treasure Maps: found / explicitly not found / unknown.
- Music CDs: acquired / explicitly not acquired / unknown.
- Ditto Moves: learned / explicitly not learned / unknown.

The dashboard provides text, group and state filters. Its headline is “X of Y known”; Y is the
current canonical projection (78 progression entries), not an assertion of total game completeness.
No inventory quantity is introduced.

## Goal Engine V3

New targets are `complete-quest`, `complete-treasure-map`, `get-collectible` and
`learn-ditto-move`. Evaluation preserves the prior tri-state rules and uses forward dependency
edges. Next Actions V2 routes each goal to its typed page and only calls it complete when the matching
kind-specific state is confirmed.

## Privacy and future sync

State is stored in browser localStorage. The Goal API receives a maximum 64 KiB ephemeral payload,
evaluates it and does not persist it. PostgreSQL user tables and owner RLS remain available for a
future opt-in sync, but hosted auth/sync is not part of this iteration.
