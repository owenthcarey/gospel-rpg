# Completed milestone and next steps

## Implemented: Into the Deep

The first Gospel episode now continues the existing village prelude through shoreline preparation, ten narrated catch-and-calling scenes, a changed shore, aftermath conversations and a remembered reflection. The traveler remains an original shore-side helper.

The milestone adds a shared engine with disposable exploration/presentation regions; explicit checkpoint transitions; carry/place/assist interactions; seven skinned actor variants and eight clips; 29 original models; staged boats, nets, oars and cargo; bounded crowds; selectable story tracking; compact phone objectives; transcript and pause/leave/resume/summary controls; v4 migration and versioned fixtures; loading/storage recovery tests; and local rendering diagnostics.

The prelude, three discoveries and Ezra's independent story remain playable. See [RFC-001](rfcs/001-into-the-deep.md) for scope and [verification](VERIFICATION.md) for actual checks and pending hardware work.

## Next priorities

1. Playtest the complete episode for pacing, navigation clarity and visual legibility. Review the source, historical framing and original connective narrative with a human editor or specialist.
2. Profile real mobile GPUs and test Safari/iOS, Android, Firefox and Edge, including storage limits and eviction. Use the diagnostics and model budgets before increasing crowd or region size.
3. Broaden accessibility review with screen readers and touch hardware, including destination-list navigation, caption focus and small landscape layouts.
4. Select and specify the next bounded Gospel episode or explorable region, reusing the established state, actor, caption and region contracts.
5. Add region-aware offline caching and an update policy once device/storage behavior is measured.

Additional towns, open-water sailing, combat, crafting, voice acting, runtime-generated dialogue and a content editor were outside this milestone. The full Galilee/Judea RPG remains a longer-term project. The repository still needs an explicit project license before open-source distribution; no license or public deployment change is implied by this local implementation.
