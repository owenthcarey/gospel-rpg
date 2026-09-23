# The Way, Brought to Life · presentation review

[RFC-010](../../rfcs/010-the-way-brought-to-life.md) was drafted before implementation. This milestone refines the existing four-chapter journey, with Capernaum and all ten Into the Deep scenes as its presentation reference. Save v11, authored scripture and practical-story rules are unchanged.

## What to review

- **People:** fifteen refined character models and matching portraits; greeting, listening and response clips; smoother turns and cadence; nearby camera framing and exact recovery after closing a conversation.
- **Places:** worn paths, blended earth, shoreline banks, detailed plaster houses and olive trees, stone wall courses and woven interior textiles. The shore, lanes, gathering house and bakehouse retain their entrances and walkable layouts.
- **Work:** accepted physical actions retain guarded state transitions, sound and finite poses, with a brief world accent. Full landing inspection returns to the compact work controls after accepted physical work.
- **Accounts:** every Chapter I checkpoint restores a complete composition. Fishermen work on shore, the response has a distinct pose, people face one another, oars meet hands, nets have working cords, loaded hulls stay dry and the final company stands ashore. Actual panel bounds determine framing in all four accounts. The storm uses the shared continuous water surface.

Use [the presentation playtest](../../PLAYTEST.md#the-way-brought-to-life) for an uninterrupted review. Existing portable examples remain valid: `npm run fixtures:harbor`, `npm run fixtures:exploration`, `npm run fixtures:connection` and the historical lake/storm saves. Start a separate fresh journey to assess the opening; export a valued save before replacing it.

## Reproduce the measurements

```sh
npm run check
npm run format:check
npm run test:e2e
npm run test:compat
npm run assets:inspect:presence
PRESENCE_REVIEW_OUTPUT=/absolute/path/asset-delivery.json npm run test -- tests/unit/presence.test.ts
```

The presence browser suite checks three journeys on desktop and phone: nearby legacy dialogue with pause/reload/reduced motion/large text; a named-person panel with paused resizing and failed-region recovery; and every Chapter I composition at desktop, portrait and short landscape sizes. The complete suite additionally covers the uninterrupted fresh-save four-chapter journey, migration, ordinary work, both companions, all regions, replay, storage recovery, camera controls and negative rendering controls.

## Acceptance results

The complete production Chromium matrix passed **155 cases**, with **eleven intentional skips and zero failures**, in **46.1 minutes**. It includes the uninterrupted fresh traveler journey through all four chapters. Firefox/WebKit passed all four compatibility checks in **31.9 seconds**. The final six-case presentation selection passed in **1.6 minutes**, including the later screenshot helper that waits for paused rendering before capture. Its scenario assertions are the same as those in the full run; the production build and assets served by that run remained unchanged.

`npm run check` passes evidence validation, types, lint, **562 unit checks across 29 files** and the production build. Formatting and whitespace checks pass. The [delivery record](delivery.json) preserves every browser outcome, source/build hashes, exploratory failures and corrected reruns. [Rendering measurements](rendering.json) identify renderer, viewport, draw calls and settled scenes. [Reading measurements](reading.json) record all ten Chapter I panels and the independent check of complete landscape control labels.

All four Capernaum spaces remain below **300 High / 130 Low draw calls** with one settled scene. The desktop shore measures **166 / 90**, compared with **217 / 120** in RFC-009. The catalog is **6,706,812 bytes**, fifteen portraits total **50,576 bytes**, and no region adds more than **715,700 bytes** over the captured baseline. These are within the budgets agreed in the RFC.

The [asset inventory](asset-delivery.json) includes all 94 models, all fifteen portraits and every exploration-region download. [Baseline model hashes](baseline-catalog.json) and [baseline regional bytes](baseline-inventories.json) were captured from `d388fec`. The [independent Blender import](independent-imports.json) lists all nineteen revised exports, their hashes, triangle counts and one-mesh/one-material import results. Production Blender work preserved the original scene; the protocol warning and execution details are recorded in the RFC and asset guide.

The before/after environment review uses the same positions and settings as `tests/e2e/harbor.spec.ts`: shore `(0, -10)`, lanes `(0, 4)`, both interiors `(0, -2)`. Previous [RFC-009 deliveries](../rfc009/README.md) are the baseline photographs, rather than newly captured old-build images. Current full matrices and intermediate revisions live in ignored `artifacts/rfc010/` and `test-results/`; selected permanent evidence is listed below. The automated bakehouse and Nain references live in `tests/e2e/screenshots/static-render.spec.ts/` and retain deliberate missing-geometry controls.

## Selected evidence

| Evidence                                               | Review purpose                                                                                                                      |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| [Capernaum shore](shore-desktop.png)                   | High-quality shore at the same position as the [previous delivery](../rfc009/capernaum-high-desktop.png).                           |
| [Hannah's bakehouse](bakehouse-desktop.png)            | Wall courses, floor textiles, supported work and refined people; compare the [previous room](../rfc009/bakehouse-high-desktop.png). |
| [The other boat draws near](lake-partners-desktop.png) | Loaded hulls, standing and seated figures, working net and the actual reading panel.                                                |
| [Conversation at phone width](conversation-phone.png)  | Large reading size and reduced motion with the nearby speaker visible above the panel.                                              |
| [Imported architecture and people](kit.webp)           | Final-export architecture, olive tree and principal character silhouettes in Blender.                                               |
| [Character identities](people.webp)                    | Faces, garment borders, wraps and the traveler's satchel from the imported models.                                                  |

The gallery uses native Blender renders and unmodified browser captures. It shares the repository's unchanged 30 MiB evidence ceiling; full scene and device matrices are reproducible generated output.

## Review limits

The game retains its warm, matte low-poly direction. These are original artistic interpretations of places and people. This work does not establish archaeological likeness, human pacing, screen-reader/touch usability, physical mobile GPU performance or a complete studio production process. Those require the focused human and hardware reviews listed in the playtest guide. Browser viewport emulation is identified as such in performance records. No remote deployment or GitHub Actions run is claimed.
