# Verification record

[Evidence retention and the selected galleries](verification/README.md) describe which images remain in the checkout. Historical test results retain their original scope; routine captures are generated artifacts.

## The Way, Brought to Life · 2026-09-22

[RFC-010](rfcs/010-the-way-brought-to-life.md) was drafted before implementation. This milestone refines Capernaum, shared characters, conversations, practical-action feedback, water and all ten **Into the Deep** scenes. Four chapters, 31 replay scenes, eleven optional stories, save v11 and the authored scripture remain intact. The [delivery guide](verification/rfc010/README.md) provides review entry points and six selected images.

The final `npm run check` passes evidence validation, types, ESLint, **562 unit checks across 29 files** and production build. Formatting and whitespace checks pass. Actual Babylon imports verify character facing, supported seating/standing, oar-to-hand contact, cargo clearance, new clips and every existing contact/solver contract. New presentation checks cover shortest-path turning, bounded clocks, pause/reduced motion, exact actor/camera recovery, action cleanup, scene disposal and framing at four viewport sizes.

The complete Chromium desktop/phone matrix passes **155 cases**, with **eleven intentional skips and zero failures**, in **46.1 minutes**, using one worker and no retries. This includes an uninterrupted fresh-save journey through all four chapters, existing save/load/recovery and practical-story regressions, all 31 replay scenes, conversation lifecycle cases, and all ten Chapter I compositions at desktop, portrait and short landscape sizes. The production build and assets served throughout this run remained unchanged. A final six-case presentation selection also passed in **1.6 minutes**, verifying a later screenshot-only helper that waits for paused rendering before capture; scenario assertions were unchanged. Firefox/WebKit passed all four startup, keyboard, practical-action and saved-state compatibility checks in **31.9 seconds**. That compatibility smoke is narrower than the Chromium matrix.

The [case-level delivery record](verification/rfc010/delivery.json) retains source/build hashes and exploratory outcomes. An initial full-suite attempt was intentionally interrupted after six passes to correct a visible button-contrast issue and Chapter I boat/cargo support. Initial asset checks rejected oversized exports; palette packing brought the catalog under the declared ceiling. The revised matte surfaces required a stricter image-difference threshold, from 0.20 to 0.12, while the allowed differing-pixel ratio stayed 0.02. Both reviewed static baselines then passed without updates, including their deliberate missing-geometry negative controls, and passed again in the full run. Apparent label truncation in image previews was checked against original-capture OCR with language correction disabled and DOM character bounds; the complete labels were present, and experimental CSS was reverted.

Blender MCP produced **nineteen revised GLBs**, fifteen matching WebP portraits and the reproducible `presence-kit.blend` workshop using Blender 5.2.1 LTS. Independent final-file imports checked geometry, rigged silhouettes, vertex colors and architecture while preserving the original Scene, Camera, Cube and Light. The [import record](verification/rfc010/independent-imports.json) records each export's hash and mesh/material/triangle counts. All **75 other GLBs remain byte-identical** to `d388fec`.

The [asset inventory](verification/rfc010/asset-delivery.json) records **94 GLBs totaling 6,706,812 bytes**, below RFC-010's explicit **7.5 MiB** ceiling. Fifteen portraits total **50,576 bytes**, below **384 KiB**. The largest regional addition is **715,700 bytes**, below **768 KiB** over the captured baseline. Actors remain below 5,000 triangles and props below 10,000; model-request concurrency remains four. The production application is **508,011 bytes**, CSS **65,974 bytes**, and the separate Babylon bundle **2,990,989 bytes**. Vite's existing large-chunk advisory remains.

| Reference space   | Desktop High / Low draw calls | Phone High / Low draw calls |
| ----------------- | ----------------------------- | --------------------------- |
| Capernaum shore   | 166 / 90                      | 140 / 64                    |
| Residential lanes | 112 / 52                      | 112 / 52                    |
| Gathering house   | 55 / 30                       | 55 / 30                     |
| Bakehouse         | 79 / 42                       | 79 / 42                     |

All samples report one settled scene within the unchanged **300 High / 130 Low** ceilings. The desktop shore previously measured 217/120, lanes 160/67, gathering house 71/37 and bakehouse 103/53. The [rendering record](verification/rfc010/rendering.json) includes all captured region/account observations and identifies viewport emulation. The sixteen Capernaum samples collected 120 intervals each on ANGLE Metal/Apple M3, with 16.7 ms medians and 17.8–18.5 ms p95; these bounded samples are not sustained physical-phone benchmarks.

Browser compositions and native Blender imports were visually reviewed, including all four Capernaum spaces, all ten Chapter I scenes, phone conversation layouts and storm water. [Reading measurements](verification/rfc010/reading.json) preserve panel bounds and the landscape-label check. The curated repository gallery contains **48 images totaling 31,425,699 bytes**, within its unchanged 30 MiB ceiling. Human discovery/pacing, historical/editorial review, screen-reader/touch usability and sustained physical-device performance remain outstanding in the [focused playtest](PLAYTEST.md#the-way-brought-to-life). No deployment or remote CI run is claimed.

## Capernaum, Fully Realized · 2026-09-21

[RFC-009](rfcs/009-capernaum-fully-realized.md) was written before implementation. This milestone adds the early original adventure **A clear way to the water**, a nine-prop village kit, ordinary activity in the four Capernaum spaces, save v11 and shared actor/focus corrections. The [delivery evidence and playtest entry points](verification/rfc009/README.md) include before/after compositions, independent Blender imports and four portable saves.

The final `npm run check` passes types, ESLint, **538 unit checks across 27 files** and the production build. Exhaustive arrangement coverage checks all 48 combinations against the actual connectivity rule. Both crossings and both reflections preserve unrelated progress. Tests exercise action guards, stale revisions, wrong orientation, obstructing cargo, graduated hints, changed arrangements, interruptions, historical v1–v10 migration and forged v11 saves. A new negative control first demonstrated that an array could stringify to a valid state name; explicit string validation now rejects that malformed input.

The final uninterrupted Chromium desktop/phone matrix contains **160 cases: 149 passed, eleven intentionally skipped, and zero failed**, in **44.4 minutes**, with one worker and retries disabled. This includes one fresh traveler completing all four chapters without replacing campaign state, all 31 replay scenes, both new landing solutions and the existing companion, carry, save, recovery, accessibility-layout and rendering regressions. The implementation remained unchanged throughout this run. [Case-level outcomes, production/source hashes and artifact hashes](verification/rfc009/delivery.json) identify the delivered build and evidence.

Actual imported Babylon geometry verifies supported north/south planks, matching cargo/grid positions, working-hand contact, grounded feet, four-direction actor facing and doorway shade outside the facade. The shared actor convention now agrees with the visible imported front; previously compensating Road/Nain callers retain their intended facing. The bread worker has a separate table. Ground patches face upward, and the awnings project outward. Named companions retain their own controllers and saved positions. Ordinary activity derives from earned state and the world's existing paused simulation lifecycle.

Blender MCP generated nine original exports and a separate source workshop with Blender 5.2.1 LTS. Independent final-file imports and Babylon-posed compositions produced seven review images. Both recipes restore the previously selected Blender scene. All **85 historical GLBs remain byte-identical**. The **94-model catalog totals 5,390,092 bytes**, adding **228,424 bytes** and remaining **377,076 bytes** below the RFC's explicit **5.5 MiB** ceiling. Every village region adds less than **192 KiB**; all other exploration inventories retain their exact earlier assets and bytes. Triangle caps and the four-request loader remain unchanged.

The Firefox/WebKit production compatibility smoke passes **four checks in 30.9 seconds**, including a keyboard landing arrangement and saved-state recovery in both engines. A deterministic desktop/phone test covers deferred dialog focus: a control focused before the next paint remains focused, and Tab advances to the next control. The initial broad browser attempt exposed that focus race; a later attempt was intentionally stopped for the malformed-save correction. The delivery record distinguishes those exploratory attempts from final acceptance.

Early landing checks also corrected a reflection-word expectation, an afloat fixture used for a shore capture, and reading diagnostics before the selected graphics quality had settled. The final rendering checks warm the actual scene and collect 120 frame intervals. All four village spaces pass the unchanged 300 High / 130 Low draw-call ceilings on desktop and phone: shore **217/120** and **176/79**, lanes **160/67** and **172/79**, gathering house **71/37** on both, and bakehouse **103/53** on both. Every sample reports one settled scene. Both existing software-rendered image references pass unchanged, and their missing-geometry negative controls still detect removed scenery.

Human pacing, historical/editorial review, physical touch, screen-reader usability and sustained device performance remain separate review tasks. Browser frame samples identify the actual renderer and do not claim physical-device measurements. The existing large Babylon engine chunk build advisory remains. No remote deployment or GitHub Actions run is claimed.

## The Journey in Your Hands · 2026-09-13

[RFC-008](rfcs/008-the-journey-in-your-hands.md) was written before implementation. This milestone makes the existing journey easier to discover and operate through a journal overview, compact objectives, nonmodal practical controls, reserved camera space, temporary screen-placement proposals, deliberate pointer gestures and shared keyboard focus handling. The existing four Gospel chapters, ten optional stories, save v10 and historical migrations retain their progression rules. Five [portable review saves and playtest steps](verification/rfc008/README.md) expose the new surfaces directly.

### State, controls and recovery

The final `npm run check` passed types, ESLint, **481 unit tests across 22 files**, and the production build. The 51 added unit checks cover suggestion accuracy and immutability, completed/replay/carrying states, shared practical guards, explicit screen directions, stale/remote commands, pointer ownership, viewport projection, camera restoration and disposal. Real Babylon geometry checks verify that proposals leave actual screen meshes and collision unchanged, and every channel section fits the reserved camera view at desktop, portrait and short landscape sizes. Existing solver, asset, contact, save and migration checks remain in place.

The browser acceptance covers journal tracking, objective expansion, work/read/return, keyboard action focus, disclosure and import focus order, saved orientation, temporary proposal discard and commit, interrupted work, replay return, shore supplies, neighborhood bread and deliberate boat boarding/docking. Failed boarding restores the same work controls for a deliberate retry. Walking away while a placement saves cannot update an obsolete panel. Menus invalidate pending focus and feedback callbacks, and previews never enter portable saves.

### Browser runs and corrections

The complete Chromium run at that stage contained **132 cases: 119 passed, eleven were intentionally skipped, and two failed**, in **26.0 minutes**. Both failures were navigation HTTP errors while the initial compatibility build concurrently replaced the shared production output. Compatibility now builds into its own `.compat-dist` locally and uses a separate port. Both interrupted campaign checks passed in the subsequent production selection. The uninterrupted fresh-save journey through all four chapters and 31 scenes passed in the complete run, along with the existing software image contracts and missing-geometry negative controls.

A subsequent mixed selection passed sixteen checks, skipped one and failed three. One import timed out under heavy concurrent local verification; two focus assertions omitted the existing **Start a new journey…** control from the expected tab order. The corrected acceptance suite then passed **all twenty desktop/phone cases in 3.0 minutes**, with one worker and retries disabled. After the final proposal geometry, landscape layout and failed-boarding recovery changes, the six affected browser cases passed again in **1.4 minutes**. All **133 runnable scenarios in the expanded 144-case Chromium suite** have therefore passed across the complete run and overlapping selections; this is not a second complete-suite run.

The separate real-WebGL compatibility smoke passed in **Firefox and WebKit**, **two checks in 1.8 minutes**. Each starts a journey, moves by keyboard, opens menus, performs a focused practical action, exports and reloads its saved result, and confirms one rendering scene with actual draw calls. Earlier compatibility attempts exposed a shared-server shutdown and assumptions about movement timing and click-to-focus; the final checks wait for movement and activate the action by keyboard. The local CI configuration adds both browsers on macOS against the same production artifact as the Chromium matrix. Remote GitHub Actions execution is not claimed.

An earlier unit run under concurrent generated-output linting hit existing timeouts. Generated compatibility output is now excluded from lint, formatting and development reloads. The final isolated unit run passed all 481 checks in **6.61 seconds**, without raising their timeouts. [The delivery record](verification/rfc008/delivery.json) preserves case-level results, artifact hashes and review limits.

### Blender assets and rendering

Blender MCP refined only the two channel pieces, receiving basin and reed screen in an isolated workshop, preserving unrelated scenes. Inset ochre bands clarify the actual open ends and inlet; a woven crest and asymmetric ties identify the screen face toward the seat. The recipes, source workshop and four exports ship together. An independent Blender MCP scene imported the final shipped GLBs for the [kit](verification/rfc008/living-galilee-kit.png), [channel](verification/rfc008/living-galilee-channel.png) and [resting-place](verification/rfc008/living-galilee-rest.png) reviews. Existing ports, contact, footing and collision checks passed. The proposal uses a broken outline and approach shape plus text; it neither accepts picks nor changes physical geometry.

The **85-model kit totals 5,161,668 bytes**, leaving **81,212 bytes** below the unchanged **5 MiB** cap. The other 81 GLBs retain their original bytes. Actor/prop triangle caps, region inventories and four-request loading remain unchanged. [All 85 model hashes](verification/rfc008/living-galilee-assets.json) and the source/review hashes in the delivery record match the shipped files.

| Focused work with active proposal | High / Low draw calls | High / Low median interval | High / Low p95 interval |
| --------------------------------- | --------------------- | -------------------------- | ----------------------- |
| Desktop 1440×900                  | 94 / 53               | 16.7 / 16.7 ms             | 17.7 / 17.7 ms          |
| Phone emulation 390×844           | 102 / 61              | 16.7 / 16.7 ms             | 17.6 / 17.7 ms          |

The limits remain **300 High / 130 Low**, and all four final samples report one settled scene. Each collected 120 intervals on ANGLE Metal / Apple M3. [Desktop](verification/rfc008/focused-rendering-desktop.json) and [phone](verification/rfc008/focused-rendering-phone.json) records contain the measured values. These bounded samples do not establish sustained physical-device performance. The existing large Babylon bundle build advisory remains.

Selected browser compositions retain the [desktop overview](verification/rfc008/fresh-journey-overview-desktop.png), [phone channel work](verification/rfc008/channel-work-phone.png), and [large-text landscape proposal](verification/rfc008/screen-preview-844-phone.png). The original run also reviewed other viewports and Firefox/WebKit; their structured outcomes remain in the delivery record.

Human pacing/editorial review, physical touch and screen-reader usability, and sustained device performance remain unverified. The compatibility smoke is narrower than the full Chromium journey suite. No public deployment was part of this implementation.

## A Connected Journey · 2026-09-12

[RFC-007](rfcs/007-a-connected-journey.md) was written before gameplay or asset changes. This milestone connects the existing four Gospel chapters, ten optional stories and ten exploration regions with saved final destinations, a returning-player recap, story status views, completed-account replay and the optional **The way home** closing interlude. Four [portable v10 examples](PLAYTEST.md#a-connected-journey) are generated through the actual reducers.

### State, continuity and reading

The unit suite contains **430 tests across twenty files**, including forty added checks. Coverage includes every historical v1–v9 fixture, exact prior state/journal preservation, all 31 replay checkpoints, projection without campaign mutation, stale/remote commands, locked accounts, boat berth and fractional afloat position, held supplies, both waiting companions, multi-region routes, unavailable destinations, all six return-visit orders, both choices at each visit, both closing reflections and forged-save rejection. Skipping every optional story still permits a complete closing interlude; conditional dialogue acknowledges only earned work.

The browser journeys cover deliberate boarding/docking and land passages while retaining the original final destination, reload/manual interruption/cancellation, all four replay accounts, transcript/previous/next/scene selection, failed replay startup and failed return with retry, exact underlying journey restoration, partial homecoming saves and large-text portrait/landscape layouts. One uninterrupted fresh-save journey completes the prelude, all four chapters and all 31 scenes without importing or replacing campaign state; it reloads after Chapter I and verifies earlier chapter state at each later completion.

Initial focused checks exposed an overly strict elapsed-time comparison, a transcript selector that omitted the storm account's markup, and a duplicate return-destination selector. Corrections retain exact progress comparisons while allowing ordinary elapsed seconds before/after replay; replay itself does not add play time. Inspection also identified quick-tray boarding that did not resume the saved route; it now uses the same continuation behavior as the reading-panel gateway action. Cancelling a route from the recap refreshes that recap; if it is opened during replay, the action first returns to the ordinary journey. Direct story/clue shortcuts reset the status view so an earlier Completed filter cannot hide unfinished evidence or its hints. Both road and lake shortcuts have browser regressions.

Screenshot review caught inherited dark text on the new dark dialogue/recap surfaces and pale headings/buttons on pale story/library cards. Scoped surface colors correct both combinations. Permanent browser assertions measure actual computed text contrast, including composited button backgrounds, for return dialogue, provenance, remembered choices, recap, status cards and the replay library. These checks supplement viewport/focus assertions; neither establishes screen-reader usability.

### Browser runs and local checks

The full production regression passed **111 checks**, with **eleven intentional skips**, in **50.5 minutes**. After the final gameplay, reading-panel and static-property refinements, a fresh production selection passed **seventeen checks**, with one intentional skip, in **8.1 minutes**. That selection includes two added direct-story shortcut cases. All **113 runnable scenarios** in the expanded **124-case suite** have therefore passed across the full run and overlapping final selections; this is not a second full-suite run. The [case-level record](verification/connected-journey-browser-runs.json) preserves the actual selections and outcomes.

The continuous fresh-save four-chapter journey also passed under forced SwiftShader with CI settings and retries disabled in **4.6 minutes**. This local software-renderer check exercises the dedicated CI job without claiming GitHub runner timing. A final route-button color refinement removes the browser-default gray surface. Both full desktop/phone route flows and the added contrast assertion passed again, with retries disabled, in **1.3 minutes**.

A concurrent local unit attempt passed 429 checks but timed out the existing exhaustive life-state round-trip check at 5.179 seconds against its unchanged five-second limit. An earlier posed-geometry attempt also timed out during concurrent verification. These were timing failures, not failed state/contact assertions. The final isolated `npm run check` passed all 430 unit checks in twenty files, types, ESLint and the production build with the original test timeouts unchanged.

### Assets, rendering and CI

Blender MCP generated the original passage marker and refined landing-pier silhouette in an isolated workshop, preserving unrelated scenes. Independent imports of the final GLBs produced the [kit review](verification/connected-journey-kit.png). Meshes posed through the actual Babylon importer produced the [carried pouch](verification/connected-journey-holding.png), [seated neighbor](verification/connected-journey-seated.png), working-pose and return-company reviews (the latter two captures are now retired). The geometry checks cover hand/prop proximity, seat/pelvis and feet/ground support, High/Low company reconstruction, marker bounds and reachable encounter approaches. [The asset record](verification/connected-journey-assets.json) preserves source, recipe, model and review-image hashes; all 95 recorded hashes were independently checked.

The **85-model kit contains 15 actors and 70 props**, totaling **5,152,636 bytes**, with **90,244 bytes** remaining under the unchanged **5 MiB** cap. The passage marker is 15,412 bytes and the refined pier is 31,344 bytes. The other 83 GLBs retain their prior bytes. Actor/prop triangle limits remain 5,000/10,000, inventories remain explicit and region loading retains its four-request bound.

The first completed-shore measurement exceeded the High draw-call cap at 312. An initial batching correction passed High but measured 153 on Low, above its cap. Static procedural paths, stones, jetty boards/posts and distant hills now combine only geometry sharing the same material, preserving geometry, materials, shadow reception and ground selection. Actors and imported GLBs retain their existing clone lifecycle. No rendering limit was raised and no required scenery was removed.

| Completed-shore reference | High / Low draw calls | High / Low median interval | High / Low p95 interval |
| ------------------------- | --------------------- | -------------------------- | ----------------------- |
| Desktop 1440×900          | 234 / 117             | 16.9 / 16.7 ms             | 34.7 / 18.2 ms          |
| Phone emulation 390×844   | 171 / 54              | 16.7 / 16.7 ms             | 18.3 / 18.4 ms          |

The limits remain **300 High / 130 Low**; all four final samples collected 120 intervals and reported one settled scene. The [rendering record](verification/connected-journey-rendering.json) preserves both the full-run and final reviewed measurements. The desktop High sample includes missed refresh intervals; these bounded local results do not establish sustained 60 FPS. The original bakehouse and Nain software image contracts, including their deliberately missing-geometry negative controls, passed unchanged in the full run.

The final application is **126.18 KB gzip**, CSS **12.35 KB gzip**, and the separately cached Babylon bundle **691.60 KB gzip** in the final production build. The existing large-engine-chunk advisory remains.

The reviewed reading surfaces measure **7.05:1–11.06:1** text contrast on desktop and phone; [computed measurements](verification/connected-journey-reading.json) accompany the regression assertions. Selected browser views retain [phone return dialogue](verification/connected-journey-home-phone.png), [large-text replay in landscape](verification/connected-journey-replay-landscape.png), and the [completed desktop shore](verification/connected-journey-shore-desktop.png). The original run also inspected continuation, saved routes, recaps, filtering and the replay library; case-level results remain in the structured records.

The [local CI enumeration](verification/connected-journey-shards.json) selects the 122 non-continuous cases exactly once across 32 shards: twenty-six have four cases and six have three. A separate desktop job runs the continuous fresh-save journey, and the required verification gate depends on it as well as the build and all shards. Only that test's intentionally skipped phone duplicate is omitted. The existing mixed-shard deadlines/retries remain unchanged; the dedicated job has a twenty-minute suite deadline and twenty-five-minute job deadline. Enumeration is not a claim that GitHub Actions ran.

Human editorial/pacing review, assistive-technology usability, physical touch devices, Safari/Firefox and sustained mobile/GPU performance remain unverified. Desktop Chromium and phone viewport emulation do not establish those outcomes. No public deployment was part of this implementation.

## Across the Lake · 2026-09-12

[RFC-006](rfcs/006-across-the-lake.md) was drafted before implementation. This milestone adds a controllable ordinary boat, two revisitable shores, Joel's landmark investigation and the seven-scene Mark 4:35–41 chapter, **Peace, be still**. The game contains four Gospel chapters and ten optional stories. The [playtest guide](PLAYTEST.md#across-the-lake) includes seven portable v9 saves for unlocked, afloat, docked, interrupted, carrying and completed journeys.

### State and geometry coverage

The unit suite contains **390 passing tests across eighteen files**. Types, ESLint, the production build, formatting, Python recipe compilation and whitespace checks pass. New coverage includes all three boarding/docking pairs, reachable land and water approaches, exact afloat position/heading, both clue orders and endings, wrong interpretations and all hints, every Gospel checkpoint and leave/resume path, all three reflections, full verse coverage, carried supplies, waiting companions, historical save preservation and forged-state rejection. Every v1–v8 fixture retains its existing state fields and journal while gaining empty lake progress. Reordered JSON keys remain valid; unsupported fields are not copied into the new record.

The real Babylon GLB importer verifies hand/oar contact through five stroke phases, seat and foot support, sleeping head/cushion and torso/platform contact, separation from the disciples, and hull clearance at every navigable water cell. The tests rejected detached grips, incorrect stern orientation and insufficient support before correction. [Measured contact data](verification/across-the-lake-contact.json) records hand/oar distances below 0.013 world units and oar blades dipping below and recovering above the water surface. The ordinary boat's floor now stays above the flat exploration water, including while berthed.

Opening a menu captures a fresh autosave and export waits for that snapshot. This closes the steering/reload interruption gap discovered during browser testing. Scene replacement remains transactional: failed boarding or Gospel loading retains the earlier scene and durable save. Direct continuation also covers failed Gospel startup, retry, a berthed boat, an older farm supply and an independently waiting Neri.

### Browser regression

The complete production run finished **106 cases in 35.0 minutes: 94 passed, two failed and ten were intentionally skipped**. One new test reloaded before leaving the Gospel scene had finished its transactional region change; it now waits for the destination and action completion. The other expected an eastern reed bank to draw outside the phone camera's view; the reference position now lies between the landmarks, with every essential-object assertion retained.

After the final boat staging, narration and objective corrections, a fresh production build passed **17 lake checks**, with one intentional phone skip, in **6.9 minutes**. This includes both previously failing checks and two new direct-Gospel startup/retry cases. Across the full run and overlapping reruns, all **98 runnable scenarios** in the expanded **108-case suite** passed. These are unique scenarios, not a second clean full-suite run. The [case-level record](verification/across-the-lake-browser-runs.json) preserves the actual run results.

Coverage includes both complete investigation journeys, keyboard steering, automatic navigation and cancellation, explicit docking/reboarding, held-item and waiting-companion persistence, exact afloat restoration, all Gospel controls and aftermath, failed loading, large text, reduced motion, portrait/landscape layouts, required-object drawing, draw-call limits and one settled scene. The original bakehouse and Nain software image contracts, including their missing-geometry negative controls, passed unchanged in the full regression.

Screenshot review subsequently corrected the investigation journal: unrelated neighborhood content is excluded by the story filter, **Review the clues** focuses the recollection, and interpretation/hint updates retain the relevant reading position. Both investigation journeys passed again in **2.3 minutes** after the focus assertion was narrowed to the named heading. An earlier selector matched two headings and failed before evaluating focus; that attempt is included in the case record. A final contrast correction keeps dark text on the clue panel's pale surfaces. The two investigation journeys then passed once more in **2.3 minutes**, with permanent assertions for rendered contrast and visibility of each new hint's text. [Rendered measurements](verification/across-the-lake-reading.json) show **10.15:1 heading contrast and 10.24:1 button contrast** on both tested viewports.

### Assets and review

Blender MCP generated the five new props and workshop in **Blender 5.2.1 LTS**, with addon 1.6/protocol 5. Independent imports of the shipped new GLBs produced the [kit review](verification/across-the-lake-kit.png). Posed meshes from the actual Babylon importer produced matching rower and stern views in Blender; the [rower view](verification/across-the-lake-rower.png) is retained. Unrelated scenes were preserved. The [asset record](verification/across-the-lake-assets.json) includes source, recipe, model and review-image hashes.

The **84-model kit has 15 actors and 69 props**, totaling **5,128,144 bytes**, with **114,736 bytes** remaining under the unchanged **5 MiB** cap. Lossless sharing of duplicate storage reduced the prior 79 exports by 214,292 bytes; the [baseline comparison](verification/across-the-lake-compaction.json) verifies identical resolved geometry, skins, materials, sockets, animation channels and samples. Actor/prop triangle limits remain 5,000/10,000. The four new region inventories contain 602,204–1,067,464 model bytes each, below their 2.5 MiB limit. Opening the original village does not fetch the expansion kit.

The production application is **118.46 KB gzip**, CSS **11.75 KB gzip**, and the separately cached Babylon bundle **691.60 KB gzip**. The existing large-engine-chunk advisory remains. The [CI enumeration](verification/across-the-lake-shards.json) selects all **108 cases exactly once** across the existing 32 shards: twelve contain four cases and twenty contain three. Deadlines, retries and the required verification gate are unchanged; enumeration does not establish GitHub runner timing.

| Reference region               | Desktop High / Low draw calls | Phone High / Low draw calls |
| ------------------------------ | ----------------------------- | --------------------------- |
| Lake crossing                  | 64 / 39                       | 61 / 36                     |
| Reed landing                   | 40 / 24                       | 43 / 27                     |
| Sheltered cove                 | 48 / 28                       | 50 / 30                     |
| Peace, be still, evening scene | 71 / 37                       | 69 / 35                     |

The limits remain **300 High / 130 Low**, with each sample reporting one settled scene. The [rendering record](verification/across-the-lake-rendering.json) includes regional download inventories, enabled/drawn asset counts, renderer, viewport and cadence. Hardware samples used ANGLE Metal on Apple M3: all sixteen collected 120 intervals, with 16.7 ms medians and 17.6–18.7 ms p95. These bounded local measurements include concurrent verification activity and are not sustained device benchmarks.

The eight new-region checks also passed under forced SwiftShader, with retries disabled, in **4.9 minutes**. They exercised both qualities and phone landscape controls; all sixteen software samples are in the rendering record. This matrix preceded the final journal-only filter/focus/contrast corrections; scene geometry, rendering and graphics settings were unchanged by those corrections.

Selected browser views show the [desktop water](verification/across-the-lake-water-desktop.png), [large-text phone landscape Gospel](verification/across-the-lake-storm-landscape.png), and [phone investigation clues](verification/across-the-lake-evidence-phone.png). A [carried farm screen](verification/across-the-lake-cargo.png) is visible stowed in the ordinary boat. The original run also reviewed the reed landing, cove, alternate viewports and hints; their measurements and case outcomes remain recorded.

Human editorial/pacing review, assistive-technology usability, physical touch hardware and sustained mobile/Safari/Firefox performance remain unverified. Desktop Chromium and phone viewport emulation do not establish those outcomes. No public deployment was part of this implementation.

## Living Galilee · 2026-09-10

[RFC-005](rfcs/005-living-galilee.md) was written before implementation. It adds two original practical adventures, shared nearby actions, readable spatial plans, saved exploration guidance, walk cancellation, lasting activity and direct saved-region startup. The game now contains three Gospel chapters and nine optional stories. The [playtest guide](PLAYTEST.md#living-galilee) describes both solutions, recovery paths and four portable v8 saves.

### Checks

- **331 unit tests pass** across sixteen files, with types, lint, production build, formatting and whitespace checks passing. This includes all 256 channel configurations, both outlets/reflections/clearing orders, all supply orders at both sites, all screen directions, failed tests/checks, recovery/relocation, incompatible held items, old-save preservation and forged-state rejection.
- The real Babylon importer measures the exported openings for all sixteen piece/rotation combinations, the receiving inlet's direction, the exact enabled wet route, held-prop reach and restored resting-company visibility. These checks rejected the initial handedness mismatch before correction.
- Every v1–v7 portable save retains its prior fields and journal while gaining empty Galilee progress. New v8 examples round-trip through the validator after real reducer actions. Historical standing positions under new furniture remain importable; runtime clearance selects nearby walkable ground and keeps an active arrangement within reach.
- The full production browser run completed **90 cases in 30.7 minutes: 73 passed, eight failed and nine were intentionally skipped**. The failures exposed stale v7 expectations, an arrangement-clearance position outside action reach, an assertion that incorrectly froze a companion after his walk resumed, and an objective-card measurement before asynchronous startup finished. These were corrected without relaxing rendering or layout bounds.
- The affected desktop/phone selection then passed **21 checks**, with one intentional skip, in **8.6 minutes**. It includes every new adventure check and seven of the initial failures. The remaining phone objective check passed separately in **24.8 seconds**. All **81 runnable browser scenarios** have therefore passed across the full run and targeted reruns; these overlapping selections are not additional unique scenarios or a second clean full-suite run.

New browser journeys cover both complete adventures on desktop and phone, hints, incorrect connections/arrangements, supply recovery, cross-region travel, reload/export, alternate outcomes, large text, restrained guidance, cancellation and portrait/landscape controls. A carried screen survives Gospel reading and a waiting Neri remains unchanged while the traveler is elsewhere; returning near him legitimately resumes his walk. Startup tests observe zero GLB requests before Begin/Continue/Import, fail Leah's download during direct continuation, and verify retry restores the saved farm with its journal intact.

### Rendering and assets

The **79-model kit contains 15 actors and 64 props**, totaling **5,230,036 bytes** against the unchanged **5,242,880-byte cap**. All sixteen shared clips and the three specialized Nain clips retain their contracts. Actor/prop triangle limits remain 5,000/10,000. The production application is about **104.5 KB gzip**, CSS **11.6 KB gzip**, and the separately cached Babylon bundle **691.6 KB gzip**. The existing large-engine-chunk advisory remains.

Blender MCP generated the eight additions and isolated workshop, then independently imported the shipped exports. Review corrected overlapping channel floors, elbow walls, receiving inlets, and runtime orientation. The original connected-channel sheet (retired from the gallery in RFC-011, kept in Git history) and [hashed asset inventory](verification/living-galilee-assets.json) accompany the recipes. The later [refined kit and resting-place review](verification/rfc008/README.md#assets-and-reproducibility) retains the updated sheets; the earlier kit and resting-place captures have been retired. Existing unchanged exports retain their previous bytes. Unrelated Blender scenes were preserved.

| Completed reference | Desktop High / Low draw calls | Phone High / Low draw calls |
| ------------------- | ----------------------------- | --------------------------- |
| Spring channel      | 130 / 83                      | 123 / 76                    |
| Resting place       | 115 / 65                      | 111 / 61                    |

Both completed scenes retain essential geometry at each quality and settle to one scene. The limits remain 300 High / 130 Low. [Raw rendering snapshots](verification/living-galilee-rendering.json) include asset-level enabled/drawn counts, renderer, viewport and bounded cadence samples. These local measurements include concurrent verification activity and are not a sustained performance benchmark. [Desktop spring](verification/living-galilee-spring-desktop.png) and [phone resting place](verification/living-galilee-shelter-phone.png) show the actual Babylon compositions. The original bakehouse and Nain software image contracts and their missing-geometry negative controls remain unchanged.

Human editorial review, the two stories' 25–40 minute pacing target, assistive-technology usability, real touch hardware and sustained mobile/Safari/Firefox performance remain unverified. Browser viewport emulation and geometry tests do not establish those outcomes. No public deployment was part of this implementation.

### CI suite capacity · PR #13

The [initial PR run](https://github.com/owenthcarey/gospel-rpg/actions/runs/34448501539) passed the build and fifteen browser shards. Shard 6/16 reached Playwright's 900-second suite deadline after five passing journeys, leaving the sixth unfinished. It reported no assertion failures: the three Living Capernaum journeys took 7.8 minutes, then Tamar and Neri's shade route took another 6.4 minutes before the remaining terrace route ran out of suite time.

Quality now distributes the same 90 desktop/phone cases across 32 shards, with two or three cases per job. The matrix job count still supplies the shard denominator. The one-worker limit, test and assertion timeouts, 15-minute suite deadline, 20-minute job deadline, retries, screenshot contracts, report uploads and required `verify` gate remain unchanged.

Local enumeration confirms that all 90 cases are selected exactly once: 26 shards contain three cases and six contain two. The former shard 6 splits into shards 11 and 12; shard 12 contains Tamar and both Neri routes, including the previously unfinished journey.

After a fresh production build, shard 12/32 passed all three journeys under forced SwiftShader with CI settings and retries disabled in 9.4 minutes. Formatting and whitespace checks passed. Local timing does not establish GitHub runner timing.

## Beyond Capernaum — The Road to Nain · 2026-09-09

[RFC-004](rfcs/004-the-road-to-nain.md) was drafted and accepted before gameplay changes. The milestone adds three exploration regions, a six-scene Luke 7:11–17 chapter, Tamar’s landmark investigation and Neri’s two cross-region walks. The [playtest guide](PLAYTEST.md) includes full journeys and five portable v7 examples.

### Results and coverage

- **267 unit tests passed** across fourteen files. Coverage includes every v1–v6 fixture’s complete prior state and journal, v7 portable examples, both evidence orders and endings, wrong interpretations/retry, all hint levels, both companion routes, boundary conditions, all Nain checkpoints/reflections, stale/remote events, reachable approaches and slope bounds. An imported-geometry regression uses the actual Babylon GLB importer and deformed skin vertices to verify all four bearers’ hands and Jesus’s right hand touch the procession rails. It rejected the reversed pose before the correction. Existing life-state combination coverage remains intact.
- TypeScript, ESLint, the production build, formatting and whitespace checks passed.
- The **full production browser regression passed all 67 runnable checks**, with nine intentional skips, in 24.6 minutes. It covers all three chapters and the earlier optional stories on desktop and phone emulation.
- After the final procession-facing, sitting-up capture and farm-model corrections, the road journeys and both static-image contracts passed **21 checks**, with three intentional skips, in 8.8 minutes. The last courtyard placement and text-color corrections then passed all **ten affected desktop/phone checks** in 6.5 minutes: Tamar, both Neri routes, the complete Nain account/aftermath and the Nain exploration rendering contract. These selections overlap the full suite; they are not additional unique scenarios or a second full-suite run.
- After recreating the assets through MCP, all **267 unit tests**, types, lint and the production build passed again. The affected desktop/phone account journeys, all four new regions at both graphics settings, and the Nain SwiftShader image contract passed **eleven checks**, with one intentional fixed-viewport phone skip, in 5.0 minutes. The gate reference was visually reviewed before this run; snapshot updates were disabled for the passing regression, including its missing-scenery negative control.
- The kit contains **71 GLBs: 14 actors and 57 props**, with sixteen shared clips and three specialized procession clips. Total download size is **4,951,908 bytes (4.72 MiB)**, below the unchanged 5 MiB cap. The largest actor remains 544 triangles and largest prop 2,320, below the unchanged 5,000/10,000 limits.
- The application bundle is approximately **92 KB gzip**, CSS **11 KB gzip**, and the Babylon engine **692 KB gzip**, plus models. The existing large engine-chunk advisory remains. No runtime CDN or external model service is needed.

New browser journeys walk from the completed roof chapter to the road, examine both markers, retry an unsupported route, use hints, find the farm and retain both ending choices. Both Neri routes exercise menus, actual position export/import, reduced motion, alternate exits, Find Neri and visible completion. One route carries a legacy filled jug to Nain and back to the bakehouse. An imported waiting-companion fixture is preserved through Gospel reading, reload and a return to find him. The account journey covers all six scenes, transcript/source/focus, leave/resume/reload, aftermath and reflection without optional tasks. A deliberately failed procession asset load retains the prior scene/state and supports retry and summary.

### Rendering and Blender inspection

All four new regions have explicit inventories and required-object contracts. Production checks inspect each required asset’s enabled and drawn geometry at High and Low, assert one settled scene, reject page-width overflow and keep large-text phone-landscape Gospel controls inside the viewport. The unchanged limits are 300 High / 130 Low draw calls for new reference compositions. The existing shore baseline remains separately reported below.

The new Nain image reference uses the same 960×640, DPR 1, Low, reduced-motion SwiftShader contract as the bakehouse. It checks region replacement and reload. A negative control serves valid GLBs with static roots scaled to zero; the resulting missing-gate/frame image must fail comparison while actors and terrain remain. Reference image tolerance remains 2% with a 0.2 color threshold.

After Blender was reopened, enabling the installed addon and connecting its server restored native MCP access: **Blender 5.2.1 LTS, addon 1.6, protocol 5**. MCP recreated the full workshop and replaced all eleven exports from the earlier CLI fallback: nine new models plus the bearer and Jesus specialist clips. The other sixty prior MCP exports and the original Blender scene were preserved. The [MCP rebuild record](verification/road-to-nain-mcp.json) includes recipe, source, model and review-image hashes. Independent GLB imports, live viewport review and MCP rendering produced the updated [kit sheet](verification/road-to-nain-kit.png), [frame-contact view](verification/road-to-nain-contact.png), [sitting-up poses](verification/road-to-nain-poses.png) and [byte inventory](verification/road-to-nain-assets.json). Live review added weathered courses to both gate faces, making them visible from the player's approach. The inspection recipe can be rerun through MCP or `npm run assets:inspect:road`.

Inspection corrected outward-facing carrying arms, hand/frame contact, the sitting-up leg/root offsets, a tree obscuring Tamar, visible distant water, path junctions, missing obstacle footprints, the shelter's front/back orientation, and an inherited toast animation that could stretch a notice across the Gospel scene. Neri's final bench is placed clear of the gate's obstruction. End-to-end testing also corrected Neri moving away while approached for conversation. The rendering sampler now warms after graphics changes, avoiding counters left over from the previous frame.

Selected Gospel captures retain the [desktop command](verification/road-to-nain-command-desktop.png), [mother and son together](verification/road-to-nain-restored.png), and [large-text phone landscape](verification/road-to-nain-landscape.png). The original run also reviewed the farm, inspection, map, journal, completed company and intermediate poses; redundant browser images have been retired from the current gallery.

The evidence, route and shared story cards now use readable colors against the actual dark panels. Checked solid-background text pairs range from 5.9:1 to 9.5:1 contrast; the inspection caption was also corrected and reviewed on phone. This is a focused color/visual check, with physical accessibility review still outstanding.

### Measurement and review limits

The new measurements use the existing active-play procedure: two seconds of warmup, up to 120 animation-frame intervals in a five-second observation window, then a local F3 snapshot. Menus are excluded. Results identify renderer, viewport, count and elapsed time; they describe local presentation cadence rather than isolated GPU work or sustained thermal performance.

Chromium 151.0.7922.34 used ANGLE Metal on the same Apple M3/macOS host for [desktop measurements](verification/road-to-nain-desktop.json) at 1440×900 and [phone emulation](verification/road-to-nain-phone-emulation.json) at 390×844. All sixteen samples were refreshed after the MCP asset rebuild. Every sample contains 120 intervals, a 16.7 ms median, a 17.5–17.7 ms p95 and one settled scene. F3 reported 60 FPS. The added gate detail remains in one static primitive; the measured draw-call counts are unchanged.

| Region                      | Desktop High / Low draws | Phone High / Low draws |
| --------------------------- | ------------------------ | ---------------------- |
| Galilean road               | 83 / 52                  | 75 / 44                |
| Roadside farm               | 68 / 39                  | 63 / 34                |
| Nain gate                   | 63 / 36                  | 63 / 36                |
| Nain account, command scene | 197 / 76                 | 193 / 69               |

Before the MCP gate-detail refinement, the build also passed all **eight desktop/phone new-region checks under forced SwiftShader**, with retries disabled, in 3.2 minutes. Each check exercises both graphics levels, required-object drawing, the unchanged draw-call cap and one settled scene; the phone account check also covers large-text landscape controls. The [software-renderer records](verification/road-to-nain-swiftshader.json) retain those sixteen quality samples. After the MCP rebuild, the affected Nain SwiftShader image contract and the complete hardware rendering matrix passed again as recorded above. Cadence is diagnostic and does not establish physical-device performance.

To reproduce against a production build:

```sh
npm run build
PLAYWRIGHT_SWIFTSHADER=1 npm run test:e2e -- tests/e2e/road.spec.ts --grep 'new region'
```

The sixteen CI shards select all 76 cases exactly once: twelve shards contain five cases and four contain four. New region rendering checks can shard independently. The CI capacity correction below records why the shard count changed.

Human pacing, historical/editorial review, physical screen-reader/touch testing, Safari/iOS/Android and other-browser compatibility remain external review items. Phone emulation is not a physical-device test. Targets remain 30 FPS on a representative phone at Low and 60 FPS on a representative laptop at High. No asset/draw-call budget, license or deployment setting was increased or changed for this milestone.

### CI suite capacity · PR #12

The [initial PR run](https://github.com/owenthcarey/gospel-rpg/actions/runs/34434089123) passed the build and seven browser shards. Shard 3/8 reached Playwright's 900-second suite deadline after seven passing tests, leaving three cases unfinished. It reported no test assertion failures. Shards 1/8 and 7/8 also approached the deadline at 14.0 and 13.7 minutes.

Quality now distributes the same 76 desktop/phone cases across sixteen shards, with four or five cases per job. The matrix job count still supplies the shard denominator. The one-worker limit, test and assertion timeouts, 15-minute suite deadline, 20-minute job deadline, retries, screenshot contracts, report uploads and required `verify` gate are unchanged.

Local enumeration of all sixteen shards confirms complete selection without duplicates. After a fresh production build, shard 6/16 passed all five checks under forced SwiftShader with CI settings and retries disabled in 8.3 minutes. This includes both Neri routes and the complete Nain account, the three cases left unfinished in the initial run. All 267 unit tests, types, lint, build, formatting and whitespace checks passed. The original milestone's full-suite results above precede this CI configuration correction; local software-renderer timing does not establish GitHub runner timing.

## Historical: Living Capernaum · 2026-09-09

[RFC-003](rfcs/003-living-capernaum.md) was drafted before implementation. It adds two original adventures and strengthens the existing chapters’ interactions, rendering, journal and save continuity. The [playtest guide](PLAYTEST.md) includes both clue orders/endings, both repair methods, interruption checks and v6 fixtures.

### Results and coverage

- **219 unit tests passed** across twelve files. Coverage includes all legacy save fixtures, exact journal validation, both new story paths, cross-story held-item guidance, reachable destinations and bench collision, and a breadth-first traversal of reachable combinations of the new life states and held items.
- TypeScript, ESLint, the production build, formatting and whitespace checks passed.
- The complete production run exercised **54 browser cases**: 42 passed, seven were intentional skips, and five exposed duplicate action labels because the new tray was still visible behind conversations. The tray now hides whenever the HUD is inert; the original preparation test also asserts that it is hidden.
- After that correction, a fresh production build and the final desktop/phone rerun of `episode.spec.ts` and `life.spec.ts` passed **18 checks**, with two intentional skips. This includes all five previously failing checks. The selections overlap; together they verify all **47 runnable scenarios** in the full suite, rather than representing a single all-green full-suite run.
- The kit contains **62 GLBs: 12 skinned actors and 50 props**, with sixteen clips on every actor. Total download size is **4,125,896 bytes (3.93 MiB)**; the largest actor has 544 triangles and the largest prop has 2,320. The original 5 MiB / 5,000-actor-triangle / 10,000-prop-triangle limits remain unchanged.
- Blender MCP rebuilt the isolated workshop and exports in Blender 5.2.1 LTS. Independent Blender imports of the shipped GLBs produced the [prop and pose review](verification/living-capernaum-kit.png). Review covered blue edging/paired stitches, all three bench variants, the hand socket, restrained finite gestures and half-meter sitting height. Browser views were also inspected on desktop and phone layouts. Representative captures show the [completed bench](verification/living-capernaum-bench.png) and [phone pouch controls](verification/living-capernaum-pouch-phone.png). Both completed table locations were also inspected interactively after loading validated saves.

New browser journeys exercise keyboard/touch practical actions, both clue orders and endings, pouch recovery, both repair methods and preparation orders, returning/recovering material, reload while carrying, menu pause during sitting, finite completion, evidence and memory filters, Miriam’s reaction, and portrait/landscape with large text and reduced motion. A mixed-story journey carries the pouch into the roof account, follows a journal destination back to exploration without advancing the checkpoint, changes tracked story and uses the actual return route. All old chapter, companion, table, migration, storage and load-recovery checks remain in the suite.

The application bundle is approximately **74 KB gzip**, CSS **10 KB gzip**, and the Babylon engine **692 KB gzip**, plus models. The existing large engine-chunk advisory remains. No runtime CDN or external model service is needed.

### Rendering correction and regression

The review reproduced a severe Low-quality defect: static scenery disappeared while actors, terrain and labels remained. Nonzero aggregate mesh/draw counts had allowed the earlier checks to pass. `AssetLibrary` now creates mesh clones sharing geometry/materials while owning their render lifecycle; they remain visible without shadow passes. No draw-call limit was raised to make this fix pass.

Every region’s production check now verifies its required authored assets are enabled and that required static geometry actually submits draw calls, alongside viewport, geometry, error, scene-count and budget assertions. F3 exposes asset-level placed/enabled/recently-drawn counts and the loaded inventory. Offscreen objects can be enabled without appearing in the latest frame.

A fixed 960×640, DPR 1, reduced-motion SwiftShader reference checks bakehouse scenery at Low quality. It repeats High/Low switching, camera rotation/reset, region replacement and reload. The negative control serves valid GLBs with static roots scaled to zero, leaving actors and terrain in place; that damaged scene must differ from the reference. The 2% pixel allowance and 0.2 color threshold accommodate small raster differences while rejecting the missing room. This test runs on desktop only because its software-rendered viewport is fixed; all six phone regions remain in the rendering matrix.

Explicit inventories retain the four-request concurrency bound. Gathering-house loading falls from the old shared 30-asset neighborhood list to **14 assets / 517,968 bytes**; the bakehouse loads **19 / 938,892 bytes** and the lanes **27 / 1,435,176 bytes**. The shore includes shared held items and the new bench props (**37 / 2,567,044 bytes**). [Inventory and geometry data](verification/living-capernaum-assets.json) lists all six inventories. These are uncached GLB totals; runtime caches can avoid repeated transfers.

### Corrected local rendering baseline

The final production run uses Chromium on an Apple M3 host with ANGLE Metal. Desktop is 1440×900 and phone emulation 390×844. Each quality warms up for two seconds, samples up to 120 animation-frame intervals within five seconds, then takes a local F3 snapshot before capturing the image. Median/p95 values describe presentation cadence, not isolated GPU work or sustained thermal performance. Menus deliberately reduce render frequency and are excluded.

Samples use the prepared shore (traveler at the gathering, x=3/z=9), lake partners/cargo and initial roof composition. The new journey helper walks to authored action targets, so the shore camera differs from the earlier spawn-position sample. Every region must settle at one scene. Counts below include the corrected static geometry; earlier Low counts are not a valid optimization baseline.

| Region          | Desktop High / Low draws | Phone High / Low draws | Desktop High / Low p95 ms | Phone High / Low p95 ms |
| --------------- | ------------------------ | ---------------------- | ------------------------- | ----------------------- |
| capernaum       | 332 / 175                | 244 / 87               | 18.6 / 18.6               | 17.6 / 17.6             |
| lake-gennesaret | 133 / 48                 | 132 / 47               | 18.6 / 18.6               | 17.6 / 17.6             |
| capernaum-lanes | 151 / 71                 | 146 / 66               | 18.7 / 16.8               | 17.6 / 17.6             |
| gathering-house | 56 / 29                  | 56 / 29                | 17.0 / 18.0               | 17.6 / 17.6             |
| bakehouse       | 80 / 41                  | 80 / 41                | 17.5 / 16.9               | 17.6 / 17.6             |
| roof-account    | 125 / 43                 | 125 / 43               | 18.2 / 16.8               | 17.6 / 17.6             |

All samples reported one settled scene, with median frame intervals of 16.7 ms. The neighborhood/presentation regions remain within 300 High / 130 Low draw calls. The original shore has no new draw-call cap; correct visibility and the measured 332/175 desktop and 244/87 phone counts replace the earlier incomplete view. Raw [desktop measurements](verification/living-capernaum-desktop.json) and [phone-emulation measurements](verification/living-capernaum-phone-emulation.json) preserve geometry, renderer, viewport, sample count, elapsed time and cadence.

### CI suite capacity · PR #11

The [initial PR run](https://github.com/owenthcarey/gospel-rpg/actions/runs/34393319645) passed the build and both phone-heavy shards. The two desktop-heavy shards reached Playwright's 900-second global suite timeout after 13 and 10 passing cases respectively, leaving five cases unfinished. Neither shard reported an assertion failure before the deadline.

The Quality workflow now distributes the same 54 cases across eight shards instead of four. Its shard denominator uses the matrix job count to prevent mismatched selection when the matrix changes. The single browser worker, per-test and assertion timeouts, 15-minute suite deadline, 20-minute job deadline, screenshot contract, report uploads and required `verify` gate are unchanged.

Local validation enumerated every revised shard and confirmed that all 54 cases are selected exactly once, with six or seven cases per shard. After a fresh production build, shard 4/8 passed all seven checks under forced SwiftShader with CI settings and retries disabled in 5.8 minutes. This includes all new adventures, the deliberate missing-scenery regression and the full phone Chapter II journey. Formatting and whitespace checks passed; local timing does not establish GitHub runner timing.

### Review limits

The two new adventures’ **20–35 minute human pacing target** has not been measured; automation advances reading quickly. Physical Safari/iOS/Android, other browsers, sustained mobile GPU/thermal behavior, screen-reader/touch hardware usability, and historical/editorial review remain separate checks. The targets remain 30 FPS on a representative midrange phone at Low and 60 FPS on a representative laptop at High. Local phone emulation does not establish either device compatibility or accessibility certification.

## Historical: Through the Roof · 2026-09-09

[RFC-002](rfcs/002-through-the-roof.md) was written before gameplay changes and implemented locally. See the [playtest guide](PLAYTEST.md) for the two chapters, optional routes, table arrangements and portable example saves.

### Results

- **184 unit tests passed** across ten files, including v1–v5 save migration, cross-field validation, story transitions, route reachability, interrupted companions and GLB contracts.
- The full production browser run passed **27 checks**, with five intentional device-specific skips. After the final visual and interaction adjustments, the affected regression selection passed **16 checks**, with two intentional skips. The final desktop/phone rendering selection passed **two checks**. These selections overlap; their counts are not added together as unique coverage.
- TypeScript, ESLint, production build, Prettier and whitespace checks passed.
- Blender 5.2.1 LTS / Blender MCP produced and inspected the expanded workshop. All **53 GLBs** total **3,386,548 bytes (3.23 MiB)**, below the unchanged 5 MiB kit budget. Twelve actors retain twelve named clips and the required attachments; static props use a shared vertex-color material per exported model. RFC-003 supersedes the instancing approach.
- Local visual inspection covered modular interiors, object carrying/placement, four bearers, the reclining man, mat lowering, rising and walking away, plus portrait and landscape caption clearance. Reduced-motion presentations retain readable poses.

The application bundle is about **63 KB gzip**, the Babylon engine bundle about **692 KB gzip**, plus CSS and models. Vite still reports the existing large engine-chunk advisory. No runtime CDN is required.

### Coverage and corrections

The browser journeys cover migrated Chapter I progress continuing into Chapter II, every new checkpoint, transcript and focus restoration, leave/resume/reload, aftermath and reflection, both Amos routes, clearing the passage with the borrowed handle, both table locations and collection orders, filled-water export/import, failed region loading with retry, large text and landscape controls. The existing prelude, lake episode, storage-recovery and keyboard checks remain in the suite. Unit checks cover additional action orders, stale commands, invalid or forged save combinations, complete legacy migration, companion arrival and cross-region objective guidance.

The final visual pass corrected indoor camera framing, caption/footer overflow, carried-object height and the timing of the roof opening. Shared source meshes now receive shadows before instantiation; the final browser checks reject the former per-instance shadow warning and any page errors. An offscreen shore label could widen the phone layout; its layer now clips at the viewport and the rendering test asserts the actual viewport dimensions in all six regions. One intermediate desktop image capture timed out at 20 seconds; allowing up to 60 seconds for screenshot capture resolved it on rerun without relaxing rendering or layout assertions.

### Historical rendering measurements — superseded by RFC-003

**These aggregate counts did not verify visible static scenery. RFC-003 reproduced missing static geometry on Low quality. Do not use the old reductions as evidence of a rendering optimization or compare their performance directly with the corrected scenes. The measurements above are the current baseline.**

Production Chromium ran on an Apple M3 host with the ANGLE Metal renderer. Desktop uses 1440×900; phone emulation uses 390×844. Each active-play sample warms up for two seconds and records 120 animation-frame intervals, then captures F3 diagnostics before image capture. These are local presentation-cadence samples, not isolated GPU timings or physical-phone/thermal benchmarks. Menus intentionally reduce rendering frequency and are excluded from these measurements.

The shore sample includes the prepared gathering, the lake sample includes the partners and cargo, and the roof sample is the initial house composition. Every sample reported **one settled scene**. All new-region samples meet the **300 high / 130 low** draw-call limits.

| Region          | Desktop high | Desktop low | Phone high | Phone low |
| --------------- | ------------ | ----------- | ---------- | --------- |
| capernaum       | 267          | 162         | 207        | 102       |
| lake-gennesaret | 107          | 39          | 106        | 38        |
| capernaum-lanes | 100          | 48          | 98         | 46        |
| gathering-house | 24           | 13          | 24         | 13        |
| bakehouse       | 44           | 23          | 44         | 23        |
| roof-account    | 97           | 29          | 97         | 29        |

The table shows draw calls per frame. Compared with the previous recorded desktop high baseline, the prepared shore decreased from 500 to 267 and the lake from 209 to 107. The final desktop shore high sample reported 33 FPS with a 66.2 ms p95 frame interval; the new-region samples reported 60 FPS. This local result does not establish sustained hardware targets, and the remaining shore variability should be included in device profiling.

Raw [desktop measurements](verification/through-the-roof-desktop.json) and [phone-emulation measurements](verification/through-the-roof-phone-emulation.json) retain meshes, active meshes, materials, textures, renderer, viewport, recent FPS and median/p95 frame intervals. Phone landscape at 844×390 keeps Continue, Pause and all secondary scene actions inside the viewport; reading text scrolls independently.

### CI rendering regression · PR #10

The initial CI run passed the build and gameplay checks, but the combined rendering test exhausted its three-minute limit on both layouts. The desktop trace spent about 84 seconds collecting the first 120-frame sample alone on software WebGL.

Rendering coverage now runs as one test per region, so all six regions can be sharded independently. Each quality still receives a two-second warmup, then collects up to 120 frame intervals within a five-second observation window. Metrics include the actual sample count and elapsed time; percentiles use that count. A renderer that fails to produce at least two intervals fails the check. The existing draw-call, viewport, scene-count, landscape and error assertions remain, with additional checks for the correct region and nonzero rendered geometry.

To reproduce software rendering locally against a production build:

```sh
npm run build
CI=1 PLAYWRIGHT_SWIFTSHADER=1 npm run test:e2e -- tests/e2e/campaign.spec.ts --grep 'rendering budgets' --retries=0
```

Validation of this adjustment passed all **12 desktop/phone region checks under forced SwiftShader**, with retries disabled, in five minutes. All 184 unit tests, types, lint, production build, formatting and whitespace checks also passed.

The recorded M3 measurements above predate this test-harness adjustment. Software-renderer timing is diagnostic and does not establish device-performance targets.

### Remaining review limits

The RFC's 35–50 minute pacing target for the new content still needs a human playtest. Historical/theological review, physical screen-reader and touch testing, Safari/iOS, Android GPU and other-browser compatibility remain separate follow-up checks. The targets remain 30 FPS on a representative midrange phone at low quality and 60 FPS on a representative laptop at high quality. No commit, push, public release or deployment was performed by this local implementation.

## Historical baseline: Into the Deep · 2026-09-08

The following results describe the earlier 29-model build and are retained for comparison.

Verified locally on 2026-09-08. This record distinguishes automated checks and local visual inspection from hardware compatibility claims.

### Results

- **121 unit tests passed** across eight files, including state, save migration, queued actions, navigation and GLB contracts.
- **16 production browser checks passed**, with four intentional device-specific skips. Desktop Chromium uses 1440×900; phone emulation uses 390×844. The full episode, original prelude and optional story, recovery paths, transcript, story tracking, keyboard focus and save restoration are covered.
- TypeScript, ESLint, production build, Prettier and whitespace checks passed.
- Blender 5.2.1 LTS / Blender MCP rebuilt all 29 GLBs and the workshop source. The full kit is **1,877,700 bytes (1.79 MiB)**, below the 5 MiB limit.
- Visual inspection covers Blender carrying/seated/kneeling poses and Babylon lowering, abundance, partners, astonishment and calling compositions. Phone framing leaves both boats visible above the captions. Rebuilt-model browser checks cover a full episode and interrupted/manual restoration on both layouts.

The Babylon bundle is about 692 KB gzip; the application bundle is about 44 KB gzip, plus CSS and models. Vite reports the existing large engine-chunk advisory. No runtime CDN is required.

### Automated coverage

- Legacy prelude and optional story, including collection/discovery order.
- Full episode preparation, every lake checkpoint, return, aftermath and all reflections.
- Checkpoint-specific leave/resume and finish-with-summary equivalence.
- v1/v2/v3 migration and v4 consistency validation.
- Save/export/import/reload and manual slots.
- Available destination reachability, including changing actors and objects.
- Local GLB manifest, skeletons, animation names, attachment points, geometry and byte budgets.
- Keyboard focus, phone objectives, transcript, settings and reduced motion.
- Failed region asset loading with retry.
- Storage open/write failures without false durability claims.

### Measured local rendering

Measured with Chromium 151.0.7922.34 on an Apple M3 host (macOS / Darwin 25.6.0), using the ANGLE Metal renderer. Each sample used a fresh browser context, four seconds of active-play warmup, and 120 animation-frame intervals. F3 captured Babylon's per-frame draw count and recent FPS before pausing. These intervals describe presentation cadence, not a GPU timer or a sustained thermal benchmark.

The village sample includes the prepared gathering; the lake sample uses the partners scene with both boats and cargo. There was one scene after each load and no uncaught page errors.

| Layout / quality | Region          | Total / active meshes | Draw calls per frame | FPS | Frame interval median / p95 |
| ---------------- | --------------- | --------------------- | -------------------- | --- | --------------------------- |
| 1440×900 / high  | capernaum       | 539 / 309             | 500                  | 60  | 16.7 / 17.6 ms              |
| 1440×900 / high  | lake-gennesaret | 216 / 92              | 209                  | 60  | 16.7 / 16.7 ms              |
| 390×844 / low    | capernaum       | 539 / 159             | 129                  | 60  | 16.7 / 16.8 ms              |
| 390×844 / low    | lake-gennesaret | 216 / 93              | 75                   | 60  | 16.7 / 16.8 ms              |

Phone rows use mobile viewport/touch emulation on the same M3 GPU. They do **not** establish performance on an iPhone or Android device. The additional 844×390 landscape inspection showed no page-width overflow and kept Continue and the scene actions within the viewport. Readable scene text scrolls independently.

The 25–40 minute narrative pacing target has not been established by a human playtest. Browser automation deliberately advances text quickly.

### Local diagnostics

Press **F3** during gameplay for a rendering snapshot: loaded region, scene count, meshes, active meshes, materials, textures, draw calls and recent FPS. The snapshot is computed locally and sends no telemetry.

In development builds, a once-per-second diagnostic snapshot also appears on the canvas's data-diagnostics attribute for browser test inspection. This attribute is not populated by the production render loop.

Performance measurements must identify viewport, device, graphics setting and whether rendering is software or hardware accelerated. Opening menus intentionally reduces rendering frequency, so menu FPS is not a gameplay measurement.

### Budgets

- Entire GLB kit under 5 MiB.
- Each character below 5,000 triangles; each prop below 10,000.
- No external model buffers or textures.
- Village crowd: six on high, three on low.
- Lake shore crowd: eight on high, four on low.
- A single Babylon engine/render loop; one active region scene after transitions settle.
- Four concurrent model requests per region.

The default target is 30 fps on a representative midrange mobile device at low quality, and 60 fps on a representative laptop at high quality. These are targets to measure, not claims established by viewport emulation.

### Before a broad production release

Real Safari/iOS, Android GPU, Firefox and Edge checks are still required. Chromium phone emulation does not verify touch hardware, browser storage eviction, mobile thermal behavior or screen-reader usability on a physical device.

A human historical/theological review remains distinct from source/provenance verification. No license change or public release is implied by the local implementation.
