# Completed milestone and next steps

## Implemented: Into the Deep

The first Gospel episode now continues the existing village prelude through shoreline preparation, ten narrated catch-and-calling scenes, a changed shore, aftermath conversations and a remembered reflection. The traveler remains an original shore-side helper.

The milestone adds a shared engine with disposable exploration/presentation regions; explicit checkpoint transitions; carry/place/assist interactions; seven skinned actor variants and eight clips; 29 original models; staged boats, nets, oars and cargo; bounded crowds; selectable story tracking; compact phone objectives; transcript and pause/leave/resume/summary controls; v4 migration and versioned fixtures; loading/storage recovery tests; and local rendering diagnostics.

The prelude, three discoveries and Ezra's independent story remain playable. See [RFC-001](rfcs/001-into-the-deep.md) for scope and [verification](VERIFICATION.md) for actual checks and pending hardware work.

## Next priorities

1. Playtest both chapters and the four neighborhood stories for pacing, navigation clarity and visual legibility. Review the source, historical framing and original connective narrative with a human editor or specialist.
2. Profile real mobile GPUs and test Safari/iOS, Android, Firefox and Edge, including storage limits and eviction. Use the diagnostics and model budgets before increasing crowd or region size.
3. Broaden accessibility review with screen readers and touch hardware, including destination-list navigation, caption focus and small landscape layouts.
4. Select and specify the next bounded Gospel episode or explorable region, reusing the established state, actor, caption and region contracts.
5. Add region-aware offline caching and an update policy once device/storage behavior is measured.

Additional towns, open-water sailing, combat, a crafting economy, voice acting, runtime-generated dialogue and a content editor were outside this milestone. The full Galilee/Judea RPG remains a longer-term project. The repository still needs an explicit project license before open-source distribution; no license or public deployment change is implied by this local implementation.

## Implemented: Through the Roof

[RFC-002](rfcs/002-through-the-roof.md) continues the game with Chapter II, Capernaum lanes, an explorable gathering house and bakehouse, eight Mark 2:1–12 scenes, a remembered aftermath, two independent neighborhood stories and six observations. The milestone includes cross-region guidance, contextual verbs, a saved companion walk, one held object, persistent hospitality arrangements, v5 migration, text sizing, regional ambience and a 53-model Blender kit.

Human playtesting of both chapters and physical-device profiling remain priorities. Broader Galilee/Judea travel, sailing, offline caching and a content editor remain future work. The historical/editorial, pacing and real-device review items above still apply; browser automation does not settle them.

## Implemented: Living Capernaum

[RFC-003](rfcs/003-living-capernaum.md) adds Ruth’s two-clue pouch investigation and the landing bench’s two repair methods. Both have persistent intermediate progress, recoverable materials and visible conclusions. The milestone also adds nearby practical controls, finite action animation, stationary holding, journal categories/evidence/filters, cross-story return guidance and seated company at completed tables.

Static scenery now survives High/Low switching; per-region inventories and object-level rendering diagnostics accompany a negative image regression that detects missing geometry. The original Blender kit grows to 62 assets and sixteen clips, within the existing budgets. V6 migrates all earlier saves and includes portable interrupted/completed examples.

Before expanding the world again, measure the two new stories’ 20–35 minute human pacing target, inspect the corrected scenes on physical mobile GPUs, and review keyboard/screen-reader/touch usability and narrative framing. Those checks can guide the next bounded chapter or region; the full Galilee/Judea adventure remains future work.
