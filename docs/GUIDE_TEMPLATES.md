# Guide Templates

VynodeArr can retrieve current TRaSH Guides recommendations for both Movies and
TV, let an administrator review and customize them, compare them with the
connected engine, and apply only the approved changes.

Applying a template changes engine configuration. It does not search for media,
rename files, move folders, or modify existing media files.

## Before you begin

- Connect and enable the applicable Movies or TV engine.
- Sign in with an administrator account.
- Back up the service configuration before making broad profile changes.
- Remember that Movies and TV are independent. Applying a Movies template does
  not apply the equivalent TV template.

## Open the template browser

1. Open **Service Settings → Guide Templates**.
2. Select **Movies** or **TV** at the top of the page.
3. Select the template family.
4. Use the category chips or **Find a template** box to narrow the results.
5. Select **Review** on a template.

Relevant settings pages also include a **Browse TRaSH templates** link. Opening
the browser from one of those pages automatically filters the catalog to the
template types that belong there.

## Template families

| Template family | What it configures | Where the result appears |
|---|---|---|
| Custom formats | Rules that recognize and score release characteristics | **Service Settings → Custom Formats** |
| Format groups | Related custom formats recommended as a set | **Service Settings → Custom Formats** and quality-profile scoring |
| Quality profiles | Allowed qualities, upgrade behavior, cutoffs, and scoring | **Service Settings → Quality Profiles** |
| Quality size | Minimum, preferred, and maximum size limits by quality | **Service Settings → Quality Profiles** |
| Naming | Recommended movie, series, season, episode, and folder naming | **Service Settings → Media Management** |

The template browser shows only families supported for the selected domain.

## Review and customize

The review window translates the upstream JSON into controls appropriate for
that template type. The upstream recommendation is the starting point; changes
made in the review window are what VynodeArr proposes to the engine.

For custom-format conditions:

- **Name** is the readable label shown for the condition.
- **Required** means the condition must pass for the custom format to match.
- **Negated** reverses the condition.
- **Required + Negated** is valid and means the specified value must be absent.
- **Advanced matching values** contains the engine-native matching fields, such
  as a regular expression, source, resolution, language, or release group.
- **Include when renaming** adds the custom-format name to renamed files when
  the engine supports that behavior.

For custom formats and format groups, **Apply scores to quality profiles** lets
you choose a TRaSH score set and the engine profiles that should receive that
score. Selecting no profiles leaves profile scores unchanged.

Quality-profile, quality-size, and naming templates use editors tailored to
their actual engine fields rather than a generic JSON editor.

Use **View upstream JSON** when you want to inspect the original recommendation.
You normally do not need to edit JSON directly.

## Compare before applying

Select **Review engine changes** after customizing a template. VynodeArr reads
the current configuration from the selected engine and classifies the result:

- **Add** — the setting does not exist and will be created.
- **Update** — the setting exists, but one or more values differ.
- **Unchanged** — the engine already matches the reviewed template.

For updates, review the before-and-after values shown in the comparison. An
existing setting is not overwritten silently: VynodeArr asks for explicit
confirmation before replacing it.

If the proposed result is not what you want, return to the editor or select
**Reject**. Rejecting closes the review without changing the engine.

## Apply a template

1. Confirm the correct **Movies** or **TV** domain is selected.
2. Review and customize the template.
3. Select **Review engine changes**.
4. Inspect every proposed addition or update.
5. Confirm the overwrite when an existing setting will change.
6. Select **Apply reviewed template**.

VynodeArr sends the reviewed configuration to the selected engine, then reads
the engine again. The engine response becomes the source of truth for the UI.
The resulting custom format, profile, size limit, or naming configuration
therefore appears on its normal settings page without maintaining a separate
VynodeArr-only copy.

## Updating an applied recommendation

1. Open **Guide Templates** and select **Check for updates**.
2. Select the same domain and template.
3. Review it again.
4. Compare the current engine configuration with the new recommendation.
5. Apply only if you accept the displayed changes.

Local engine edits are preserved until you explicitly approve an overwrite.
Checking for updates or opening a template never changes engine configuration.

## Troubleshooting

### The service is unavailable

Confirm the selected Movies or TV engine is enabled and healthy. Open
**System → Health**, verify the engine connection, and retry the template after
the service is reachable.

### A template does not appear on the expected page

Confirm that the apply operation completed successfully and that you are viewing
the same Movies or TV domain. Refresh the destination page so VynodeArr reads
the latest engine state.

### Applying produces a validation error

Return to the comparison and review the highlighted fields. The connected
engine validates the final payload, and supported fields can vary by engine
version. Restore the recommended value or update the engine if the template
requires a newer capability.

### Scores did not change

Scoring is optional. Reopen the template and confirm that a score set and at
least one quality profile were selected before applying.

## Recommendation source

Templates retain their TRaSH identity and source revision so changes can be
reviewed later. VynodeArr does not automatically synchronize or overwrite
engine settings in the background. The administrator always reviews and
approves the proposed configuration.
