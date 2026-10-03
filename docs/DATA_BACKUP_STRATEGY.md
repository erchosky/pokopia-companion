# Data backup strategy

## Three independent backup subjects

### Source archive backup

Back up the immutable `Pokopia-KB-FULL-20260809-005646.zip`, not merely the extracted directory.
The verified object is 1,044,301,394 bytes with SHA-256
`251f4b0e5d87a3857d6ddf98294a99a2f9f682f3f022fb93be4ffd95bf00987c`.

Minimum acceptable layout:

1. Primary local archive adjacent to the private source mount.
2. One independent copy on a different physical device or separately protected storage account.
3. The SHA-256 and `master-data-manifest.json` stored separately from both archive copies.
4. Quarterly and post-transfer verification with `shasum -a 256` plus ZIP integrity.

The two local copies observed during Iteration 4.6 protect against accidental file editing but may
still share the same Mac and failure domain. They do not yet prove off-device disaster recovery.
No remote upload was performed.

Recovery consists of copying the ZIP into an isolated directory, verifying its SHA-256 and ZIP
integrity, extracting without overwriting an existing snapshot, and running
`npm run data:verify-master` against the expected private mount.

### Application and database backup

Hosted PostgreSQL backups cover canonical data, admin/audit state and future user state. They do not
contain the master mirror. Before public traffic, staging must prove provider backup configuration,
retention, a restore into a separate safe target, application integrity, and measured RPO/RTO.
Forward-only migrations require a corrective migration or tested database restore; a down migration
is not assumed.

### Code backup

Git plus the clean REVIEW ZIP preserve code, lockfiles, migrations, tests, compact review data and
documentation. They intentionally exclude secrets, dependencies, builds, caches and the master
corpus. A passing code restore cannot be reported as a source-archive or database restore.

## Operator checklist

- Verify the exact target before copying or restoring.
- Never overwrite the only known-good master archive or extracted snapshot.
- Never put provider credentials or private environment files beside the archive manifest.
- Record date, operator, source/destination class, bytes, SHA-256 and verification result.
- Test restore into a new path; do not test by mutating the primary copy.
- After recovery, verify both archive integrity and application-level source-reference parity.
