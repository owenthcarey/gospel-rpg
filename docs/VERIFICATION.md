# Verification record

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

Review captures show the [farm](verification/road-to-nain-farm.png), [phone inspection](verification/road-to-nain-inspection-phone.png), [journey map](verification/road-to-nain-journey-map.png) and [journal](verification/road-to-nain-journal.png). The completed company is visible on [desktop](verification/road-to-nain-courtyard.png) and [phone](verification/road-to-nain-courtyard-phone.png). Gospel views cover the command on [desktop](verification/road-to-nain-command-desktop.png) and [phone](verification/road-to-nain-command-phone.png), [sitting up](verification/road-to-nain-sitting-up.png), [mother and son together](verification/road-to-nain-restored.png), and [large-text phone landscape](verification/road-to-nain-landscape.png).

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
- Blender MCP rebuilt the isolated workshop and exports in Blender 5.2.1 LTS. Independent Blender imports of the shipped GLBs produced the [prop and pose review](verification/living-capernaum-kit.png). Review covered blue edging/paired stitches, all three bench variants, the hand socket, restrained finite gestures and half-meter sitting height. Browser views were also inspected on desktop and phone layouts. Representative captures show the [completed bench](verification/living-capernaum-bench.png), [desktop pouch controls](verification/living-capernaum-pouch-desktop.png), and [phone pouch controls](verification/living-capernaum-pouch-phone.png). Both completed table locations were also inspected interactively after loading validated saves.

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
