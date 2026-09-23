# Capernaum, Fully Realized — delivery evidence

[RFC-009](../../rfcs/009-capernaum-fully-realized.md) was written before implementation. The milestone adds an original working landing, ordinary village activity, nine original Blender props and shared physical/focus corrections. The [playtest guide](../../PLAYTEST.md#capernaum-fully-realized) describes both solutions and the four portable v11 saves.

## What to review

Start a new traveler and follow **A clear way to the water** from the journal to Eliab. Observe the passage and water marks, clear the rope, place and orient the plank, and store the cargo blocking the chosen approach. A successful north or south test permits either reflection. The physical arrangement and its plan use the same coordinates and solver. Existing Gospel accounts do not depend on this work.

The four village spaces add thresholds, footings, shade and work details appropriate to each place. Net work begins after the landing is reopened; water tending and bread work use authored stations. Gathering/resting company appears only after the related work is earned. Menus and reduced motion preserve still, supported poses.

Use **Settings and saves → Import** to open a review save:

| Save                                                                           | Review point                                                     |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| [Observed landing](../../../tests/fixtures/saves/v11-landing-observed.json)    | Both observations recorded; arrange either crossing.             |
| [Interrupted work](../../../tests/fixtures/saves/v11-landing-interrupted.json) | South placement with its orientation and cargo still to resolve. |
| [North completion](../../../tests/fixtures/saves/v11-landing-north.json)       | The north route and patient-work reflection are remembered.      |
| [South completion](../../../tests/fixtures/saves/v11-landing-south.json)       | The south route and making-room reflection are remembered.       |

## Browser compositions

The before captures use baseline `fb39e3b`. Each after capture uses the same region, traveler position and High/reduced-motion settings, with the new landing completed. The selected-story HUD consequently differs. These are production browser renders. The permanent gallery retains one before/after pair per space; the complete High/Low desktop/phone measurements remain in the JSON records below.

| Space             | Before                               | Delivered                                |
| ----------------- | ------------------------------------ | ---------------------------------------- |
| Shore             | [Before](before-capernaum.png)       | [High](capernaum-high-desktop.png)       |
| Residential lanes | [Before](before-capernaum-lanes.png) | [High](capernaum-lanes-high-desktop.png) |
| Gathering house   | [Before](before-gathering-house.png) | [High](gathering-house-high-desktop.png) |
| Bakehouse         | [Before](before-bakehouse.png)       | [High](bakehouse-high-desktop.png)       |

The village review includes both graphics settings; Low keeps the working arrangement and essential people while reducing optional company.

| Desktop 1440×900  | High / Low draw calls | High / Low median interval | High / Low p95 interval |
| ----------------- | --------------------: | -------------------------: | ----------------------: |
| Shore             |             217 / 120 |             16.7 / 16.7 ms |          17.7 / 18.3 ms |
| Residential lanes |              160 / 67 |             16.7 / 16.7 ms |          17.9 / 18.3 ms |
| Gathering house   |               71 / 37 |             16.7 / 16.7 ms |          18.4 / 18.2 ms |
| Bakehouse         |              103 / 53 |             16.7 / 16.7 ms |          17.9 / 18.2 ms |

[The measured desktop record](rendering-desktop.json) contains 120 frame intervals per sample on ANGLE Metal / Apple M3. Every sample reports one settled scene. The limits remain 300 High / 130 Low draw calls.

Phone work remains scrollable between its fixed title and inspection/framing controls. The [north portrait view](north-passage-tested-phone.png) and [south large-text landscape view](south-short-landscape-phone.png) preserve the visible physical crossing and its textual result. Their captured scroll positions follow the tested action; scroll upward to inspect the complete plan.

| Phone 390×844     | High / Low draw calls | High / Low median interval | High / Low p95 interval |
| ----------------- | --------------------: | -------------------------: | ----------------------: |
| Shore             |              176 / 79 |             16.7 / 16.7 ms |          17.3 / 16.8 ms |
| Residential lanes |              172 / 79 |             16.7 / 16.7 ms |          17.3 / 17.2 ms |
| Gathering house   |               71 / 37 |             16.7 / 16.7 ms |          17.3 / 17.3 ms |
| Bakehouse         |              103 / 53 |             16.7 / 16.7 ms |          17.2 / 17.3 ms |

[The phone record](rendering-phone.json) uses the same desktop Metal renderer, with an emulated phone viewport and 120 intervals per sample. Every sample reports one settled scene. These are bounded browser observations, not physical-device or sustained-play benchmarks.

Both existing fixed software-rendered image references passed unchanged through quality changes, scene replacement and reload. Deliberately removing bakehouse static geometry or Nain gate geometry still breaks the respective image contract, confirming that aggregate scene/mesh counts alone cannot satisfy those checks. The [rendering tests](../../../tests/e2e/static-render.spec.ts) save these diagnostic captures to `test-results/`; the two reference images remain committed under `tests/e2e/screenshots/`.

## Blender MCP review

The connected Blender 5.2.1 LTS addon generated the kit in an isolated workshop. The final inspection imported the shipped GLBs independently and included geometry posed through the real Babylon importer. Both scripts restore the previously selected Blender scene in a `finally` block.

| Review                  | Evidence                         |
| ----------------------- | -------------------------------- |
| Nine original props     | [Kit](blender-kit.png)           |
| Supported working hands | [Net work](blender-net-work.png) |

[The Blender record](blender-review.json) identifies the exact imported GLB hashes and preserved scene. The original inspection produced seven views, including both physical solutions, bread work, interior company and residential lanes; these two representative views are retained in Git. The original recipe and workshop are `tools/blender/capernaum.py` and `assets/source/capernaum-kit.blend`; `tools/blender/inspect_capernaum.py` reproduces the review. Run `npm run assets:inspect:capernaum` with Blender available to regenerate all seven views and their report into ignored `artifacts/reviews/capernaum/`. `GOSPEL_REVIEW_OUTPUT` overrides the destination.

## Evidence retention

Keep the game assets, Blender source, automated image references, structured results and this curated 12-image gallery in Git. Full screenshot matrices, diagnostic captures and raw command logs are generated review outputs. The [browser tests](../../../tests/e2e/harbor.spec.ts) regenerate the desktop/phone matrix with `npm run test:e2e -- tests/e2e/harbor.spec.ts tests/e2e/static-render.spec.ts`; outputs go to ignored `test-results/`. [CI](../../../.github/workflows/ci.yml) already uploads browser reports and captures with seven-day retention. Blender reviews are generated locally with the command above; CI does not run Blender.

The [delivery record](delivery.json) anchors the original validation and source/production hashes to implementation commit `f845223ca5a890a70b606c44f512ad847999392e`. Its evidence manifest lists only the retained, committed files. Raw local logs were never tracked and are not required to follow the case-level outcomes. The curation metadata records the image reduction separately from the original test results.

## Asset and download accounting

The catalog grows from **85 models / 5,161,668 bytes** to **94 models / 5,390,092 bytes**. The nine new exports add **228,424 bytes**. Every historical GLB is byte-identical to baseline `fb39e3b`. The RFC explicitly permits **5.5 MiB** total; the final catalog is **377,076 bytes** below that ceiling. Actor/prop triangle caps remain 5,000/10,000, and loading retains four concurrent requests.

| Region            |      Before |   Delivered |     Added | Allowance |
| ----------------- | ----------: | ----------: | --------: | --------: |
| Capernaum shore   | 2,539,496 B | 2,699,000 B | 159,504 B | 196,608 B |
| Residential lanes | 1,447,028 B | 1,563,144 B | 116,116 B | 196,608 B |
| Gathering house   |   574,612 B |   763,308 B | 188,696 B | 196,608 B |
| Bakehouse         |   966,360 B | 1,087,336 B | 120,976 B | 196,608 B |

The gathering house reuses the existing villager, accounting for most of its added download. Every other exploration region retains its exact prior inventory and bytes. [Baseline inventories](asset-baseline.json), [delivered inventories](asset-delivery.json) and [catalog hashes](catalog.json) preserve the accounting.

## Verification and review limits

The complete production Chromium matrix passes **149 tests with eleven intentional skips and no failures in 44.4 minutes**. This is one uninterrupted desktop/phone run against the final implementation, with one worker and retries disabled. It includes the continuous fresh-save four-chapter journey, all replay accounts, both landing solutions, legacy progression, carried supplies, companions, route recovery, keyboard/focus behavior and rendering contracts. [The delivery record](delivery.json) preserves all 160 case outcomes, command summaries, earlier corrections, measured budgets and hashes.

The final `npm run check` passes types, lint, **538 unit checks across 27 files** and the production build. The independent Firefox/WebKit smoke passes all four scenarios. Tests exercise every arrangement, both routes/reflections, guarded actions, interruption, migrations, forged saves, imported geometry, working hands, grounded feet, actual actor facing and bounded village inventories. A deterministic browser regression verifies that deferred initial focus cannot steal focus already chosen inside a newly opened dialog. The malformed-save regression first failed against coercible array values; explicit string validation now rejects them.

Browser emulation establishes neither physical touch comfort nor sustained mobile performance. Frame samples identify their renderer and viewport and explicitly record `physicalDevice: false`. Human pacing, historical/editorial review and screen-reader usability remain separate review tasks. The existing large Babylon engine chunk advisory remains. No remote deployment or GitHub Actions execution is claimed.
