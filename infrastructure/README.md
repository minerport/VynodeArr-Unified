# Infrastructure boundary

N1 intentionally ships no production container topology. N2 will define a
gateway-facing private network, per-engine data volumes, health probes, secrets,
resource limits, backup ownership, and user-visible VynodeArr service labels.
