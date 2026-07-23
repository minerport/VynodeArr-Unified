# ADR 0001: staged hybrid engine strategy

Status: accepted for N1.

## Decision

Choose Option C: begin with isolated hidden engine adapters, then extract
well-understood domain functionality only where maintenance, security,
performance, or product needs justify it.

## Rationale

Option A is fastest and upgrade-friendly but leaves packaging, operational,
performance, and license boundaries to solve permanently. Option B gives
maximum control but starts with the greatest merge, regression, migration, and
upgrade risk. Option C reaches useful behavior early, preserves isolated
databases, allows differential tests against mature behavior, and creates
deliberate extraction seams.

Adapters also provide an extensibility pattern for music, subtitles, indexer
management, request management, and aggregation domains. Costs are temporary
dual operation, normalization work, and a disciplined extraction program.

## Guardrails

Engines are never browser-visible; credentials remain server-side; databases,
migrations, logs, and lifecycle are isolated; capability/version negotiation is
mandatory; and any redistribution receives legal and security review.
