# Operations SLOs and measurement plan

These are proposed staging objectives, not measured production claims. They become enforceable only
after a hosted baseline supplies real traffic and error-budget data.

| Signal                                          |            Staging objective |     Window | Alert proposal                  |
| ----------------------------------------------- | ---------------------------: | ---------: | ------------------------------- |
| Readiness availability                          |                        99.5% |    30 days | 3 failed checks in 5 minutes    |
| Public request 5xx rate                         |                         < 1% | 15 minutes | >= 2% with at least 20 requests |
| Admin authorization failures caused by provider |                       < 0.5% | 15 minutes | >= 2 failures in 5 minutes      |
| Public p95 server latency                       |                     < 750 ms | 15 minutes | >= 1,200 ms for 10 minutes      |
| Admin p95 server latency                        |                   < 1,500 ms | 15 minutes | >= 2,500 ms for 10 minutes      |
| Database pool saturation                        |                        < 80% | 10 minutes | >= 90% for 5 minutes            |
| Rate-store failures                             | 0 protected fail-open events |  immediate | any event                       |
| Backup freshness                                |                       < 24 h |      daily | older than 26 h                 |

Every request should carry `x-request-id`; structured events must include event name, deployment,
request ID, anonymous subject hash when relevant, latency class and safe error class. Authorization,
cookies, tokens, passwords, provider secrets and database URLs are redacted. Logs require a defined
retention period and restricted operator access before production.

Run controlled load against staging only, starting at 1 concurrent user and increasing in bounded
steps. Record warm/cold latency, 4xx/5xx, database connections and limiter decisions. Stop on error
spikes, pool saturation, provider throttling or budget impact. No hosted measurements exist yet.
