# Into the Deep verification record

Verified locally on 2026-09-08. This record distinguishes automated checks and local visual inspection from hardware compatibility claims.

## Results

- **121 unit tests passed** across eight files, including state, save migration, queued actions, navigation and GLB contracts.
- **16 production browser checks passed**, with four intentional device-specific skips. Desktop Chromium uses 1440×900; phone emulation uses 390×844. The full episode, original prelude and optional story, recovery paths, transcript, story tracking, keyboard focus and save restoration are covered.
- TypeScript, ESLint, production build, Prettier and whitespace checks passed.
- Blender 5.2.1 LTS / Blender MCP rebuilt all 29 GLBs and the workshop source. The full kit is **1,877,700 bytes (1.79 MiB)**, below the 5 MiB limit.
- Visual inspection covers Blender carrying/seated/kneeling poses and Babylon lowering, abundance, partners, astonishment and calling compositions. Phone framing leaves both boats visible above the captions. Rebuilt-model browser checks cover a full episode and interrupted/manual restoration on both layouts.

The Babylon bundle is about 692 KB gzip; the application bundle is about 44 KB gzip, plus CSS and models. Vite reports the existing large engine-chunk advisory. No runtime CDN is required.

## Automated coverage

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

## Measured local rendering

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

## Local diagnostics

Press **F3** during gameplay for a rendering snapshot: loaded region, scene count, meshes, active meshes, materials, textures, draw calls and recent FPS. The snapshot is computed locally and sends no telemetry.

In development builds, a once-per-second diagnostic snapshot also appears on the canvas's data-diagnostics attribute for browser test inspection. This attribute is not populated by the production render loop.

Performance measurements must identify viewport, device, graphics setting and whether rendering is software or hardware accelerated. Opening menus intentionally reduces rendering frequency, so menu FPS is not a gameplay measurement.

## Budgets

- Entire GLB kit under 5 MiB.
- Each character below 5,000 triangles; each prop below 10,000.
- No external model buffers or textures.
- Village crowd: six on high, three on low.
- Lake shore crowd: eight on high, four on low.
- A single Babylon engine/render loop; one active region scene after transitions settle.
- Four concurrent model requests per region.

The default target is 30 fps on a representative midrange mobile device at low quality, and 60 fps on a representative laptop at high quality. These are targets to measure, not claims established by viewport emulation.

## Before a broad production release

Real Safari/iOS, Android GPU, Firefox and Edge checks are still required. Chromium phone emulation does not verify touch hardware, browser storage eviction, mobile thermal behavior or screen-reader usability on a physical device.

A human historical/theological review remains distinct from source/provenance verification. No license change or public release is implied by the local implementation.
