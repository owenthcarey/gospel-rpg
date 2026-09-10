# RFC-005: Living Galilee

Status: implemented, 2026-09-10. Written before gameplay and asset changes. See the [verification record](../VERIFICATION.md#living-galilee--2026-09-10) for results and remaining human review.

Authorization: the owner selected the recommended improvements and requested the RFC first, followed by implementation end to end. No further approval round is required for this scope.

## Purpose

Make the existing world more satisfying to explore, manipulate and revisit. Add two original practical adventures on the Galilean road and roadside farm, consistent object actions and recovery guidance, clearer exploration, and visible continuity. Preserve all three Gospel accounts and seven earlier optional stories. Approximately 12–22K changed authored lines is a planning estimate, not a completion quota.

## Baseline

The review passed 267 unit tests, types, lint, production build and five selected Chromium journeys covering controls, Nain, companion persistence and failed asset loading. The existing full regression record contains 67 runnable checks and nine intentional skips. The 71-model kit totals 4,951,908 bytes, leaving 290,972 bytes under its 5 MiB cap. Human pacing, editorial review, physical touch/screen-reader usability and sustained mobile performance remain unestablished.

## Two original adventures

Both adventures unlock after Through the Roof, independently of Tamar, Neri and the Nain account. No task causes, earns or alters a Gospel event. All speech, environmental explanations and memories are identified as original fiction. The two stories target an unhurried 25–40 minutes together, to be measured by human playtesting rather than timed gates.

### A spring for travelers

At a small work site near the road's spring, inspect the source and two receiving basins. Borrow a wooden scoop, clear the inlet and silt in either order, and return the tool to free your hands. Rotate a bounded set of channel sections to connect the source to either basin. The two outlets are equally useful. The pieces have visible open ends, an accessible plan and equivalent direction descriptions. A test releases water along the actual connected route and reports the first gap or the reached basin. An unsuccessful test loses nothing; pieces can be adjusted and tested again. Optional graduated hints include an explicit solution. Select a reflection on patient work or shared water to complete the story.

The channel connection algorithm determines the result from the saved piece orientations; a button cannot simply award the solution. Inspection, clearing, rotations, hints, test result and ending persist. Cosmetic water animation cannot advance progress. Completed water remains visible and a fictional traveler uses the basin on later visits.

### Room under the olives

A fictional farm host invites the traveler to arrange a resting place. Inspect both a shaded grove and an open, breezier patch. Choose either location, then carry a woven mat, water jar and folding reed screen from their storage point. Place them at authored sockets with readable previews. Choose the screen orientation: leave a clear approach and shelter the seat. Checking the arrangement identifies any missing object or blocked approach without penalty. Before completion, recover placed objects and move the arrangement to the other site after returning its supplies. Check the seat and choose a memory of welcome or thoughtful preparation.

The two sites have distinct spatial compositions. No arbitrary free-form furniture placement, physics or inventory economy is required. The single held-object rule spans every old and new story. Items can always be returned to their source, including after leaving the farm. Completed arrangements visibly host a small company; save restoration derives the same layout and activity.

## Shared interaction and exploration

1. Unify the UI description of practical actions: stable ID, target, label, requirement/blocker, event and optional motion. Retain existing reducer guards and durable IDs. The nearby tray and inspection views expose the same action requirements, including held-item recovery.
2. Expose a selected destination with visible ground feedback, destination/approach status and an explicit cancel action. Selection survives movement toward the object and clears on cancellation, manual movement, pause or arrival. No task is completed by approaching it.
3. Offer full guidance and restrained exploration guidance as a saved preference. Restrained guidance reduces distant labels/route dots without hiding map destination lists, nearby actions, required controls or explicit hints. Provide an always-available explanation in controls/settings.
4. Add collision-aware landmark details and path approaches at the new work sites; improve doorway markers and lower obstructing scenery between camera and traveler where appropriate. Avoid moving legacy quest targets or saved companion paths into obstacles.
5. Add authored, progress-driven activity and acknowledgement of completed spring/resting-place work and selected earlier memories. Preserve Neri and Amos's authoritative positions. No real-time clock, missable schedule or simulated needs.

## Architecture and startup

Keep pure transitions, one Babylon engine, transactional region replacement, four concurrent asset requests, explicit inventories and object visibility contracts. Consolidate action presentation and story summaries where the new content otherwise duplicates existing dispatch. Keep chapter-specific Gospel compositions.

Open the welcome and save controls before loading a world. Beginning loads Capernaum; continuing or importing loads the saved region directly. A failed initial load leaves welcome/settings and retry available. Do not require downloading Capernaum to resume another region. Keep autosave untouched until successful arrival.

## Blender MCP production

Use the connected Blender MCP addon with the original procedural workshop. Preserve unrelated scenes. Add original channel sections/basins, scoop, supply rack, woven mat and reed screen; reuse compatible jars, benches and foliage. Distinguish the new host from existing named travelers. Refine carried props, work poses and transition blending with the established restrained animation style.

Measure export savings before enlarging the kit. Retain all sixteen shared and three specialized clip contracts. Begin with the unchanged 5 MiB total and 5,000/10,000 actor/prop triangle limits; if necessary, record measured justification in this RFC before adopting any revised cap. New detail must fit the existing 300 High / 130 Low road/farm reference draw-call limits. Retain essential geometry on both settings.

Deliver recipes, workshop `.blend` and self-contained GLBs together. Independently import exports for review: scale, orientation, skin/prop contact, channel openings, wet routes, screen direction, supported seated poses and collision clearance. Review both Blender and actual Babylon views, desktop and phone.

## Save v8

Add a bounded `galilee` record for the spring and resting-place stories. Extend held-item and story-track IDs. Migrate v1–v7 without inventing progress or changing earned journal entries, reflections, carried items, chapter checkpoints or actual companion positions. New adventures begin unstarted. Settings gain a validated guidance preference with full guidance as default.

Validate orientations, phases, observations, held/placed exclusivity, successful connection/arrangement results, unlocks, exact derived journal sets and known IDs. Reject future and forged saves. Keep the 128 KiB import limit. Supply portable fixtures for interrupted channel work, carried supplies, unfinished arrangement and both completed stories.

## Acceptance

1. All three Gospel accounts and nine optional stories complete. Neither new adventure gates an existing story or chapter.
2. Both water outlets, clearing orders, failed tests/retry, all hint levels and both spring reflections work. Wet visuals agree with the connection solver after load and quality changes.
3. Both resting sites, screen orientations, failed checks, recovery/relocation, all supply orders and both memories work. A held object never duplicates or disappears through travel, menus, Gospel reading or saves.
4. Every new destination has a reachable approach. Added scenery, markers, labels, character feet and saved positions agree with ground height and collision. Earlier companion routes stay reachable.
5. Nearby and inspection actions agree on requirements. Full/restrained guidance, cancellation, keyboard, phone portrait/landscape, large text and reduced motion remain usable.
6. Completed work changes visible activity and original conversation. Reloading and revisiting reproduces it without relocating saved companions.
7. Continue/import load the desired region directly. Failed startup/region loading preserves durable saves and supports retry. Every v1–v7 fixture migrates intact; invalid combinations are rejected.
8. Types, lint, formatting, production build, meaningful pure tests and complete browser regression pass. New browser journeys cover both stories and interruptions. Asset/rendering budgets and required-object checks pass. Review Blender exports and actual browser visuals; record results and external review limits honestly.

## Implementation sequence

1. Draft this RFC, then implement state, connection/arrangement rules, content and v8 compatibility.
2. Produce and inspect the original assets through Blender MCP.
3. Integrate practical actions, spatial presentation, journal/guidance, continuity, camera/selection and startup.
4. Exercise complete and interrupted stories, correct visual/usability defects and run regressions.
5. Update README, architecture, assets, narrative, playtest, roadmap and verification documentation with actual results.

Offline caching, free sailing, a new Gospel chapter, combat, an economy and a general content editor are separate milestones. This work does not include pushing, merging or deploying.
