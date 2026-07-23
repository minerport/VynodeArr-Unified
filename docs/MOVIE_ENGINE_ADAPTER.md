# Movie engine adapter

`MovieEngineAdapter` reads movie library/details, artwork metadata, monitoring,
availability, files/quality, quality profile, root reference, collections,
tags, missing/cutoff state, queue, history, calendar, health, and system status.

Engine IDs are translated to opaque `movie_*` public IDs. Queue, history, and
calendar responses are normalized before aggregation. The adapter sends only
GET requests. Authentication, timeouts, non-success responses, and invalid
payloads become neutral gateway errors.

Known N2 boundary: engine artwork references are normalized but a dedicated
authenticated artwork proxy is deferred; inaccessible internal artwork falls
back to the VynodeNew media placeholder.
