# Shared platform boundaries

The platform owns authentication, users/roles, navigation, UI preferences,
secrets, provider registration, indexers, download clients, remote path
mappings, tags, quality/custom-format definitions where policy can be injected,
delay/restriction policy, queue normalization, commands, scheduler, activity,
history/calendar aggregation, notifications/webhooks, health, disk space,
logging, backup orchestration, updates, audit, and application settings.

Domain adapters receive scoped credentials and return neutral models. They do
not decide UI navigation or expose internal DTOs. Queue/history/calendar items
carry a `domain` discriminator and stable VynodeNew IDs.

Shared does not mean identical: naming, parsing, monitoring, search decisions,
import decisions, and wanted/cutoff calculation remain domain policies behind
shared orchestration contracts.
