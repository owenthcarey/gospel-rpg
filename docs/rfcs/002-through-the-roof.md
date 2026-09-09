# RFC-002: Through the Roof — An Explorable Capernaum and a Continuing Journey

Status: implemented and locally verified, 2026-09-09. This RFC was written and accepted before gameplay changes. Human pacing, editorial and physical-device review remain the explicit handoff items described below.

Authorization: the project owner requested this RFC followed by end-to-end implementation of the recommended milestone. This document fixes that scope; implementation continues without another approval round.

## Problem and intended experience

Into the Deep completes the opening Gospel account but leaves the traveler in one small village. Houses are scenery, most actions are dialogue choices, and the region, map, objectives and save schema encode a single chapter. The next milestone must give an existing traveler somewhere meaningful to go, while providing reusable exploration and story contracts.

Deliver Chapter II, **Through the Roof**, with an explorable residential district, two enterable buildings, contextual actions, two independent neighborhood stories, a complete narrated dramatization of Mark 2:1–12, and a playable aftermath. The original traveler helps neighbors and witnesses the account. The four bearers, the man on the mat, Jesus and the scriptural outcome retain their canonical roles.

Target an unhurried 35–50 minutes of new exploration, conversation and reading including optional stories. This is a human playtest target, not a timer or a claim established by automation. Scope and acceptance govern completion; the estimated 12–20K authored LOC is not a quota.

## Narrative contract

- Use the public-domain World English Bible text of Mark 2:1–12, stored verbatim in a local source module with verse IDs and a source link. Mark names Capernaum and four bearers. Luke 5:17–26 is a separately attributed parallel reference, never silently merged into Mark's quotations.
- Original narration, original dialogue and scripture are explicitly labeled. Do not invent quotations for Jesus, the healed man, or the four bearers. Local neighbors Hannah, Amos and Ruth are fictional. The house, its host and architectural staging are artistic interpretations; do not identify it as a historically certain owner's house.
- Clearly mark the passage of time between chapters. Do not imply the roof account immediately follows the catch on the same morning.
- The traveler does not replace a bearer, earn a miracle, manipulate the canonical outcome, or receive spiritual currency. Preparation concerns hospitality in an imagined neighboring courtyard. The dramatization is available once the chapter invitation is accepted, independently of optional help.
- Eight user-paced checkpoints: a crowded house; four bearers; through the roof; forgiveness; the scribes' question; Jesus' answer; arise and walk; amazement. All twelve verses remain available in the transcript, with full scene descriptions.
- Preserve pause, leave/resume, checkpoint autosave and finish-with-summary. Completing the presentation unlocks a playable aftermath and one of three equally valid reflections: welcome, persistence, amazement.
- The aftermath acknowledges the existing Into the Deep reflection and Ezra memory where present. Never invent a missing migrated choice.

## Explorable world

The shore remains available, including the prelude, Ezra's story and existing discoveries. Add three exploration regions:

1. **Capernaum lanes**: a compact residential district with a shaded courtyard, a narrow passage, a longer outer lane, a communal water point, entrances and visible street activity.
2. **The gathering house**: an enterable room with removable/cutaway roof and wall pieces, interior furniture, a story viewpoint, and an exit back to the lanes. Before and after the account it is explorable; the dramatization uses its own disposable presentation scene.
3. **Hannah's bakehouse**: an enterable working room with oven, shelf, table, supplies and a persistent hospitality arrangement.

Use named gateway IDs and arrival anchors. Travel saves the previous exploration position only after a successful region load. Returning to an explored region can restore its safe last position; doorway arrivals must not immediately retrigger a gateway. Inter-region objective guidance leads to the next gateway, then the local destination. Maps and destination lists use the same region definitions as navigation.

Retain bounded two-dimensional A* per exploration region. Parameterize bounds; use explicit transitions for changes of space instead of introducing full physics or continuous multi-floor navigation. Indoor cameras have tighter limits and hide occluding roof/wall pieces. Doorways and passages must work by ground click, destination list and keyboard.

## Contextual interactions and optional stories

Expose available world actions in a compact action panel for nearby objects, with explicit verbs, prerequisites and feedback. Carrying/place/use/inspect/open/accompany actions commit through pure gameplay transitions; visible props and actor poses derive from persistent state. Animation completion never awards progress.

### A way together

Amos would like company on a walk from the water point to the courtyard. The player may clear the short passage with a borrowed handcart handle/tool, or choose the longer outer lane. Both routes are valid and yield distinct remembered responses. Amos follows a reachable route, waits while the player stops or opens a menu, and resumes after save/load. He cannot be permanently lost, trapped by a gate or required to catch up under a timer. Arrival requires the traveler and companion to reach the courtyard. Choosing a route is durable; interrupted walks can be resumed. This story is independent of the Gospel presentation.

### A table for neighbors

Hannah invites the traveler to carry a bread basket and fill a water jug, then arrange a place to share them. The player chooses the courtyard or bakehouse table. Collect/deliver in either order, with one held object at a time; set items down only at valid destinations. Completed arrangements remain visible and Hannah/Ruth acknowledge the chosen location. This story can start or finish before or after the account. Both choices are equal and saved.

Add optional discoveries in the lanes and interiors, recorded once with original narration. The journal supports separate tracking for Chapter I, Chapter II, Ezra and each new neighborhood story. Completed stories remain readable and never dominate unfinished guidance.

## State, content and persistence

- Keep the pure transition function as the sole progress authority. Use stable namespaced IDs for new chapter, scene, action, discovery and journal records.
- Add a typed chapter/region registry for titles, availability, objectives, source metadata, maps and scene ownership. Generalize rendering dispatch through explicit region factories and navigation capabilities, retaining one Babylon engine and render loop.
- Extend the save envelope to **v5**. Migrate v1→v2→v3→v4→v5. Preserve all existing journal IDs, earned progress, inventory, reflections, village memories and interrupted lake checkpoints. Completed v4 episodes immediately unlock Chapter II; unfinished episodes remain playable.
- Store Chapter II phase/checkpoint/reflection, neighborhood story progress and choices, new discoveries, held object, companion travel state, and visited exploration positions. Validate finite coordinates against each region, known IDs, enum types, duplicate records, journal consistency and impossible cross-field combinations. Imported data never supplies executable content.
- Retain autosave, three manual slots, export/import and session-only recovery. Failed travel must preserve the old region and current progress. Failed writes must not claim durability.
- The original prelude's Luke 5:4 quotation becomes an optional journal reading. Its completion handoff leads naturally into preparation and the chronological lake presentation, while keeping old progression IDs and migrated completion valid.

## Blender and visual production

Use Blender MCP to build and inspect the new kit, extending the existing reproducible Python workflow. Work in a separate scene and preserve unrelated Blender data. Export only the intended assets and store the workshop source with its dependencies.

Required kit: modular basalt/plaster walls and doorways, roof segments (including an opening), doorway/gate, exterior steps, oven, worktable, bench/stool, shelf, jug, bread basket, handcart, tool/handle, empty and carried mats, and distinct neighbor/bearer/man variants. Reuse compatible existing props and skeletons. Add restrained reclining, rising, mat-carry and object-use motion where needed. Named attachment points and actor orientation must survive GLB conversion.

Check actual Blender poses and Babylon compositions: feet on floors, seated/reclining height, held-object contact, four distinct bearers, mat lowering through an opening, standing/walking aftermath, correct forward direction and mobile caption clearance. Reduced motion uses readable still compositions. Do not introduce a generation service or external licensed assets by default.

Optimize repeated static scenery with shared materials and suitable instancing. Keep independently animated actors separate. Review material group counts and shadow casters. Add diagnostics and automated asset budgets for the new region inventory rather than merely increasing global limits.

## UI, accessibility and pacing

- Region-aware HUD, maps, destination lists, journal and save-slot summaries.
- Compact contextual action panel usable with pointer, touch and keyboard; accessible action descriptions and focus restoration.
- Chapter selection/tracking and clear unavailable/available/in-progress/completed states. Existing journeys have a visible continuation from the shore and journal.
- Full transcripts remain readable independently of progression. Scene advance, pause and return actions remain visible on portrait and landscape layouts.
- Configurable readable text sizing, reduced motion, lower graphics quality, and region-appropriate optional ambience. Preserve all existing input methods.
- Smooth the prelude/episode handoff without erasing existing content or asking returning players to repeat work.

## Acceptance and verification

Automated acceptance must demonstrate:

1. A new journey completes both chapters; a completed v4 journey continues directly into Chapter II; every supplied legacy fixture migrates without lost progress.
2. All required destinations, doorways and available objectives are reachable in every relevant story phase. Closed passages change walkability; both companion routes complete.
3. Optional stories work before/after the account, in either collection order and for both choices. Carrying, companions, gate state and table arrangements restore correctly.
4. Every new checkpoint advances once, ignores stale commands, survives pause/export/import/reload, and supports leave/resume/summary equivalence. The complete verified scripture remains available.
5. Cross-region objectives select the correct gateway; repeated transitions dispose old scenes and inputs. Failed model loading leaves the prior region playable with retry.
6. Save validation rejects impossible new states while maintaining existing storage recovery behavior.
7. Every asset is self-contained, has bounded geometry, correct required clips/attachments and an authored source. The combined kit target remains under 5 MiB; a justified budget revision must be documented before accepting it.
8. Desktop and phone Chromium journeys, keyboard focus, touch destinations, readable text sizes, landscape scenes, reduced motion, types, lint, formatting, unit tests and production build pass.

Measure scene meshes, active meshes, draw calls, region-switch scene counts and frame cadence in the real browser. Initial new-region targets: no more than 300 draw calls on high and 130 on low in representative scenes, bounded crowd of eight on high/four on low, one settled scene, and four concurrent model requests. Existing village costs should decrease or remain within the recorded baseline. These are measured engineering budgets, not a guarantee from asset byte size.

Hardware target remains 30 fps on a representative midrange mobile device at low quality and 60 fps on a laptop at high. Chromium phone emulation cannot establish physical iOS/Android performance, thermal behavior, storage eviction or screen-reader usability. Record available checks truthfully; external human pacing, historical/theological and hardware reviews remain explicit handoff items when unavailable.

## Implementation order

1. Write this RFC before implementation.
2. Establish chapter content/state contracts, pure transitions, region definitions and v5 migration fixtures/tests.
3. Build and inspect the modular Blender kit and required animations.
4. Implement exploration regions, gateways, interior cameras, contextual interactions, companion movement and persistent arrangements.
5. Implement the house presentation, complete chapter, optional stories, campaign journal and accessible controls.
6. Run end-to-end journeys, recovery checks, rendering measurements and visual QA; resolve failures.
7. Update README, architecture, narrative, assets, roadmap and verification with actual delivered behavior.

## Deferred

Open-water sailing, combat, crafting/economy progression, a content editor, runtime-generated dialogue, voice acting, offline caching and a broad engine/UI framework replacement. No push, merge or deployment is implied by this implementation request.

## Implementation outcome

Delivered Chapter II, the lanes and both interiors, contextual interactions, both optional stories, v5 migration, accessible scene controls, regional ambience and the expanded Blender kit. The original chapter and prelude remain playable. The implementation reuses the existing state/rendering foundation; authored line count was not treated as a quota. See the [verification record](../VERIFICATION.md) for actual checks and measurements and the [playtest guide](../PLAYTEST.md) for a complete review route.
