# RFC-001: Into the Deep — A Complete First Gospel Episode

Status: implemented on 2026-09-08. This specification was drafted before implementation. Verification results and remaining hardware/editorial checks are recorded in [VERIFICATION.md](../VERIFICATION.md).

Authorization: the project owner requested this RFC followed by end-to-end implementation of the recommended milestone. This document fixes the scope for that work; it does not require a second approval round.

## Problem and intended result

The current game ends its main quest at Luke 5:4. The player prepares the shore but never experiences the catch or calling. Progress updates menus while the village remains almost unchanged. A completed v3 save has nowhere further to go.

This milestone delivers one complete opening episode: preparation, gathering, teaching, the catch, the calling, a return to the shore, and a personal reflection. The traveler remains an original shore-side helper and witness. The episode supplies reusable interactions, actor animation, scene checkpoints, and region lifecycle behavior for later chapters.

The intended experience is an unhurried 25–40 minutes with optional conversations, rereading, and exploration. This is a playtest target, not an artificial timer or a guaranteed duration. Acceptance is based on the complete playable arc and reliability, not a line-count quota.

## Scope

- Preserve Simon's preparation quest, all three discoveries, and Ezra's independent village story.
- Continue completed preludes into **Into the Deep**, including original shoreline preparation and the complete catch-and-calling sequence.
- Add inspect, carry/place, and assist interactions with explicit prerequisites and persistent visible results.
- Add a separate, bounded lake presentation region. The traveler does not walk on water or occupy an invented seat beside Jesus. The camera shows a narrated dramatization while the traveler remains a shore-side witness.
- Add animated principal characters, supporting fishermen and a restrained gathering crowd; coordinated boats, oars, nets, and cargo.
- Add aftermath conversations and a remembered reflection. Original villagers can acknowledge the player's chosen memory.
- Add selectable story tracking, a compact phone HUD, readable scene captions, a full transcript, and a destination list usable without spatial pointing.
- Preserve v1/v2/v3 saves through an explicit v4 migration; implement reliable checkpoint resume, scene exit, skip, export/import, and manual-slot restoration.
- Extend automated tests and document hardware verification limits honestly.

## Narrative and editorial contract

The source is the public-domain World English Bible, Luke 5:1–11: <https://ebible.org/engwebp/LUK05.htm>. Store direct quotations in a local, identified source module with verse IDs. Only verified quotations may be attributed as spoken words to Jesus. Label all dialogue/narration as Original dialogue, Original narration, or Scripture · WEB.

Original helper actions do not cause, earn, or change the miracle. There is no combat, failure clock, moral score, spiritual currency, or alternate Gospel outcome. James and John may be represented in the boats, but do not receive invented quotations disguised as scripture. Do not invent the content of Jesus' teaching in Luke 5:3.

The dramatization uses narrated viewpoints of the lake; it does not claim that an invented traveler heard every historical conversation from the shore. Captions explicitly introduce this change of viewpoint. A reference attached to an imagined action identifies context, not evidence that the action occurred.

All three final reflections are equally valid. The final journal records the selected reflection. A migrated, completed Ezra story has an unspecified memory until the player voluntarily remembers it again; migration must not invent a previous choice.

Formal historical/theological review by a human specialist remains a release consideration. Source verification and provenance tests are implemented here; they are not represented as a substitute for that review.

## Playable flow

1. **A place by the water:** existing errands and Luke 5:4 introduction remain available. Existing saves preserve their earned entries and items.
2. **Make room on the shore:** Simon introduces the continuation. Inspect the landing, carry an empty basket from the market to the landing, assist with the mooring, and find a place in the gathering. These are explicitly imagined connective activities. Preparation can be explored without time pressure. The basket is visible while carried and at its destination after placement.
3. **A view across the water:** enter the lake encounter from a shoreline viewpoint. Explicitly explain that the following scenes present Luke's account.
4. **Teaching from the boat:** show Jesus seated, people gathered, and the boat near land. Narrate Luke 5:1–3 without invented teaching.
5. **Into the deep:** show the boat moving outward and the fishermen rowing; quote Luke 5:4–5 with correct speakers.
6. **The catch:** show the net lowered, the catch and strain, and the signal to the second boat. Present Luke 5:6–7.
7. **Astonishment and calling:** present Simon's response and Jesus' calling, with the other fishermen present. Show restrained, appropriate actor poses.
8. **Back to the shore:** boats return with cargo. Narrate Luke 5:11 and restore the player to the shoreline. World layout reflects the completed event, including the fishermen's departure rather than leaving them permanently waiting for the old quest.
9. **What stays with you:** assist with receiving a basket, talk with Miriam and Ezra, and select a reflection. Completion adds a chapter record and leaves the village available. The scene transcript remains readable.

Each scene beat advances only through an explicit player action. Presentation can animate, but elapsed animation time never grants progress. The player can pause, read, leave for the village, resume the same beat, or finish the presentation using a labeled summary action. Skipping records the same canonical checkpoints and exposes the full transcript; it does not skip the playable aftermath.

## State and content design

Retain the legacy quest stage as the **prelude** to minimize migration risk. Add typed episode progress, active story tracking, saved reflection choices, and a current region ID. Episode progress has preparation, witnessing, aftermath, and completion phases. The lake checkpoint identifies an authored beat with a stable ID. A stage and checkpoint combination must be validated, not inferred from arbitrary animation time.

The pure transition function is the only authority for progress. Content definitions provide interaction IDs, labels, verbs, prerequisites, effects, objective destinations, and scene beat IDs. Rendering derives a presentation from saved progress. It cannot grant rewards or alter canonical outcomes. Repeated events are idempotent; an advance event names the expected current checkpoint so stale/double clicks cannot jump two beats.

Separate modules cover:

- episode/content definitions and scripture provenance;
- pure episode transitions, selectors, and presentation descriptions;
- region registry and loader/lifecycle;
- navigation and input;
- actor and prop animation;
- lake scene staging and captions;
- interface views and story tracking;
- persistence validation/migrations.

These are focused game modules, not a general-purpose visual scripting engine or an editor.

## Region and scene lifecycle

The registry initially contains `capernaum` and `lake-gennesaret`. Region metadata identifies title, assets, mode (exploration or presentation), entry position, and return behavior.

Application transitions are serialized. During region loading, input is disabled and an accessible loading overlay is shown. Build a replacement presentation, then dispose the prior world only after successful loading; failed loading keeps or restores a usable prior region and offers retry. Avoid committing a save that requires an unavailable presentation before the transition succeeds.

Use a shared Babylon engine with disposable per-region scenes, or equivalent explicit ownership. Each scene owns its containers, actors, observers, input listeners, shadows, and generated geometry. Re-entering regions must not accumulate render loops or event listeners. Asset URLs are relative to the deployment base. Limit concurrent asset requests.

Camera controls belong to exploration. Cinematic framing belongs to presentation. Scene menus pause presentation; reduced motion chooses stable compositions and still actor poses. The player can leave the lake encounter at any checkpoint without losing progress, then resume through the shoreline viewpoint or journal.

## Blender and visual production

Use Blender MCP against a separate episode workshop, preserving unrelated open scenes. Extend reproducible Python recipes; save only the intended workshop and dependencies. Commit source recipes, source `.blend`, and exported GLBs together.

Required production inventory:

- a shared low-poly character skeleton and exported Idle, Walk, Carry, Gesture, Sit, Row, and Haul clips;
- traveler and principal character variants, James/John variants, and reusable crowd variants;
- boats with named seating/attachment transforms, separable oars, folded/lowered/full nets, empty/full baskets, a bread bundle and delivery props;
- a clear landing/viewpoint and restrained shoreline detail consistent with the existing matte, warm aesthetic.

Use meter scale, flat-shaded chunky silhouettes, applied mesh transforms, named clips and attachment points, Y-up GLB export, and explicit Babylon orientation checks. Do not add remote assets or runtime model APIs. Collision footprints must match the objects players approach. Validate every manifest asset, not only the traveler.

Inspect both the Blender result and the actual Babylon camera view. Animation should be readable at normal game distance, with feet contacting the surface and no excessive robe deformation. Net and cargo animation is authored/staged; no expensive cloth or buoyancy simulation is required.

## Interface and accessibility

- One compact current-objective control on phones; the full checklist is available in the journal. Main and optional story tracking are selectable and persisted.
- Body text and important objective text remain readable at 390px and small landscape sizes. Use touch targets around 44px and avoid essential 8px text.
- All destinations and interactions have text buttons; the map's destination list remains a non-spatial navigation alternative.
- Captions include scene title, speaker, provenance, reference, and user-paced Continue, Pause/read, Return to village, and Finish with summary controls.
- The transcript contains all beats and is available during and after the episode. Skipping animation does not remove access to narrative information.
- Menus and scene controls use focus management, keyboard navigation, focus restoration, and clear accessible names. Prevent held movement keys from continuing after modal or region transitions.
- Reduced motion suppresses camera flights, idle bobbing, and animated water; optional audio remains gesture-activated and nonessential.

## Save v4

Database layout stays independent from envelope version. Migrate all existing versions through their existing path to v3, then add default episode progress, Capernaum region, default tracking, and unspecified reflection. `quest: complete` unlocks the new episode; it never silently marks it completed.

Validate region/phase/checkpoint consistency, prerequisites, known unique IDs, carried-object consistency, selected reflections, journal completeness, finite positions, and file size. Old IDs remain stable. Canonical scene memories are derived from completed beats, with exact expected journal membership. A completed episode requires all aftermath tasks and a reflection.

Serialize autosave and manual writes. Persist snapshots at explicit story events, checkpoints, scene exits, region arrival, normal autosave intervals, and visibility changes. Browser shutdown durability remains best effort. Export always uses the current validated snapshot. Save failures remain visible and never claim durability.

Fixtures cover v1 arrival, v2 completed prelude, v3 partial/full village progress, and v4 interrupted/complete episode states. Loading an old save must not require replaying its prelude.

## Verification and budgets

Automated acceptance:

- existing preparation and optional story still complete in either collection/discovery order;
- every required interaction and destination is reachable when available;
- correct preparation order, stale events, duplicate actions, and invalid checkpoints cannot corrupt progress;
- all scene beats advance, leave/resume and skip consistently, including after save/import/reload;
- completed old journeys unlock the episode and retain all prior memories;
- carried/placed objects, crowd, boats, cargo and departed characters reflect state after loading;
- desktop and phone browser journeys complete the new episode;
- keyboard focus, compact phone HUD, scene controls, transcript, reduced motion and settings remain usable;
- failed region loading and failed storage operations have a recoverable user path;
- every shipped asset has valid local buffers, expected scale/structure, required clips/attachments, and no unrelated workshop geometry;
- formatting, lint, types, unit tests, production build, and browser tests pass.

Initial automated asset budgets: total shipped model bytes under 5 MiB, each character under 5,000 triangles, each prop under 10,000 triangles, no external textures/buffers. Keep a bounded crowd (maximum 12 presentation extras, fewer on low quality). Measure scene meshes, draw calls and frame timing through a local diagnostic path; do not add telemetry.

Hardware target: smooth 30 fps on an agreed midrange mobile device at low quality and 60 fps on a representative laptop at high quality. This environment cannot establish those hardware claims by Chromium emulation alone. Record actual tested browsers and measured conditions; leave real iOS/Android/Safari/Firefox verification explicitly pending where unavailable.

## Implementation sequence

1. Commit this specification to the working tree before gameplay changes.
2. Implement content definitions, pure transitions, checkpoint semantics, and v4 migration tests.
3. Produce and inspect Blender rigs, clips, boats, nets and props; validate exports.
4. Implement region ownership, state-driven village presentation, actors, interactions and lake staging.
5. Integrate captions, transcript, story tracking, compact phone objectives and aftermath.
6. Run complete browser journeys, fault/recovery checks, asset inspection and performance diagnostics; fix failures.
7. Update README, architecture, narrative, assets, roadmap and release documentation with actual behavior and limitations.

## Deferred scope

Additional towns, an open-water sailing system, combat, crafting/economy progression, voice acting, runtime-generated dialogue, offline caching, a content editor, and broad engine replacement are outside this milestone. No deployment or push is part of local implementation; the existing main-branch publishing workflow remains available.
