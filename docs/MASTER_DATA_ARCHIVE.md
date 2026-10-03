# Master data archive

Verified: 2026-08-11  
Snapshot: `serebii-pokopia-20260809T005646`

## Verified master source

The private immutable source archive is `Pokopia-KB-FULL-20260809-005646.zip`. Two independently
located local copies have the same SHA-256:

`251f4b0e5d87a3857d6ddf98294a99a2f9f682f3f022fb93be4ffd95bf00987c`

The ZIP passes integrity and contains 27,986 files, 1,824,914,472 uncompressed bytes and 2,532 RAW
pages totalling 379,301,412 bytes. The extracted repository-private copy was checked read-only:
every RAW path exists, every byte count and page SHA-256 matches `MASTER_INDEX`, the legacy SQLite
passes integrity and contains 2,532 pages, and all source references in the compact REVIEW database
resolve to a matching master URL and hash.

The copy under Downloads contains an additional nested `Archivo.zip` in its extracted directory.
That extra file is not part of the authoritative ZIP and is not evidence of a changed master corpus.
The two authoritative ZIP files themselves are byte-identical.

Machine-readable evidence lives in
`audit-data/iteration-4-6/master-data-manifest.json`. Re-run `npm run data:verify-master` whenever
the private corpus is mounted locally. The gate is deliberately read-only.

## Three different data layers

### A. Master Source Archive

`Pokopia-KB-FULL` is the private immutable research corpus: RAW HTML, mirror assets, Markdown,
tables, structured legacy extraction, RAG documents, indexes and the source SQLite. It is the only
layer that can recover the original captured bytes or support a complete future reparse. It is not
published and is never included in a REVIEW archive.

### B. Canonical Knowledge Store

The canonical layer contains typed entities, reviewed assertions/evidence, relationships, facts and
game-version semantics. The checked V3.1 SQLite contains all 2,532 pages and is an ingestion output;
the normalized PostgreSQL schema is the long-term accepted-data model. Canonical data preserves
provenance but does not replace the original captured bytes.

### C. Runtime Projection Store

`audit-data/pokopia-review.sqlite` is a compact, rebuildable projection for application and review
tests. It contains 2,078 selected source pages and enough rows to reproduce 3,043 PostgreSQL runtime
projections. It intentionally excludes most source text, RAW HTML and mirror assets.

**Runtime projection is NOT an archival backup.**

## Reproducibility boundary

| Artifact                          | REVIEW only | Requires master corpus |
| --------------------------------- | ----------: | ---------------------: |
| Runtime application               |         Yes |                     No |
| Existing 3,043 projections        |         Yes |                     No |
| Current tests                     |         Yes |                     No |
| Existing selected evidence chains |         Yes |                     No |
| Reparse all 2,532 pages           |          No |                    Yes |
| Build parser for an unused domain |          No |                    Yes |
| Recover original RAW HTML         |          No |                    Yes |
| Recover mirror assets             |          No |                    Yes |
| Rebuild future knowledge domains  |          No |                    Yes |

The REVIEW package proves the current product and compact projection are restorable. It does not
claim that the private corpus can be reconstructed from the REVIEW package.

## Loss-detection contract

`npm run data:verify-master` fails if the archive, `MASTER_INDEX`, source SQLite, any RAW page hash or
byte count changes; if a RAW page disappears; if the compact runtime database changes unexpectedly;
or if a runtime source URL/hash no longer resolves to the master index. CI without the private
corpus must compare the committed manifest and treat absence of the corpus as an expected skipped
external gate, never as proof that the bytes still exist.

## Rights and handling

The corpus is private research material sourced from a community website. Do not publish, upload or
redistribute it without a separate rights review and authorization. Application output should retain
source attribution. The REVIEW ZIP contains only manifests and compact derived data.
