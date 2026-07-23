# Unraid installation

1. Copy `infrastructure/unraid/vynodenew.xml` into your template workflow.
2. Map `/mnt/user/appdata/vynodenew` to `/data`.
3. Create the read-only secrets directory and stable `master-key` file.
4. Connect the container to the same private user-defined network as the Movies
   and TV engines.
5. Open port 4310, complete first-run administrator setup, then validate and
   save both engine cards.

Before upgrading, back up appdata and the master key. The container runs
automatic file-schema migrations at startup. If setup must be restarted, stop
the container, back up appdata, then use the documented local reset procedure
against only VynodeNew data.

Screenshots:

- `first-run.png` — initial administrator wizard.
- `dashboard.png` — post-login product dashboard.
