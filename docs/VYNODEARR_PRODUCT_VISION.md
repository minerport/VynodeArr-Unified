# VynodeArr product vision

VynodeArr is one media-management product: one login, dashboard, navigation
system, settings experience, activity stream, calendar, queue, and visual
language for Movies and TV. Users never need to understand engine topology.

The product treats Movies and TV as peers. Shared platform capabilities are
presented once, while each medium retains the concepts that make it correct:
availability and collections for Movies; series type, seasons, episodes,
specials, and numbering for TV.

## N1 success

N1 establishes boundaries and proves the request path:

`original web UI → VynodeArr API → engine registry → isolated neutral domain`

Fixture adapters are deliberately bounded and read-only. Full acquisition,
import, mutation, persistence, authentication, and scheduling are later work.
