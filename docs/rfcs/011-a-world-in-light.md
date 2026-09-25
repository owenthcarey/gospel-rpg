# RFC-011: A World in Light

Status: implemented and verified, 2026-09-25. Drafted before code or asset changes. See the [delivery notes](#delivery-notes--2026-09-25) and the [verification record](../VERIFICATION.md#a-world-in-light--2026-09-25).

The owner asked for the recommended studio-quality presentation milestone: rendering and atmosphere, character and motion quality, first impressions and interface, and the reusable core of cinematic staging. This RFC authorizes that local work, starting here and continuing through implementation and verification. The planning allowance is approximately **25–40K changed authored lines**, including tests, tools and asset recipes. Line count is not an acceptance quota. Source workshops, exported models and portraits are additional deliverables.

## Purpose

The game's systems are sound: a transactional region runtime, versioned saves, four Gospel chapters, eleven optional stories and broad automated coverage. What still reads as a prototype is almost entirely presentation:

- The sky is a flat clear color. There is no tone mapping or grading, and shadows come from a single 1024 px map.
- GLB and procedural surfaces are lit through different material models.
- There is no wind, particles or animal life.
- Characters share one body and move with stiff sine poses.
- Three of four Gospel accounts hard-cut between tableaux.
- The title is a text card, and region changes are instant cuts.
- The interface looks like an editorial website rather than a game.

This milestone closes that gap across **every existing region and chapter** rather than adding content. The intended result is apparent within the first thirty seconds:

- a living title view over the lake at dawn;
- a composed arrival in Capernaum under a real sky;
- warm, graded light with soft contact shadows;
- moving foliage, water and birds;
- people who look individual and move with weight;
- smooth, deliberate camera work in every Gospel account;
- an interface that feels crafted for this world.

Preserve the warm, matte, low-poly direction and its reverent tone, together with the authored narrative, the ordinary traveler and the independence of Gospel accounts from gameplay.

## Baseline and continuity

- **Baseline commit:** `04c56f8`.
- **Content:**
  - four Gospel chapters, 31 narrated/replay scenes and eleven optional stories;
  - ten exploration regions and four presentation regions;
  - 94 GLBs totaling 6,706,812 bytes;
  - fifteen portraits totaling 50,576 bytes.
- **Checks:** evidence validation, types, lint, **562 unit tests** and the production build all pass. The engine chunk is 2,990.98 kB (692 kB gzip).
- **Measured cadence:** 60 FPS at 2× device pixel ratio on an Apple M3 at High. This is headroom, not a physical-device claim.

Keep TypeScript, Babylon.js 9, Vite, local IndexedDB and static hosting.

- **Save format.** Save v11 and every historical migration remain unchanged. Presentation state is never saved. That covers profiles, shot progress, particle state, title/cold-open viewing, wind time, look-at targets and transition fades. The cold-open preference is the one exception: it is an ordinary validated setting, like guidance.
- **Progress authority.** Gameplay reducers remain the sole authority for progress. No animation, shot, transition or particle can grant progress, delay a guarded command, block Continue, or move a navigation root, saved companion, boat or carried object.
- **Contracts that stay intact:** every scripture passage, source label, original narration, scene ID, action guard, reflection, transcript, companion rule, replay cursor, saved destination and practical solver.
- **Welcome screen.** The welcome surface continues to request **no GLB models**. The title view is procedural.
- **Test contracts.** Existing accessible names, `data-action`/`data-setting` hooks, the native `<select>` controls and the canvas data attributes that tests rely on remain valid. Restyling must not remove them.

## 1. Rendering foundation

Replace the five copies of per-region scene setup with one shared, disposable **stage environment**:

- **Where it lives.** `src/scene/environment/` builds lights, shadows, sky, fog, image processing, post-processing and material conventions from a declarative **environment profile**.
- **Profiles.** They live in `src/content/environment.ts`, one per exploration region and per Gospel presentation. Checkpoints may blend toward a named variant, for example storm darkness or evening light.
- **Consumers.** `World`, `LakeRegion`, `RoofRegion`, `NainRegion`, `StormRegion` and the new title view all consume the same builder. Adding a lighting or grading feature therefore becomes one change.

**Lighting.**

- A sky/ground hemispheric fill plus a directional sun whose color, elevation and azimuth come from the profile.
- Each chapter gets an identifiable time and mood:
  - Capernaum: clear morning;
  - the lanes: soft late morning;
  - the road and Nain: warm afternoon;
  - the lake crossing and cove: bright haze;
  - the storm: blue-grey evening that clears to calm;
  - interiors: warm bounce with a cool doorway key.
- The HUD's time-of-day line reads from the same profile rather than a fixed string.

**Materials.**

- One matte material convention applies to GLB and procedural geometry alike. Imported glTF materials are converted at load time to the shared vertex-color matte material, so both follow the same lighting and color-space path.
- There are no glossy or metallic surfaces. Water and sky remain custom shaders that apply the same fog and grading.

**Color pipeline.** RFC-010 declined "a heavy postprocessing stack." This RFC deliberately revises that decision in a restrained, budgeted form:

- **High:**
  - filmic tone mapping with per-profile exposure and contrast;
  - a subtle warm/cool grade and a mild vignette;
  - a low-strength bloom that affects only the sun disc, water glints and bright highlights;
  - FXAA.
- **Low:** the same tone mapping, exposure, contrast and grade, applied inside the material shaders. It adds no extra full-screen passes.
- **Excluded:** screen-space ambient occlusion, depth of field, motion blur, lens flares, chromatic aberration and film grain. Ambient occlusion is baked into model vertex colors instead.
- **Reduced motion** keeps the grade and disables animated sky and cloud motion.

**Sky and horizon.**

- A procedural gradient sky dome with a soft sun disc, a slowly drifting low-poly cloud layer and profile-driven horizon haze.
- Layered distant hill silhouettes replace the icosphere hills, and height fog blends them into the sky color.
- Water and sky receive fog, so the lake no longer ends in a hard edge.

**Shadows.**

- High uses a sharper sun shadow fitted around the camera's focus rather than the whole 100–180 m region, retaining soft filtering.
- Static shadow maps refresh only when needed where that is safe.
- Low gains inexpensive soft contact shadows under people, boats and carried objects, which currently have none.
- Shadow changes never alter collision or picking.

## 2. Living atmosphere

Motion is cosmetic, deterministic, owned by the scene and bounded by region disposal. It pauses with menus and hidden pages, freezes under reduced motion and scales down at Low.

- **Wind.**
  - Olive, palm and cypress canopies, reeds, grasses, awnings and hanging cloth sway through a shared vertex-shader wind field, weighted by height and a baked sway mask.
  - Strength comes from the profile and rises in the storm.
  - Wind never moves collision footprints or navigation.
- **Ground cover.** Deterministic scattered grass tufts, shrubs, flowers and pebbles outside walkable paths, doorways and work footprints. They are merged by asset, unpickable and never in the walk grid.
- **Particles.** A small shared, pooled particle service with procedurally generated sprite textures, created at runtime with no downloaded images:
  - oven and hearth smoke;
  - dust motes in interior light;
  - footstep dust on paths;
  - splashes and a boat wake while rowing;
  - net drips;
  - rain, spray and blown foam in the storm, with restrained lightning illumination that respects reduced motion and is never a rapid flash;
  - pollen and insects in the fields.

  Each emitter has a hard particle cap per quality level.

- **Animals.**
  - Gulls wheel over the lake and shore, and small birds rise from olive trees.
  - They are procedural low-poly flocks with wing-flap vertex animation, merged into one draw per flock.
  - They are unpickable and never block labels or approaches.
- **Water.** One improved shader for every water body:
  - lit and fogged, with a view-angle sky tint and sun glints;
  - distance-to-shore foam and shallow color from a shore distance function, replacing the single x-threshold;
  - ripples around boats and wading actors;
  - storm swells whose phase matches the boat's cosmetic bob.

  Reduced motion keeps a deliberate still composition. The existing navigable planes, saved boat positions and hull-floor clearance contracts are unchanged.

## 3. Characters and motion

**Characters (Blender).** Rebuild the fifteen actors through a shared, parameterized character recipe.

- **Body:**
  - low-poly mitten hands and shaped feet;
  - a smoother head with a defined jaw, brow and nose;
  - faceted hair, beard and head-cover meshes;
  - a 12–16-sided robe with hem, belt and sleeve silhouettes;
  - garment crease and edge shading baked into vertex colors, plus ambient occlusion.
- **Individual build.** Each actor gets its own shoulder width, girth, head shape, posture, age and clothing silhouette.
- **Height** varies only within the band that preserves verified seating, rowing, rails, carrying and cushion contacts.
- **Skeleton.** The twelve-bone skeleton, joint names, the `carry_socket`, clip names and the Nain-specific clips are retained, so every contact test continues to measure real posed geometry. Hands are rigid to their forearm joint.
- **Portraits** are re-rendered from the new models at a larger head-and-shoulders framing with a painted backdrop vignette, within the existing 384 KiB total.

**Animation.** Re-author every clip with fuller key poses:

- **Walk:** vertical bob, hip sway, counter-rotating shoulders, heel contact and arm follow-through.
- **Carry:** a heavier cadence.
- **Idle:** breathing and weight shifts.
- **Greet, Listen, Respond and Gesture:** clearer silhouettes.
- **Work clips** anticipate and settle.

Seated, rowing, reclining, procession and held-object contacts must continue to pass the imported-geometry tests.

**Runtime motion.**

- **Paths.** Smooth path following with string-pulling over the existing walk grid, bounded by its line-of-sight rules. The traveler therefore walks diagonally instead of zig-zagging between cell centers.
- **Speed.** Short acceleration and deceleration. Arrival and reach checks remain authoritative; smoothing never cuts a corner the grid forbids.
- **Blending.** Every actor crossfades between clips; hard pose cuts remain only where a Gospel tableau requires an exact still.
- **Turning.** All NPC turns are smoothed through the existing short-arc helper.
- **Look-at.** A bounded head look-at lets nearby people glance toward the traveler and speakers toward listeners. It applies after clip sampling to the head joint only and is disabled under reduced motion.
- **Footsteps** follow the walk cycle's contact phase rather than a fixed distance.

**Camera.**

- Replace the instant scale snaps for obstructing trees and camera-facing walls with dithered fades that preserve silhouettes and never change collision.
- The conversation camera restores smoothly rather than snapping back.
- The exploration follow uses the previously unused `targetOffset` and softened region clamps.
- Rotation buttons ease.

## 4. Shots: the reusable core of cinematic staging

Add a small **shot system** in `src/scene/presentation/shots.ts`:

- A shot is a framed subject, orbit angles and extent, plus an optional slow drift or dolly, easing and a bounded duration.
- A `ShotDirector` interpolates between the current and next framed pose, including the reading-panel clearance from `frameSubject`.
- It applies a very gentle breathing drift while a scene is open, and an optional restrained shake used only by the storm.

**Scope for this milestone.**

- **Applied to all four presenters.** The lake keeps its existing eased transitions through the shared director. The roof, Nain and storm accounts replace their hard checkpoint cuts with eased 1.5–3 s moves.
- **Continue** remains available immediately. Selecting it during a move retargets the shot from its current pose; it never queues.
- **Restored checkpoints** establish their final composition instantly.
- **Reduced motion** uses immediate compositions with no drift or shake.
- **Replay** uses the same shots.

Full bespoke re-authoring of the roof, Nain and storm tableaux is not included. Shot content should nevertheless make each composition clearly legible at desktop, portrait and short-landscape sizes.

## 5. First impressions and interface

**Title and opening.**

- **Title view.** Behind the welcome surface, a procedural title view opens at dawn over the lake: sky, water, shoreline silhouettes, a small drifting boat silhouette and birds. It uses no GLBs and appears after storage and engine initialization.
- **Logo.** A crafted SVG logo lockup replaces the Unicode glyph mark.
- **Cold open.** A new game can play a short, skippable cold open: three to four illustrated title cards of original narration over the title view, then an establishing camera move into Capernaum.
  - It is shown once per browser by default, can be replayed from Settings and is skipped by Continue and Import.
  - Its text is original connective narration, clearly identified, with no quotation attributed to Jesus.
  - Skip, Escape and Enter all work, keyboard focus is managed, and reduced motion presents static cards.
- **Chapter cards.** An elegant full-width title card with chapter number, title and scripture reference appears when a Gospel chapter or optional interlude begins, and briefly when entering a region for the first time in a session. Cards are nonmodal, never block input for longer than their fade, and are announced to assistive technology.
- **Transitions.** Region changes fade through a scene-tinted veil to an illustrated loading surface that shows the destination name and a line of place description, then fade into the arrival.
  - Load failure fades back to the prior region, preserving the existing transactional behavior and messages.
  - Reduced motion uses a brief crossfade or none.

**Interface art direction.** Keep the existing layout contracts and semantics while restyling them into a coherent game interface:

- **Typography.** Bundled open-license web fonts: a humanist serif for display and reading, and a legible sans for controls. They are installed as pinned npm packages, self-hosted in the build and recorded in `CREDITS.md`. There are no runtime font requests.
- **Surfaces.**
  - Layered parchment and deep-olive panels with ornamented corners and rules.
  - A refined icon set covering tools, items, people, places and camera controls, replacing Unicode glyph buttons.
  - Custom-styled selects, checkboxes and ranges that keep the native elements and their test hooks.
- **Motion.**
  - Panels open and close with short eased transitions.
  - Dialogue and scripture text reveal gently, or appear immediately under reduced motion or when a skip key is pressed.
  - The objective card animates its expansion.
  - Toasts become "journal ribbons" that slide in with an icon for their kind.
- **HUD hierarchy.**
  - People's labels become compact markers that expand to a name when nearby, hovered, focused, tracked or selected. Full guidance keeps every destination reachable through labels, the map and the destination list.
  - The traveler card shows the current chapter's journey line instead of a fixed phrase.
  - Control hints fade after the player has moved and interacted, and reappear from Help.
- **Gospel reading surface.** It gains a composed scripture presentation with a chapter ornament and a clearer separation between WEB scripture and original narration. Every provenance label, the transcript and all controls remain available.

Standard and large text sizes, keyboard order, focus trapping and the phone layouts remain supported and are re-verified.

## 6. Blender MCP workflow and asset delivery

The Blender Lab MCP connector is connected to Blender 5.2.1 LTS through the Blender Lab **MCP** add-on on port 9876.

**Connection finding.** A different third-party add-on ("MCP for Blender", BlenderMCP 1.6) had been serving that port with an incompatible protocol, which made every MCP call time out. The owner replaced it with the Blender Lab add-on before production.

**Recipes.**

- Factor the duplicated helpers (`box`, `cone`, `ico`, `beam`, palette, `person()` and export settings) into a shared importable module, instead of parsing `generate_kit.py` source at runtime.
- New and revised recipes live under `tools/blender/` and remain executable both through MCP and headless through `npm run assets:build`.
- MCP work runs in an isolated `rfc011-workshop` scene that preserves the user's open scene and objects. Anything explored interactively is captured back into seeded recipe code.

**Environment kit v2.**

- **Every prop:** baked ambient occlusion and a subtle top-light gradient in `COLOR_0`, plus a baked wind sway mask channel where needed.
- **Vegetation:**
  - gnarled olive trunks with jittered canopies;
  - bent, segmented palm fronds;
  - noise-displaced cypress;
  - new grass tuft, shrub, flower clump and pebble scatter pieces.
- **Architecture:** chipped stone courses, lintels and door frames, grime at wall bases, and irregular silhouettes, with door openings and footprints unchanged.
- **Scenery:** rock outcrops and shoreline stones.

**Byte recovery.** Richer models must fit within the existing **7.5 MiB** catalog cap without raising it.

- `pack_palette.py`/`compact_glb.py` gain lossless-for-purpose compaction:
  - `KHR_mesh_quantization` for positions and normals, with dequantization folded into node or inverse-bind transforms so skinned and static geometry render identically;
  - pruning of constant animation channels.
- Babylon's loader supports the extension natively, so no decoder is shipped.
- Animation outputs stay float so existing imported-geometry tests read real values.

**Review.** Independently import final exports into a separate review scene. Inspect silhouettes, colors, rig motion, hands, feet, supports and orientation, and compare them with Babylon renders. A Blender render alone does not establish runtime correctness.

**Evidence.** Keep the existing policy: full captures in ignored directories, and a small declared permanent gallery with hashes.

## 7. Code foundation

To make the above one change instead of five:

- **Stage environment and shared material factory.** Replace the per-region copies of scene, light, shadow, fog and `material()` setup.
- **Activity registry in `World`.** Each optional activity controller implements `settings`, `update`, `tick` and `dispose`, and is registered once. This removes the hand-maintained parallel lists and fixes the currently undisposed road, life, connection, Galilee and harbor controllers.
- **Split `main.ts`.** Its `handleAction` switch (about 585 lines) is divided into per-domain handler modules, and event notices move into a data table. Serialized action semantics are unchanged.
- **Production per-frame overhead.** Per-mesh diagnostic render callbacks and per-frame JSON data attributes run only where tests or diagnostics require them.

## 8. Performance and loading budgets

- **Draw calls:** keep the **300 High / 130 Low** reference ceilings.
- **Downloads:**
  - the **7.5 MiB** GLB cap, the **384 KiB** portrait cap and the **768 KiB** per-region increase over the RFC-010 baseline;
  - at most four concurrent model requests;
  - one settled scene.
- **Visual additions.** New sky, horizon, ground cover, particles and birds are merged, pooled or instanced so reference compositions stay inside those ceilings. Measured before/after draw calls are recorded for every reference region.
- **Post-processing** exists only at High. Low adds no full-screen pass.
- **Fonts** add no more than **400 KiB** of WOFF2 to the build, using only the needed weights and a Latin subset.
- **Bundle growth** of the engine chunk from newly imported Babylon modules is recorded.
- **Targets:** 60 FPS on a representative laptop at High and 30 FPS on a representative midrange phone at Low. Automated SwiftShader and desktop-emulation runs do not establish physical-device performance.

## Acceptance and verification

1. **Visual review.** Review every exploration region and every Gospel scene group before and after, at the same camera positions and qualities. Show the profile lighting, sky and horizon, water, wind, particles, birds, ground cover and contact shadows. Review desktop, portrait phone and short landscape.
2. **Title and opening.** The title view, cold open, chapter cards and region transitions work with pointer, keyboard and touch, respect reduced motion and never block Continue, saving or recovery.
   - A failed region load still restores the prior scene.
   - Welcome requests no GLBs.
   - Continue and Import skip the cold open.
3. **Characters.** All fifteen are visibly distinct at play distance, with hands and feet. Every existing imported-geometry contact passes on the rebuilt exports. New tests measure clip distinctness (walk bob, idle breathing) from real exported data.
4. **Motion.** Smoothed paths never cross blocked cells or corners forbidden by the grid, and arrival/reach semantics are unchanged. Look-at and fades are deterministic, bounded and cleaned up on disposal.
5. **Shots.** All four presenters restore exact final compositions on load and replay. Continue during a move retargets correctly, and reduced motion is immediate.
6. **Interface.** Keyboard order, focus trapping, accessible names, standard/large text and phone layouts are verified. Fonts and icons load from the build with no network requests beyond the app's own origin.
7. **Automated checks.** Evidence, types, lint, formatting, unit tests and the production build pass. Then run:
   - the complete Chromium desktop/phone matrix;
   - the uninterrupted four-chapter journey;
   - Firefox/WebKit compatibility;
   - the new presentation journeys.

   Changed image baselines are reviewed before acceptance, then rerun without updates, and the missing-geometry negative controls must still fail. Failures and reruns are recorded accurately.

8. **Budgets.** Measure catalog, portrait, font and regional bytes, draw calls at High/Low in every reference region, and representative render cadence.
9. **Human review.** Document the remaining playtest, device and accessibility checks. Record human, device and editorial results only when actually performed.

## Implementation sequence

1. Draft this RFC. Capture baseline inventories, draw calls and reference screenshots.
2. Build the foundation: stage environment and profiles, the material convention, the activity registry, the `main.ts` split, and removal of production overhead.
3. Rendering and atmosphere: color pipeline, sky and horizon, shadows, water v2, wind, particles, birds, ground cover.
4. Blender MCP asset pass:
   - shared recipe module and byte recovery;
   - environment kit v2 and baked shading;
   - characters and animation;
   - portraits;
   - independent import review.
5. Runtime motion and camera: path smoothing, crossfades, look-at, dithered fades, eased restores; then the shot director across all four presenters.
6. First impressions and interface: fonts, art direction, title view, cold open, chapter cards, transitions, HUD hierarchy.
7. Re-baseline, measure, optimize, complete the regression and compatibility runs, and document actual results and outstanding external reviews.

## Non-goals

This milestone excludes:

- a fifth Gospel chapter, a new optional story or new regions;
- combat, economy, crafting, scores or traveler progression systems;
- a general day/night cycle or NPC schedules. Profiles are fixed per region and checkpoint.
- voice acting or narrated audio;
- unrestricted sailing;
- offline caching;
- a content editor;
- an engine rewrite or WebGPU migration;
- a save-format change;
- full bespoke re-staging of Chapters II–IV beyond the shot system and legibility.

Downloaded or third-party models, textures and sound remain excluded. The only new third-party runtime assets are open-license fonts, which must be recorded with their licenses.

## Delivery notes · 2026-09-25

All four strands are implemented. A shared stage environment with per-place profiles drives every region, Gospel account and the title: sky and horizon, fog, tone mapping and grading, fixed-frustum shadows with contact shadows, lit water, wind, particles, birds, ground cover, painted ground and backdrop hills. Blender MCP rebuilt all 98 models through reproducible recipes, including fifteen individually built people with fuller clips, new vegetation and ground cover, and a refined gate and boat; an independent Blender import reviewed the rebuilt people from their exported files. Smoothed routes, glances, dissolving occluders, eased returns and a shot director in all four presenters carry the motion work. The title view, cold open, veil, title cards, bundled fonts and restyled interface form the new first impression. Save v11, all four chapters and the authored accounts are unchanged.

The catalog totals **5,546,300 bytes**, down 1,160,512 bytes; portraits total **102,168 bytes**; the largest regional growth is **224,088 bytes**; fonts add **196,448 bytes** of WOFF2. The maximum reference draw calls are **152 High / 83 Low**. No draw-call, download, concurrency or evidence limit was raised. A software-renderer check led to one late optimization: backdrop geometry hidden under each region's ground is no longer generated.

Acceptance passed **607 unit checks**, the complete Chromium matrix on the final commit (**159 passed, eleven intentional skips, zero failures; 57.5 minutes**) and four Firefox/WebKit compatibility checks. Types, lint, build, formatting and evidence validation pass. Full runs exposed four defects, which were fixed and then rerun: a short-landscape phone overflow, a work-panel focus restore that could take focus back, a stale Nain image baseline, and one frame of shadow-shader mismatch when loading at Low. The [review guide](../verification/rfc011/README.md) links the selected images and records. Human pacing and editorial review of the new narration, assistive-technology and touch review, and sustained physical-device performance remain outstanding; automation does not establish them.
