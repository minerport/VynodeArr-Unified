# VynodeNew architecture

N2 remains a dependency-light Node.js 20+ application with an original web UI.
The gateway owns authentication, CSRF, rate limiting, normalization, error
redaction, synchronization, cache state, and aggregation. The browser never
contacts an engine.

```text
Browser → VynodeNew auth/API → synchronization projection
                              ├─ MovieEngineAdapter → hidden Movies engine
                              └─ TvEngineAdapter    → hidden TV engine
```

Adapters expose GET-only domain contracts. Engine configuration is server-only;
credential files or the encrypted vault boundary keep secrets out of browser
state. The in-memory cache is replaceable by platform persistence without route
changes. Engines and their isolated databases remain authoritative.

Deployment is one non-root `vynodenew` container with a persistent `/data`
volume. Existing-engine mode is operational. A Compose profile reserves
future isolated service/network seams but contains no engine binaries.
