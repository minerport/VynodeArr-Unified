# VynodeArr Companion — Android preview

Native Kotlin / Jetpack Compose companion for VynodeArr. One Android project provides touch layouts for phones and remote-friendly layouts, visible focus borders, and safe margins for Android TV. It does not run media engines or stream library video.

## Included in 0.19.0-preview

- Overview adds compact collection and transfer metrics, storage, missing media, health notices, upcoming releases, recent imports and activity. Feeds arrange side by side on wide screens. All data uses the existing permission-checked dashboard response.
- Calendar adds movie/TV filters, day/month agendas and paged release lists for remote navigation, with localized weekday names.
- Shared glass material adds layered neutral highlights, edge reflections and soft shadows, plus ambient light on pages without artwork. No backdrop blur is claimed.

- Main-app browsing views: Poster grid, Information cards, Compact grid and Detailed list in both libraries and Discover; Discover also keeps its horizontal shelves. View choice survives opening details.
- Library A–Z navigation resolves the first exact matching sort title in the actual paged results, avoiding older servers' display-title letter offsets. Empty letters show an empty state without selecting a neighbour. Only the results region loads; navigation, controls and background stay in place.
- TV: Right from the active library navigation item enters the A–Z selector; Left/Right chooses a letter, OK jumps, Down enters titles, and Up from the first poster row returns to the selector. Every letter button remains focusable. Phones retain the exact-letter slider and scrollable letter buttons.
- Assigned poster templates use the existing authenticated composed-artwork endpoint, including SVG imagery. Discover uses library templates only for matching titles that the signed-in user can view. Posters retain their proportions and use high-quality scaling, with original-art fallback on composition failure.
- TV library details include season selection, complete episode lists and All/Available/Missing filters, with episode numbers, air dates, quality and monitoring state. These remain read-only.
- Compact full-information details: smaller poster/title header, 13sp synopsis, 12sp facts, side-by-side synopsis and metadata on TV, and compact cast rows. Long text wraps without truncation; library details use a compact header and flowing facts.
- Neutral silver-white accents replace purple. Primary actions use translucent fills; button highlights fade in 160ms, posters ease into focus in 180ms, and background artwork dissolves over 380ms.
- Calendar month grid with selectable dates, release counts, Today/month controls and day agenda. Visible months fetch their own server date range; UTC events use device local dates.
- Tighter poster captions: no reserved blank title line, 5dp artwork-to-title gap, compact metadata, smaller availability badges, and softened card corners.
- Unified typography: bundled Outfit family, consistent heading/body/caption styles, left-aligned TV navigation, up to two-line poster captions with compact metadata, and shared title previews with a fixed bottom action. The font license is bundled in app assets/licenses.
- Dark artwork-backed presentation: focused titles supply full-screen background art with contrast-preserving fades. Navigation and summary panels use translucent glass gradients and fine highlights; posters remain unboxed. This uses lightweight compositing compatible with older Android TV devices.
- Movieme-inspired TV layout: permission-aware left navigation, midnight navy canvas, subtle silver-white accents, central poster rows, and a focus-following summary panel for Discover and libraries. Full details remain a separate page. Phones retain a stacked layout.
- Floating portrait artwork in Discover and libraries: no filled card bodies or idle borders, captions beneath posters, and restrained focus outlines. Library posters lift slightly on focus. Navigation uses unfilled controls; primary actions remain prominent. Search expands on demand. Details and overview blend into the continuous dark background.
- Library tools: missing/upgrade-needed/monitored/unmonitored filters, title/year/recently-added/rating sorting, engine selection, clear filters, and poster, information-card, compact-grid, and detailed-list views. Filtering and sorting apply server-side across pages.
- Permission-aware navigation: Movie library, TV library, Calendar, Overview, Discover and My requests appear only with their matching server permissions. Download activity is administrator-only; Account remains available to everyone.
- Libraries include search, paged browsing, artwork, availability/quality, and read-only details. Library-only accounts can sign in without Discover access. Account shows approval rules and configured request limits. Access is rechecked before section loads and request submission; the server remains authoritative.
- Five-minute short-code pairing approved in a browser signed in to VynodeArr.
- Normal account sign-in works with existing VynodeArr servers, without installing pairing endpoints. Older servers automatically fall back to sign-in when pairing is unavailable.
- Portrait artwork rows with title, year, rating and library badges; a title summary follows TV focus. Phones use swipeable rows and horizontal navigation. Search expands only when needed.
- Real server posters are preferred in rows, with backdrop fallback. Explore title opens details, trailer and request actions.
- Rows hold up to twelve titles and scroll with TV left/right navigation or phone swipes. Browse now focuses the row; previous/next buttons move through its titles.
- Full-page details with a fixed action bar. Informational sections and cast are not selectable; cast wraps onto the page. TV up/down scrolls the page and left/right chooses actions. The hero starts at the top without focus-driven scrolling.
- Details headers grow with long titles and metadata; opening a different title resets the details scroll position.
- Expanded details include a separate portrait poster, backdrop, full synopsis and tagline, rating, genres, certification, runtime, production information, cast and characters, and TV season summaries when supplied by the server. Posters retain their aspect ratio; failed backdrops fall back to posters.
- Android Keystore-encrypted saved sessions; sign-out and normal server-side session revocation.
- Trending, popular movies, popular television, upcoming movies, paged results, and title search.
- Details, library presence, and popup YouTube trailers with remote-friendly Play, Pause, player controls and Close. Back returns to the title; leaving the app closes the player. Open in YouTube remains available for unsupported or blocked embeds.
- Movie and whole-series requests with explicit engine/destination selection and configured folder/profile fallback.
- My Requests with approval status, server messages, rejection reasons, and manual refresh.
- Existing account permissions, request limits, approval rules, and engine validation remain authoritative on the server.

Library edits, deletions, download management, approval administration, and server/user settings remain in the web app. Existing short-code approval requires Discover access on the server; library-only users should use normal account sign-in.

This preview does **not** include QR codes, push notifications, library playback handoff, full movie/episode playback, watch history, or season-specific requests. It uses existing VynodeArr accounts; it does not connect through Vynode Cloud.

Trailer embedding uses the official YouTube IFrame API in Android WebView, with the installed application ID as the HTTPS base origin/referrer. YouTube restrictions and device WebView availability still apply. No stream extraction or TLS bypass is used. See https://developers.google.com/youtube/terms/required-minimum-functionality and https://developers.google.com/youtube/iframe_api_reference.

## Server requirement and pairing

Account sign-in uses the existing `/api/auth/login` endpoint and does not require a server update. Optional short-code pairing requires the accompanying server changes in this repository. This work does not deploy or upgrade your running server.

1. Install the debug preview APK on a test phone or compatible TV.
2. Enter the reachable VynodeArr origin, e.g. `https://media.example.com`. You may also enter a bare hostname or IP and port. Reverse-proxy subpaths are not supported by this preview.
3. HTTPS is the default. For a trusted home network only, explicitly enable HTTP and enter a private IPv4 address. Public HTTP, credentials in URLs, and redirects are rejected. This does not set up remote access or open router ports.
4. Choose **Sign in with account** and enter your existing VynodeArr username/email and password. Passwords are not saved; the session is encrypted with Android Keystore.
5. Alternatively, choose **Connect and get a code**. If supported by the server, open `<server>/companion-pair.html` in a browser, sign in with an account that has Discover permission, enter the device code, review the device name, and approve. The companion polls every five seconds. If pairing is not installed, it switches to account sign-in.

Revoke companion sessions under **Account → Sessions**. With the accompanying server update they appear as **VynodeArr Companion on Android**; older servers may show a generic Android/browser label. If the device is offline, revoke it from the browser. Codes expire after five minutes and are invalidated by a server restart. Pending codes are rate-limited and memory-bounded. Only the private 256-bit device code can retrieve the session; the human code cannot. Sessions follow the same permissions as the approving account, including administrator permissions if an administrator pairs the device.

## Device targets

- Android phones: Android 8.0/API 26 or newer.
- NVIDIA Shield / Android TV: API 26 or newer; phone and TV launcher entries are included.
- Fire OS: Android-based devices meeting API 26 minimum (Fire OS 7+). No Google Play Services dependency. Physical Fire TV validation is still required.
- Vega OS Fire TV devices cannot run this Android APK and need a separate implementation.

This is a debug-signed preview, not an app-store release. Keep the same signing identity for updates; production signing and store submission remain separate work. Do not distribute a debug build as a production release.

## Build and checks

Requires JDK 17 and Android SDK 36. Set `ANDROID_HOME` or create an ignored `local.properties` with `sdk.dir`.

```powershell
.\gradlew.bat testDebugUnitTest lintDebug assembleDebug
```

APK: `app/build/outputs/apk/debug/app-debug.apk`.

On Windows machines where Java does not recognize a locally trusted certificate authority, use the Windows root store without disabling verification:

```powershell
.\gradlew.bat testDebugUnitTest lintDebug assembleDebug '-Dorg.gradle.jvmargs=-Xmx3g -Dfile.encoding=UTF-8 -Djavax.net.ssl.trustStoreType=Windows-ROOT -Djavax.net.ssl.trustStore=NONE'
```

From the repository root, `npm run verify` runs server tests, type checks, builds, and deployment checks. `tests/companion-pairing.test.js` exercises code expiry, creation limits, concurrent approvals, secret isolation, CSRF, inherited permissions, and revocation.

## Disposable end-to-end review

From the repository root:

```powershell
npm run build:server
node scripts/companion-review-server.mjs
```

This creates isolated temporary data and fictional metadata, binds **only** to `127.0.0.1:18787`, and never acquires media. The review user is `preview-user` with password `Companion-Preview-Only1`; those credentials are only for this disposable fixture server. The browser address is `http://127.0.0.1:18787/companion-pair.html`; Android emulators use `http://10.0.2.2:18787` with trusted-LAN HTTP enabled.

With phone and TV emulators running, execute from this directory:

```powershell
.\gradlew.bat connectedDebugAndroidTest
```

The instrumentation test pairs through the real server API, uses directional key navigation between TV posters (touch on phones), submits a request that must await approval, recreates the activity, reopens with the saved session, and signs out. It saves screenshots in the runner's additional-output directory, or the app external-files directory when run directly. Unit tests also cover URL policy, exact request identities/routing, invalid request options, and null metadata.

If the Gradle UTP host cannot receive results because its local gRPC TLS channel fails, run the same instrumentation APK directly after `assembleDebugAndroidTest`:

```powershell
adb -s emulator-5554 install -r app/build/outputs/apk/debug/app-debug.apk
adb -s emulator-5554 install -r app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb -s emulator-5554 shell am instrument -w -e class com.vynode.companion.CompanionFlowTest com.vynode.companion.test/androidx.test.runner.AndroidJUnitRunner
```

Use the appropriate emulator serial from `adb devices`. This runs the same test assertions without the host result-transport layer; it does not change TLS settings in the application.

End-to-end tests require the disposable review server above. Do not point them at a production installation. Stop that server with Ctrl+C after review.






### Preview 0.17 checks

Start `node scripts/companion-review-server.mjs`, then run `node scripts/companion-review-template.mjs` from the repository root to seed the disposable template fixture. The `PosterTemplateTest` verifies that composed SVG artwork decodes with its embedded photograph. Run it with `PermissionsNavigationTest`, `CompanionFlowTest`, and `DetailsLayoutTest` on TV and phone emulators.

Template display uses the existing `/api/artwork/composed/{domain}/{id}` endpoint and the same server assignments as the web app. Rendering support uses [Coil's SVG decoder](https://coil-kt.github.io/coil/changelog/). Older servers or unavailable compositions fall back to original artwork in the browsing grids. No template assignments are changed by the companion.

### Preview 0.18 alphabet regression checks

`LibraryAlphabetTest` covers sort-title/display-title differences, missing letters, numeric/non-Latin titles, and a target beyond 1,000 preceding titles. `AlphabetNavigationTest` exercises actual remote keys, focus retention, list-only loading, empty-letter behavior and returning to the start. Start the disposable fixture server with `COMPANION_REVIEW_LIBRARY_DELAY_MS=180` for that test to make the loading state observable.

## Repository CI

The Android companion workflow runs unit tests, lint, and debug APK builds for changes to this directory. Its APK is a temporary CI debug artifact; CI signing may differ from locally installed previews. Device instrumentation tests require the disposable server and emulators described above. Native sources are excluded from the server Docker build context. Live TV/DVR remains a proposal, not an implemented feature.
