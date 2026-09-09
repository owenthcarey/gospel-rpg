# Verification record

## Through the Roof · 2026-09-09

[RFC-002](rfcs/002-through-the-roof.md) was written before gameplay changes and implemented locally. See the [playtest guide](PLAYTEST.md) for the two chapters, optional routes, table arrangements and portable example saves.

### Results

- **184 unit tests passed** across ten files, including v1–v5 save migration, cross-field validation, story transitions, route reachability, interrupted companions and GLB contracts.
- The full production browser run passed **27 checks**, with five intentional device-specific skips. After the final visual and interaction adjustments, the affected regression selection passed **16 checks**, with two intentional skips. The final desktop/phone rendering selection passed **two checks**. These selections overlap; their counts are not added together as unique coverage.
- TypeScript, ESLint, production build, Prettier and whitespace checks passed.
- Blender 5.2.1 LTS / Blender MCP produced and inspected the expanded workshop. All **53 GLBs** total **3,386,548 bytes (3.23 MiB)**, below the unchanged 5 MiB kit budget. Twelve actors retain twelve named clips and the required attachments; static props use a shared vertex-color material per exported model and support instancing.
- Local visual inspection covered modular interiors, object carrying/placement, four bearers, the reclining man, mat lowering, rising and walking away, plus portrait and landscape caption clearance. Reduced-motion presentations retain readable poses.

The application bundle is about **63 KB gzip**, the Babylon engine bundle about **692 KB gzip**, plus CSS and models. Vite still reports the existing large engine-chunk advisory. No runtime CDN is required.

### Coverage and corrections

The browser journeys cover migrated Chapter I progress continuing into Chapter II, every new checkpoint, transcript and focus restoration, leave/resume/reload, aftermath and reflection, both Amos routes, clearing the passage with the borrowed handle, both table locations and collection orders, filled-water export/import, failed region loading with retry, large text and landscape controls. The existing prelude, lake episode, storage-recovery and keyboard checks remain in the suite. Unit checks cover additional action orders, stale commands, invalid or forged save combinations, complete legacy migration, companion arrival and cross-region objective guidance.

The final visual pass corrected indoor camera framing, caption/footer overflow, carried-object height and the timing of the roof opening. Shared source meshes now receive shadows before instantiation; the final browser checks reject the former per-instance shadow warning and any page errors. An offscreen shore label could widen the phone layout; its layer now clips at the viewport and the rendering test asserts the actual viewport dimensions in all six regions. One intermediate desktop image capture timed out at 20 seconds; allowing up to 60 seconds for screenshot capture resolved it on rerun without relaxing rendering or layout assertions.

### Measured local rendering

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
