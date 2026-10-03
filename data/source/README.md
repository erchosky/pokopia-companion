# Source snapshots

This directory contains local, immutable research inputs. Snapshot payloads are ignored by Git; only their manifests and integrity tooling are versioned.

The current source was extracted from `Pokopia-KB-FULL-20260809-005646.zip` into `snapshots/20260809/Pokopia-KB-FULL`. Neither the ZIP nor the extracted mirror may be published as part of the application.

Run `npm run data:verify-source` before a large processing run. The command checks the master archive and verifies that the required derived directories exist without mutating either copy.
