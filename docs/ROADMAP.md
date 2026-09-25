# Completed milestone and next steps

RFC-011 delivers **A World in Light**: one shared stage environment with per-place light, sky, horizon, fog and grading across every region and Gospel account; lit water; wind, particles, birds and ground cover; a Blender MCP rebuild of all 98 models with baked shading, individually built people and new vegetation; smoothed motion, glances and dissolving occluders; eased Gospel shots; a live title view, cold open, veiled transitions and title cards; and a crafted game interface. Four chapters, eleven optional stories and save v11 are unchanged. See [RFC-011](rfcs/011-a-world-in-light.md) and the [review guide](verification/rfc011/README.md).

RFC-010 delivered **The Way, Brought to Life**: refined people and portraits, nearby conversation performances, responsive scene framing, Capernaum terrain and architecture, physical-action accents, coherent water and all ten Chapter I compositions. See [RFC-010](rfcs/010-the-way-brought-to-life.md) and the [presentation review guide](verification/rfc010/README.md).

## Implemented: Into the Deep

The first Gospel episode now continues the existing village prelude through shoreline preparation, ten narrated catch-and-calling scenes, a changed shore, aftermath conversations and a remembered reflection. The traveler remains an original shore-side helper.

The milestone adds a shared engine with disposable exploration/presentation regions; explicit checkpoint transitions; carry/place/assist interactions; seven skinned actor variants and eight clips; 29 original models; staged boats, nets, oars and cargo; bounded crowds; selectable story tracking; compact phone objectives; transcript and pause/leave/resume/summary controls; v4 migration and versioned fixtures; loading/storage recovery tests; and local rendering diagnostics.

The prelude, three discoveries and Ezra's independent story remain playable. See [RFC-001](rfcs/001-into-the-deep.md) for scope and [verification](VERIFICATION.md) for actual checks and pending hardware work.

## Next priorities

1. Playtest all four chapters and eleven optional stories for pacing, navigation clarity and visual legibility. Review the source, historical framing and original connective narrative with a human editor or specialist.
2. Profile real mobile GPUs and test Safari/iOS, Android, Firefox and Edge, including storage limits and eviction. Use the diagnostics and model budgets before increasing crowd or region size.
3. Broaden accessibility review with screen readers and touch hardware, including destination-list navigation, caption focus and small landscape layouts.
4. Use playtest findings to select the next bounded Gospel episode or region, reusing the terrain, cross-region companion, source, caption and save contracts.
5. Add region-aware offline caching and an update policy once device/storage behavior is measured.

Additional towns, unrestricted open-water sailing, combat, a crafting economy, voice acting, runtime-generated dialogue and a content editor were outside this milestone. The full Galilee/Judea RPG remains a longer-term project. The repository still needs an explicit project license before open-source distribution; no license or public deployment change is implied by this local implementation.

## Implemented: Through the Roof

[RFC-002](rfcs/002-through-the-roof.md) continues the game with Chapter II, Capernaum lanes, an explorable gathering house and bakehouse, eight Mark 2:1–12 scenes, a remembered aftermath, two independent neighborhood stories and six observations. The milestone includes cross-region guidance, contextual verbs, a saved companion walk, one held object, persistent hospitality arrangements, v5 migration, text sizing, regional ambience and a 53-model Blender kit.

Human playtesting of both chapters and physical-device profiling remain priorities. Broader Galilee/Judea travel, sailing, offline caching and a content editor remain future work. The historical/editorial, pacing and real-device review items above still apply; browser automation does not settle them.

## Implemented: Living Capernaum

[RFC-003](rfcs/003-living-capernaum.md) adds Ruth’s two-clue pouch investigation and the landing bench’s two repair methods. Both have persistent intermediate progress, recoverable materials and visible conclusions. The milestone also adds nearby practical controls, finite action animation, stationary holding, journal categories/evidence/filters, cross-story return guidance and seated company at completed tables.

Static scenery now survives High/Low switching; per-region inventories and object-level rendering diagnostics accompany a negative image regression that detects missing geometry. The original Blender kit grows to 62 assets and sixteen clips, within the existing budgets. V6 migrates all earlier saves and includes portable interrupted/completed examples.

The remaining review for this milestone is to measure the two new stories’ 20–35 minute human pacing target, inspect the corrected scenes on physical mobile GPUs, and review keyboard/screen-reader/touch usability and narrative framing. Those checks can guide the next bounded chapter or region; the full Galilee/Judea adventure remains future work.

## Implemented: Beyond Capernaum — The Road to Nain

[RFC-004](rfcs/004-the-road-to-nain.md) extends the journey with a Galilean road, roadside farm and Nain gate; a six-scene Luke 7:11–17 chapter; Tamar’s landmark investigation; and Neri’s two walking routes across three regions. Shared Gospel controls, a regional journey map, gentle terrain elevation, optional investigation hints and actual companion-location saves support the expansion. All earlier chapters, optional stories and held objects remain available.

The kit now has 71 original GLBs, fourteen actors, sixteen shared clips and three specialized procession clips within the unchanged asset budget. V7 preserves v1–v6 journeys and supplies five portable review fixtures. New production journeys cover interruptions, both routes, clue orders/endings, Gospel reading, import/export, rendering and phone layouts. Read [verification](VERIFICATION.md) for actual results and the Blender MCP fallback.

Next, prioritize human pacing/editorial review and physical-device/accessibility profiling of this larger build. Additional regions, free sailing, offline caching and broader world systems remain separate milestones.

## Implemented: Living Galilee

[RFC-005](rfcs/005-living-galilee.md) adds a channel-connection adventure and an arrangement adventure across the existing road and farm. Both offer alternate solutions, recoverable supplies, saveable intermediate work, original memories and persistent visible company. Shared practical actions, quieter guidance, explicit walk cancellation, camera clearance and direct saved-region startup make the existing world easier to explore. The kit grows to 79 original assets within the existing limits; v8 preserves previous saves.

The next decision should follow human playtesting of the now twelve story tracks (three chapters and nine optional stories), especially repeated carrying, channel legibility and phone navigation. Physical-device performance, assistive technology, historical/editorial review and pacing remain the external review priorities above. The complete Galilee/Judea map, free sailing and offline update/storage policy remain separate milestones.

## Implemented: Across the Lake

[RFC-006](rfcs/006-across-the-lake.md) adds an ordinary controllable boat, two revisitable shores, Joel's optional landmark-navigation adventure and Chapter IV, Peace, be still. Seven Mark 4:35–41 scenes, three aftermath visits and equal reflections retain the shared reading controls. Explicit boarding/docking, map routes, saved heading/position, clues, retry and hints support the crossing. V9 preserves all earlier journeys, supplies and both companions. The 84-model kit stays below the unchanged 5 MiB cap through verified lossless compaction.

That milestone delivered four bounded Gospel chapters and ten optional stories. Further expansion should follow playtesting of the complete journey, especially repeated travel, landmark clarity, boat handling and the difference between exploration and Gospel staging. Broader Galilee/Judea travel, unrestricted sailing, offline updates and larger world systems remain future work; the human and physical-device review priorities above still apply.

## Implemented: A Connected Journey

[RFC-007](rfcs/007-a-connected-journey.md) connects the existing four-chapter world with saved final destinations, explicit multi-region route legs, a returning-player recap, journal status views, consistent physical-action feedback, and a separate completed-account replay cursor for all 31 Gospel scenes. The optional **The way home** interlude revisits Leah, Hannah and Miriam before a closing reflection; skipped optional stories remain valid and the world stays open.

V10 preserves v1–v9 journeys and adds four portable examples. The kit contains 85 original models within the unchanged 5 MiB cap, including a reusable passage marker and refined landing edges. Replay/route interruption, legacy saves, both return endings and one continuous fresh-save four-chapter journey are covered by automated checks; consult the verification record for actual outcomes and review limits.

The next expansion should follow human review of the complete connected journey, including how often players use saved routes, whether the recap helps after time away, whether replay is clearly distinguished from new progress, and whether the closing interlude feels earned with different optional-story histories. Physical-device, assistive-technology and editorial review remain the leading external validation priorities.

## Delivered: The Journey in Your Hands

RFC-008 adds a useful journal overview, compact expandable objectives, work controls beside the world, temporary screen previews, target/camera focus and deliberate pointer selection. Existing narratives, practical solutions and saves remain intact. Firefox/WebKit now have a separate real-WebGL smoke suite in addition to the complete Chromium journeys. The next evaluation should use physical touch devices and assistive technology alongside the supplied practical review saves; automated coverage does not settle pacing or usability.

## Delivered: Capernaum, Fully Realized

[RFC-009](rfcs/009-capernaum-fully-realized.md) adds the optional early landing adventure, nine original craft props, state-aware village activity and v11 continuity. Either crossing remains available with recoverable supplies and a remembered reflection.

## Delivered: A World in Light

[RFC-011](rfcs/011-a-world-in-light.md) turns the existing journey into a finished-looking game without adding content: environment profiles and a shared stage, lit water, atmosphere and ground cover, a Blender MCP asset pass (baked shading, people, vegetation, lossless channel pruning), runtime motion and camera polish, a shot director for all four Gospel accounts, and a new first impression and interface.

Next, with the presentation layer in place:

1. **Human playtest** of the complete journey with the new look ([playtest guide](PLAYTEST.md#a-world-in-light)): first-run cold open and arrival, readability of labels and title cards, comfort of camera eases and glances, and whether the atmosphere supports rather than distracts from reading. Editorial review of the new original narration.
2. **Physical devices** — mid-range phones at Low and laptops at High — to confirm the 30/60 FPS targets now that post-processing, particles and ground cover exist, and Safari/iOS WebGL behaviour.
3. **Bespoke re-staging** of Through the Roof, At the gate and Peace, be still using the shot director and fuller blocking, which this milestone deliberately left out.
4. A **new chapter or region**, built on the finished pipeline.
