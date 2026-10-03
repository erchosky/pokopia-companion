# Goal Engine V4 and Next Actions V3

Goal evaluation accepts bounded V5 inventory state in addition to legacy progress entries. For
materials/items, `not_owned` or confirmed zero is missing, owned with unknown quantity is unknown,
and a positive confirmed quantity is structurally satisfied. Absence remains unknown.

Crafting and automation detail pages call the shared rule engine. Goal evaluation does not recreate
batch or throughput arithmetic. When quantity/evidence is unknown, the next useful action is to
confirm inventory or open the evidence-aware planner rather than declaring the goal ready.

The API remains ephemeral, bounded and non-persistent. My Pokopia sends only goals, progress entries
and sanitized inventory state.
