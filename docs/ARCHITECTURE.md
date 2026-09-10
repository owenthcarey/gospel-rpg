# Architecture

A static Vite application using strict TypeScript, Babylon.js, native HTML/CSS, and IndexedDB through `idb`. No account flows, runtime APIs, remote model URLs, or generated conversations.

| Module                                             | Responsibility                                                                            |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/main.ts`                                      | Composition, serialized user actions, region changes, save queue and visibility lifecycle |
| `src/game/quest.ts`                                | Legacy prelude and independent village story transitions                                  |
| `src/game/episode/`                                | Episode transitions, objectives and derived presentation                                  |
| `src/game/pathfinding.ts`, `navigation.ts`         | Bounded A*, reachable interaction approaches and movement stepping                        |
| `src/content/episode/`                             | Actions, scripture, ten scene beats, dialogue, observations and reflections               |
| `src/content/region.ts`, `regions.ts`, `assets.ts` | Village layout, dynamic destinations, region and model contracts                          |
| `src/scene/runtime.ts`                             | One engine/render loop and transactional region replacement                               |
| `src/scene/world.ts`, `input.ts`                   | Capernaum exploration, camera, terrain and disposable input bindings                      |
| `src/scene/actors/`                                | Clip sampling, short NPC routes and visible consequences of progress                      |
| `src/scene/regions/lake.ts`                        | Boats, nets, cargo, actors and camera compositions for the narrated account               |
| `src/ui/`, `src/ui/views/`                         | HTML menus, compact objectives, captions and transcript                                   |
| `src/persistence/`                                 | Save validation, migrations and IndexedDB slots                                           |
| `tools/blender/`, `assets/source/`                 | Reproducible model/animation recipe and workshop source                                   |

## State and narrative

UI actions dispatch typed events. The pure `transition` function is the only authority for progress; rendering and animation cannot grant it. Imported saves never supply executable markup. The legacy quest remains the prelude so old item and journal IDs retain their meaning.

The episode moves through `not-started → preparing → witnessing → aftermath → complete`. Preparation is a set of completed tasks, with a separate carried basket. During witnessing, the checkpoint names the current unread scene. Previous scenes are journaled; leaving retains that checkpoint. Advance and summary events include the expected checkpoint, making duplicate/stale events harmless. A summary records all canonical scene memories and returns to the playable aftermath. Three equally valid reflections complete the episode.

Ezra's village story is independent. Main/village tracking only changes navigation guidance. `villageMemory` remembers the selected discovery; migrated saves leave it unspecified rather than inventing a choice.

## Movement and region ownership

A one-meter walk grid includes building clearance. Eight-neighbor A* uses an octile heuristic and prevents diagonal corner cutting. Interaction approaches are ranked by actual reachable route length. Movement consumes remaining travel time across path cells, and keyboard movement checks both axes on diagonal steps. Tests verify available authored destinations throughout the story.

Capernaum owns the orbitable exploration camera. Lake Gennesaret owns the composed narrative camera and has no player locomotion. The traveler's shore position remains in state while the lake is displayed.

`GameRuntime` retains one Babylon engine and render loop. A region change deactivates the old scene, loads a candidate, establishes its complete saved state, then disposes the old scene and activates the replacement. Loading failure drains outstanding model requests, disposes the candidate and reactivates the old scene. Application state and autosave change only after successful arrival. User actions are serialized and loading disables input.

Each region owns its asset containers, actors, observers, shadows, meshes and listeners. Model loading is limited to four concurrent requests; materials can be shared within a scene but disposable resources are never shared between scenes. Asset URLs respect the Vite deployment base.

Input clears on blur, menus and movement cancellation. Slow exploration frames are consumed in steps of at most 50 ms, up to 250 ms per frame; longer suspension gaps are discarded. Gold route markers clear on arrival, keyboard movement or pause. Menus pause simulation and reduce rendering frequency. Hidden documents stop simulation and rendering.

## Presentation

Fifteen character variants share a twelve-bone skeleton and sixteen Blender-authored clips. Three additional clips are exported only on the actors that use them in Nain. Each actor samples its own animation groups; movement follows the gameplay grid, not root motion. A named socket holds the traveler's basket. Village props, gathered neighbors, returned boats and departed fishermen derive from progress, including after loading earlier saves.

The lake uses ten durable beats with bounded four-second visual transitions. Continue is always available; animation never advances the account. Restored checkpoints establish a complete composition. Pause/read, modal menus and document visibility suspend motion. Reduced motion uses immediate camera/boat compositions and still actor poses. Low quality removes shadows, lowers render resolution and reduces the crowd.

F3 opens a local rendering snapshot. Development builds also expose a once-per-second canvas diagnostic attribute; production gameplay does not maintain that attribute. No telemetry is sent. See [verification](VERIFICATION.md) for budgets and measurement limits.

## Persistence

Database `the-way-journeys` contains `saves` and `preferences`. Database layout version 1 is separate from **save envelope version 8**. One autosave and three manual slots are supported. The envelope stores `version`, `region`, `savedAt`, and `state`; state also carries the validated current region.

State contains the legacy position, quest, inventory, discoveries, village story, journal and play time, plus `episode`, `campaign`, `life`, `road`, `galilee`, `tracking`, `villageMemory`, and `region`. See [versioned fixtures](../tests/fixtures/saves/) for full portable examples, including an interrupted lake scene and completed episode.

Migrations proceed v1 → v2 → v3 → v4 → v5 → v6 → v7 → v8. Existing journeys retain their earned content. Completing an old prelude unlocks the episode without replaying errands; it does not complete the new episode. Unknown future versions, invalid enums, duplicate IDs, impossible inventories, inconsistent region/checkpoint phases, missing or extra journal records, nonfinite coordinates, and files over 128 KB are rejected. Restored exploration positions are checked for walkability.

Serialized writes prevent old snapshots overtaking newer events. Autosave follows story events, checkpoint/region changes, every 20 seconds of active play and page hiding. Browser shutdown durability remains best effort. Manual saves and export use the current snapshot. When IndexedDB cannot open, session slots and export remain available with a visible warning. Failed writes reject and preserve the earlier durable slot; the interface reports the failure and export remains available.

Additional towns, streamed open worlds and offline caching remain deferred. See [RFC-001](rfcs/001-into-the-deep.md) for the milestone contract.

## Chapter II and the neighborhood (RFC-002)

The `content/campaign/chapters.ts` registry originally defined five story tracks, source metadata, availability, and completion. `regions.ts` now defines seven exploration spaces and three presentation spaces. Runtime factories create each view; exploration capabilities expose movement without coupling runtime dispatch to a particular scene class.

`game/campaign/progress.ts` handles the roof chapter, companion and table stories. Contextual actions have stable IDs, local targets, explicit requirements and a distance guard. Gateways form a small directed graph: guidance chooses the next doorway rather than teleporting the traveler. A successful transition retains the last exploration position in each visited region. Failed loads never commit candidate state.

The roof account has eight durable checkpoints and the same leave/resume/summary contract as the lake. It is independent of the optional neighborhood tasks. Three aftermath observations unlock one of three saved reflections. Original narration and scripture remain separate, including in the full transcript.

The companion state records route, gate, step and position. `NeighborhoodActivity` moves Amos through reachable path cells at simulation speed and asks the reducer to advance only when both travelers are near the next meeting point. The main snapshot captures his actual position before saving. Menus and hidden pages pause movement; reduced motion freezes decorative motion without teleporting the companion. Choosing a meeting point also slows the traveler's automatic approach to a compatible walking pace. Manual movement can leave Amos behind; he waits, and the map always locates him.

One held object is allowed across all neighborhood spaces. Shelf objects, carried objects, cleared cart and prepared tables derive from saved state. Objects can be returned to their shelves; interrupted tasks remain available. Ambient street movement is cosmetic and unsaved. Indoor roof pieces hide, camera-facing walls lower, and a fixed room camera keeps entrances and furniture in view.

RFC-002 introduced save envelope **v5**, extending the migration chain through v4. The new `campaign` object stores roof, walk, table, carrying, notes and visited positions. Validation checks known IDs, finite per-region bounds, exact derived journal sets and cross-field consistency. Existing episode progress, inventory, Ezra memories and interrupted lake checkpoints remain unchanged. Versioned v5 examples cover a walking companion, filled jug and interrupted roof account.

All static GLBs use one vertex-color material per model, retaining a single material group per prop. Characters retain independent skins and clip sampling. That milestone supplied twelve clips and a 53-model kit; RFC-003 extends those contracts below. See [RFC-002](rfcs/002-through-the-roof.md) and the current [verification record](VERIFICATION.md).

## Living Capernaum (RFC-003)

`game/life/` defines two bounded progress records: the investigation moves from invitation through clues, identification, return and an ending; the bench moves through inspection, method choice, preparation, fitting and a seat check. Clearing and collecting are independent prerequisites. `content/life/` supplies authored actions, conversations, places, evidence, journal entries and derived visual arrangements. Both tracks join the existing registry, bringing it to seven.

`WorldAction` supplies semantic motion and optional visibility/free-hand requirements. The compact tray and full context dispatch the same events through the serialized queue and pure distance/prerequisite guards. Original episode practical actions use their own typed definitions with the same reach requirement. Stale or remote events cannot award progress. Blocked carrying actions describe the actual held item’s return point; shared guidance routes through doorways to that destination. Every neighborhood held item is attached in every exploration region, including the shore.

`Actor.playOnce` uses finite simulation-time sampling. Modal pause retains its exact frame; reduced motion immediately establishes the resulting base pose. Animation completion never changes game state. `LifeActivity` derives the returned pouch, bench variants, material availability and seated neighbors from the loaded save. Decorative company does not move Amos or replace his authoritative escort position. The bench’s footprint exists throughout the game.

The journal has Stories, People, Places and Memories views. Story filtering and clue evidence retain all old entries and transcripts. Known person/place links use the existing doorway graph; leaving a presentation through a journal link preserves its checkpoint. Departed Gospel figures retain transcript context without offering an unavailable destination. Label placement prioritizes the nearest destination, tracked objective and people, avoiding other labels and HUD controls; crowded destinations remain accessible from the map.

V6 adds `life` and extends held-item/tracking enums. `persistence/life.ts` validates known phases, exact derived journal sets, required clues, methods, cleared status and held-material consistency. V1–v5 migration initializes both stories without inventing progress or mutating the input envelope. Portable fixtures include a held pouch, a repair interrupted with its brace, and completed stories with an occupied table.

`AssetLibrary` uses geometry/material-sharing mesh clones with independent render lifecycles. This fixes static scenery disappearing when shadow passes are removed in Low quality. Explicit exploration inventories load only local architecture/activity plus shared held objects, with the existing four-request bound. F3 includes per-asset placed/enabled/recently-drawn counts and the loaded inventory. Lightweight canvas pose attributes support production animation checks; the larger automatic diagnostic snapshot remains development-only. Required-asset contracts and a deterministic software-rendered image comparison test actual scenery separately from performance counters.

See [RFC-003](rfcs/003-living-capernaum.md) and [verification](VERIFICATION.md) for acceptance and measured limits.

## Beyond Capernaum (RFC-004)

`game/road/` owns Chapter III, Tamar’s investigation and Neri’s cross-region walk. `content/road/` contains stable actions, places, gateway arrivals, route nodes, evidence, journal entries, six Gospel beats and seven source verses. Story metadata in `campaign/chapters.ts` supplies availability, started/completed status and source labels. Prelude journal text is independent of the tracked chapter.

`roadJourney` runs within the existing guarded campaign gateway transition. The companion crosses only his current route’s exit, with both participants near the meeting point. Crossing another exit preserves his actual region and position. `RoadActivity` moves him through the current region’s walk grid; it pauses when approached for conversation, when the player is too far away, or when the region is paused/inactive. The runtime snapshots his actual position before every transition or save. A route step is committed only when its expected index and both proximity checks agree. Both routes terminate at the same courtyard; the completed seated pose is cosmetic, preserving the authoritative navigation position.

The new exploration layouts supply a deterministic `height(Point)` function. Ground/path vertices, placed actors, player/companion roots, labels, destination rings and route dots use `groundHeight`. Gameplay remains bounded 2D A* with explicit obstacle footprints; there are no stacked walkable surfaces. Distant scenery is outside the walkable area. The regional journey map is schematic and directs the existing gateway navigation, without teleporting the player. Its story unlocks match the playable gateway unlocks.

`ui/views/gospel.ts` provides common reading, focus, progress, transcript, pause, summary and leave controls for all three accounts, preserving prior action/checkpoint IDs. `NainRegion` owns a complete composition for every checkpoint and a bounded cosmetic clock. `Actor.sampleAt` establishes a finite pose directly. Reduced motion selects still compositions. Scripture progress belongs exclusively to the reducer.

V7 initializes road stories empty when migrating any v1–v6 save. `persistence/road.ts` checks finite/reachable positions, known phases, prerequisites, visited-region evidence, exact route/region/index consistency and completed positions. The shared schema requires the exact derived road journal set and preserves all old fields and earned IDs. Export/import includes a companion waiting in a different region and every Gospel checkpoint. Transactional load failure continues to preserve both active state and the prior durable save.

New rendering tests use the existing bounded warmup/cadence procedure, explicit essential-asset checks and fixed SwiftShader image contracts. The Nain negative control removes static GLB geometry while leaving actors and terrain, requiring the damaged image to fail comparison. Reference compositions keep the unchanged 300 High / 130 Low draw-call limits and 5 MiB kit budget. See [RFC-004](rfcs/004-the-road-to-nain.md) and [verification](VERIFICATION.md).

## Living Galilee (RFC-005)

`game/galilee/` owns two independent records. The spring stores observations, clearing, four quarter-turn orientations, a bounded hint level, tested state and one reflection. `traceWater` follows adjacent open ports from the west source, returns the first gap, and recognizes two valid receiving basins. It does not depend on the action order or a hard-coded success button. Rotating after a test invalidates that result. The resting-place record stores two observations, a selected site, a set of placed supplies, screen direction, checked state and a reflection. `checkArrangement` requires all supplies and an open, sheltered approach. Taking placed supplies back invalidates readiness; returning all supplies allows relocation until completion.

The `content/practical.ts` adapter exposes consistent nearby actions from the existing campaign, episode and Galilee definitions. Stable events continue through their own reducers and distance/prerequisite checks. `galilee-action`, `galilee-turn`, `galilee-screen` and `galilee-hint` are serialized with the other game actions. Rotation events carry their expected orientation, so duplicate clicks cannot silently turn twice. Journal records derive from monotonic observations and conclusions; temporary arrangements remain in their own record.

`GalileeActivity` reconstructs the channel geometry, water route, available tools, placement guides and seated company from progress. Authored placements use the same ground height and screen direction as the walking grid. New furniture is a runtime obstacle rather than a change to the historical road-save validator: a valid old standing position remains importable, and exploration moves it to nearby clear ground when necessary. Neri and Amos retain their own saved positions and routes. Decorative company never writes progress. Scene-owned meshes/materials are disposed with the region.

Static glTF handedness requires a quarter-turn correction for the bend's basis and a half-turn for basin inlets. Imported-geometry tests check all sixteen piece/orientation combinations against the pure solver and verify the basin inlet faces the arriving water. Further tests verify the actual wet meshes and held-prop reach. Blender source appearance alone is insufficient for this contract.

The welcome scene initializes storage and the engine but requests no models. Begin/continue/import load only their destination through the existing transaction. Failure leaves the previous menu or scene usable; the autosave is written only after arrival. Full guidance shows existing labels/routes; restrained guidance keeps nearby and selected labels and the complete destination list. Walk selection has a live status and cancel button. Camera-obstructing tree roots lower visually without moving collision footprints. Player clip changes blend over 0.16 simulation seconds; exact Gospel poses remain directly sampled.

V8 initializes `galilee` empty for all v1–v7 envelopes. Validation checks unlocks, phases, observations, orientation bounds, held/placed exclusivity, successful solver results and exact derived journal entries. Old reflections, chapter checkpoints and companion positions remain unchanged. Guidance is a separately validated preference, defaulting to full. The v8 fixtures include cleared channels, a carried screen on the road, an unfinished resting place and both completed stories.
