# Automation Engine V2

Automation separates build materials/unlocks, operational inputs, infrastructure, Pokémon roles,
material outputs, effects, town compatibility, version/DLC, limitations and evidence. An effect is
never counted as a material output.

`evaluateAutomation` returns independent build and operational readiness (`yes`, `no`, `unknown`)
with satisfied, missing and unknown requirements plus traces.

- Confirmed recipe and inventory quantities can satisfy or deny build readiness.
- Owned with quantity unknown leaves numeric build readiness unknown.
- Electricity affects operation, not construction materials.
- Built unknown leaves operation unknown; explicitly not built blocks it.
- A positive compatible-town link can satisfy compatibility. Lack of a link is not negative evidence.

The UI renders structural chains as `construction materials -> system -> operational effect`. Ten of
11 systems have a structural requirement/effect chain; none has accepted parameters for quantitative
throughput. Items/min, duration, range, capacity and consumption remain unavailable.

Measurement parameters support exact, range and unknown values. Only `reviewState=accepted` enters
computation. `whatCanAutomate` classifies ready, blocked and needs-verification systems.

See `audit-data/iteration-5/automation-coverage.json`, `production-chain-coverage.json` and
`p0-evidence-queue.json`.
