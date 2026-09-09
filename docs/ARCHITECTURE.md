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

Twelve character variants share a twelve-bone skeleton and twelve Blender-authored clips. Each actor samples its own animation groups; movement follows the gameplay grid, not root motion. A named socket holds the traveler's basket. Village props, gathered neighbors, returned boats and departed fishermen derive from progress, including after loading earlier saves.

The lake uses ten durable beats with bounded four-second visual transitions. Continue is always available; animation never advances the account. Restored checkpoints establish a complete composition. Pause/read, modal menus and document visibility suspend motion. Reduced motion uses immediate camera/boat compositions and still actor poses. Low quality removes shadows, lowers render resolution and reduces the crowd.

F3 opens a local rendering snapshot. Development builds also expose a once-per-second canvas diagnostic attribute; production gameplay does not maintain that attribute. No telemetry is sent. See [verification](VERIFICATION.md) for budgets and measurement limits.

## Persistence

Database `the-way-journeys` contains `saves` and `preferences`. Database layout version 1 is separate from **save envelope version 5**. One autosave and three manual slots are supported. The envelope stores `version`, `region`, `savedAt`, and `state`; state also carries the validated current region.

State contains the legacy position, quest, inventory, discoveries, village story, journal and play time, plus `episode`, `campaign`, `tracking`, `villageMemory`, and `region`. See [versioned fixtures](../tests/fixtures/saves/) for full portable examples, including an interrupted lake scene and completed episode.

Migrations proceed v1 → v2 → v3 → v4 → v5. Existing journeys retain their earned content. Completing an old prelude unlocks the episode without replaying errands; it does not complete the new episode. Unknown future versions, invalid enums, duplicate IDs, impossible inventories, inconsistent region/checkpoint phases, missing or extra journal records, nonfinite coordinates, and files over 128 KB are rejected. Restored exploration positions are checked for walkability.

Serialized writes prevent old snapshots overtaking newer events. Autosave follows story events, checkpoint/region changes, every 20 seconds of active play and page hiding. Browser shutdown durability remains best effort. Manual saves and export use the current snapshot. When IndexedDB cannot open, session slots and export remain available with a visible warning. Failed writes reject and preserve the earlier durable slot; the interface reports the failure and export remains available.

Additional towns, streamed open worlds and offline caching remain deferred. See [RFC-001](rfcs/001-into-the-deep.md) for the milestone contract.

## Chapter II and the neighborhood (RFC-002)

The `content/campaign/chapters.ts` registry defines all five story tracks, source metadata, availability, and completion. `regions.ts` defines four exploration spaces and two presentation spaces. Runtime factories create each view; exploration capabilities expose movement without coupling runtime dispatch to a particular scene class.

`game/campaign/progress.ts` handles the roof chapter, companion and table stories. Contextual actions have stable IDs, local targets, explicit requirements and a distance guard. Gateways form a small directed graph: guidance chooses the next doorway rather than teleporting the traveler. A successful transition retains the last exploration position in each visited region. Failed loads never commit candidate state.

The roof account has eight durable checkpoints and the same leave/resume/summary contract as the lake. It is independent of the optional neighborhood tasks. Three aftermath observations unlock one of three saved reflections. Original narration and scripture remain separate, including in the full transcript.

The companion state records route, gate, step and position. `NeighborhoodActivity` moves Amos through reachable path cells at simulation speed and asks the reducer to advance only when both travelers are near the next meeting point. The main snapshot captures his actual position before saving. Menus and hidden pages pause movement; reduced motion freezes decorative motion without teleporting the companion. Choosing a meeting point also slows the traveler's automatic approach to a compatible walking pace. Manual movement can leave Amos behind; he waits, and the map always locates him.

One held object is allowed across all neighborhood spaces. Shelf objects, carried objects, cleared cart and prepared tables derive from saved state. Objects can be returned to their shelves; interrupted tasks remain available. Ambient street movement is cosmetic and unsaved. Indoor roof pieces hide, camera-facing walls lower, and a fixed room camera keeps entrances and furniture in view.

The save envelope is now **v5**, extending the migration chain through v4. The new `campaign` object stores roof, walk, table, carrying, notes and visited positions. Validation checks known IDs, finite per-region bounds, exact derived journal sets and cross-field consistency. Existing episode progress, inventory, Ezra memories and interrupted lake checkpoints remain unchanged. Versioned v5 examples cover a walking companion, filled jug and interrupted roof account.

All static GLBs use one vertex-color material per model, enabling shared static instances. Characters retain independent skins and clip sampling. The shared rig now supplies twelve clips; twelve actor variants and forty-one props make up the complete 53-model kit. See [RFC-002](rfcs/002-through-the-roof.md) and the current [verification record](VERIFICATION.md).
