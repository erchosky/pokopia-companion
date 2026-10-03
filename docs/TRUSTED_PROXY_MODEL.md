# Trusted proxy model

## Invariant

Client-controlled forwarding headers are untrusted unless the application is known to run behind the
declared platform. Direct/generic requests resolve to `proxy:unresolved`; protected rate-limit
policies fail closed if their store cannot provide a trustworthy decision.

For Vercel, the platform overwrites `x-forwarded-for` to prevent spoofing and exposes
`x-vercel-forwarded-for` as its equivalent platform value. Pokopia consumes the latter only when
`VERCEL=1`. A generic proxy must strip incoming forwarding headers, append its own address and set
`POKOPIA_TRUST_PROXY_HEADERS=true` only after this behavior is tested.

`x-forwarded-host` is trusted for origin comparison only under the same explicit platform contract.
The externally visible origin remains fixed in `POKOPIA_PUBLIC_ORIGIN`; arbitrary request headers do
not select an allowed origin or administrator role.

## Hosted replay required

1. Send direct, missing, malformed, IPv4/IPv6 and comma-chain values.
2. Attempt to rotate the key with forged `x-forwarded-for`, `x-real-ip` and
   `x-vercel-forwarded-for` from outside the platform.
3. Confirm two concurrent instances consume the same PostgreSQL bucket atomically.
4. Confirm authentication/admin policies deny on store timeout; public low-cost reads may degrade as
   explicitly configured.

These semantics are unit- and PostgreSQL-tested locally. Platform overwrite behavior and the final
address observed by the deployed function remain BLOCKED until staging exists.
