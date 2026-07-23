# Branding leak prevention

The release gate scans the public UI, routes, messages, CSS, static assets,
normal documentation, Docker/Compose names, Unraid overview, tests, and built
web bundle for prohibited source-product names. API tests also serialize normal
and error responses to verify neutrality.

Allowed locations are limited to internal adapter implementation where
unavoidable, development-only source inventories, licensing strategy, and
legal/open-source notices. Container names, health text, engine status, and
user documentation use Movies, TV, or VynodeArr.

Run `npm run check:branding`; CI runs it after tests and before accepting a
build. Do not globally rename or modify separately licensed source.
