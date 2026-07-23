# ADR 0002: read-only adapters and review deployment

Status: accepted for N2.

Use one VynodeArr gateway container connected to separately running internal
engines. Adapters issue GET requests only and translate into owned models. The
gateway owns authentication and caching; engines remain sources of truth.

Fixture mode uses the same contracts and never mixes records. Existing-engine
mode is preferred. Bundled-engine profiles remain inert until legal, update,
security, and corresponding-source requirements are resolved.

Consequences include fast real-data review and low packaging coupling, balanced
against continued engine availability/version dependency and the need for
future persistent projections and authenticated artwork proxying.
