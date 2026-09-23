# RFC-009: Capernaum, Fully Realized

Status: implemented and locally verified, 2026-09-21. Written before gameplay or asset changes.

Authorization: the owner requested the recommended improvements, beginning with this RFC and continuing through implementation and verification. This authorizes the work below; publication and remote repository changes are separate actions.

## Purpose and baseline

Make the opening village a more convincing place to explore, with readable working spaces, visible everyday activity and an optional spatial adventure. The primary art scope is the Capernaum shore, residential lanes, gathering house and bakehouse. Shared actor and interaction improvements also serve existing regions. Preserve the quiet low-poly style, ordinary traveler, authored narrative and independent Gospel accounts.

The baseline is `fb39e3b`: four Gospel chapters, ten optional adventures, ten exploration regions, all 31 Gospel replay scenes and save v10. Types, lint, formatting and production build passed during analysis. The initial unit run passed 495/497 tests; two five-second timeouts passed in the isolated 38-test selection. The attempted continuous browser rerun did not execute and establishes no new browser acceptance. Human pacing, physical-device performance, assistive technology and editorial review remain unverified.

The planning allowance is 15–25K changed authored lines, not an acceptance quota. Reuse existing contracts where they meet the goals. No fifth chapter, economy, combat, runtime-generated narrative, free sailing, offline cache or unrestricted day/night simulation is included.

## 1. A recognizable working village

Refine all four Capernaum exploration spaces with an original modular kit: stone thresholds and wall footings, doorway shade, net-working furniture, a waterfront bollard, bread-working details and planted courtyard accents. Use clustered details and distinct silhouettes to identify the fishing shore, homes, shared courtyard and bakehouse. Ground/path surface variation should soften the broad uniform planes while retaining clear routes. Keep the original palette, matte vertex colors and restrained geometry.

Existing doors, encounters and story destinations remain reachable. New decorative meshes are not pick targets or invisible obstacles. Substantial furniture uses explicit footprints checked against imported bounds. Roof/wall/foliage cutaways and the player's visibility remain functional at all camera angles. The village is the first visual acceptance case; extend its reviewed approach to lanes and interiors before final verification. Later regions retain their authored layouts.

## 2. Ordinary activity and physical presence

Add a reusable, scene-owned activity coordinator with bounded authored stations and short reachable routes. Show net work at the shore, water tending in the lanes, bread work in the bakehouse and quiet company at completed gathering/resting places. Activities derive from real story state; they must not invent completed work, relocate Amos/Neri, duplicate departed Gospel figures or move essential quest targets out of reach.

Simulation time owns motion. Menus, hidden pages and inactive/loading scenes pause it; reduced motion gives useful still compositions. Low graphics keeps essential props and people while reducing optional background activity. Region disposal releases all activity resources. Cosmetic schedules are not persisted and never grant progress.

Refine facing and nearby acknowledgement, transitions into ordinary work, hand/tool alignment and support for working/seated poses. Use the shared rig and current clips unless a measured need justifies a narrowly scoped addition. Practical actions commit through reducers immediately; animation never delays or grants progress.

## 3. Original adventure: A clear way to the water

An original dock worker, Eliab, invites the traveler to reopen a small working landing on the original shore. The story is available early and remains available after every chapter. It does not gate or affect any Gospel event. All speech, observations and reflections are labeled original fiction.

The landing is a bounded physical arrangement puzzle. A readable three-by-three plan corresponds to the world geometry. Water occupies the center strip; a crossing can use the north or south side. One movable plank can rest on its rack or bridge either side, and its orientation matters. Two cargo stacks can occupy their respective approaches or be moved into marked storage bays. A loose rope must be cleared. Observe water marks and the intended passage in either order, then rearrange and test the route.

The solver searches the actual arrangement from the western entrance to the eastern landing, rejecting wet cells, misplaced/incorrectly oriented planks, uncleared rope and occupied approaches. Both north and south solutions are equal. A test shows the traversable path or a specific blocker in words and in the world. Failed tests consume nothing. Every move invalidates a previous test; expected prior values protect against duplicate/stale commands. Moving requires proximity and free hands; carried objects retain their existing return guidance.

Use the RFC-008 focused work surface and accessible target lists, with full inspection and graduated hints. The player can experiment, restore materials, leave, save, return and choose either solution before completion. A successful test unlocks two equal reflections, patience or making room. Completion locks the accepted arrangement and leaves visible ordinary work at the reopened landing. Its memory appears in the journal and later original acknowledgements only when earned.

The arrangement is physically represented but does not become a required gateway or obstruct existing shore routes. Its footprint must not strand old saves or companions. The readable plan supports completing the story without relying on color or spatial vision. A human playtest will evaluate duration; no reading-time claim is inferred from automated checks.

## 4. Focused integration and persistence

Add the story through typed harbor state/events, pure solver/transitions, authored content, objectives, journal, work targets, map destinations and explicit visuals. Extract reusable activity orchestration and event feedback from the central controllers as needed; do not replace the existing engine or rewrite all chapters.

Save envelope v11 adds the bounded harbor record. All v1–v10 saves migrate to an unstarted adventure without changing prior earned state, memories, supplies, companions, route, boat or replay cursor. Validate known IDs, unique observations, legal arrangements, tested-route consistency, completion prerequisites and exact derived journal entries. Reject forged or future saves. Fixtures must include interrupted work, both completed arrangements and legacy journeys. Temporary camera/selection state remains outside progress.

## 5. Blender MCP and measured budgets

Use the connected Blender MCP addon (preflight confirms protocol 5, addon 1.6, Blender 5.2.1 LTS) in an isolated workshop, preserving unrelated scenes. Deliver reproducible recipes, workshop `.blend` and original GLBs together. No external models or generated services are required. Independently import final shipped GLBs for kit/arrangement review, and inspect actual Babylon compositions and posed geometry for handedness, contact, footing and collision.

The baseline 85 GLBs total 5,161,668 bytes, only 81,212 bytes below the historical 5 MiB cap. This RFC allows a maximum total catalog of **5.5 MiB**, providing at most 605,500 additional bytes for the bounded original kit. Each Capernaum region may add at most **192 KiB** of model downloads over its measured baseline; unrelated region inventories and historical exports remain unchanged unless a documented shared refinement is necessary. Record actual before/after bytes and counts. Prefer reuse and compact exports; the allowance is not a target.

Retain 5,000/10,000 actor/prop triangle caps, explicit region inventories, four concurrent asset requests, one settled scene and reference limits of **300 High / 130 Low draw calls**. Batch compatible static scenery and measure actor overhead. Preserve the clone-based loader's Low-quality rendering correction; any instancing change must pass missing-geometry negative controls. Keep the existing startup/deferred-region behavior and record representative load/render costs without claiming physical-device performance.

## Acceptance

1. All four Capernaum spaces receive a coherent, visually reviewed improvement. Old destinations, gateways, carried-item returns and both companion routes remain reachable. Existing essential scenery survives High/Low changes and reduced motion.
2. Ordinary activities show work appropriate to actual progress, pause correctly, preserve quest targets/companions and release their resources. Reduced motion and Low graphics retain meaningful still activity.
3. Complete the new adventure by both routes, in different observation/action orders, with a failed test, wrong orientation, occupied approach, hints and recoverable arrangements. Verify visible geometry matches the solver and both reflections reconstruct after loading.
4. Nearby world selection, map/target-list navigation and keyboard work controls perform equivalent guarded actions. Full inspection/return, walking away, menus, replay, region changes and interrupted saves preserve durable progress. Phone portrait, short landscape and large text remain usable.
5. Every historical save fixture preserves earlier state while gaining empty harbor progress. Interrupted/completed v11 fixtures round-trip. Reject stale/remote actions and invalid saves; completed arrangements cannot be reset accidentally.
6. Preserve all four chapters, 31 replay scenes, homecoming, optional stories, carried supplies, boat and companions. Run the existing continuous fresh-save journey and complete browser regression, plus new desktop/phone scenarios and Firefox/WebKit smoke.
7. Types, lint, formatting, meaningful unit/solver/geometry tests and production build pass. Record actual test failures and reruns rather than combining selections into a claimed clean full run.
8. Verify asset, regional download and draw-call budgets. Save before/after browser compositions, Blender MCP review evidence and portable example saves with a practical playtest guide. Human/device/editorial limitations remain explicit.

## Implementation order

1. Write this RFC; capture regional asset baselines and establish pure harbor state, solver, reducers and v11 migration.
2. Integrate the adventure into the existing journal, map, work, action and save contracts.
3. Build the bounded Blender kit through MCP; finish and inspect the shore first, then lanes and interiors.
4. Add shared village activity and physical feedback, with measured static batching and interruption guarantees.
5. Run unit, geometry, browser and compatibility checks; correct failures and review real compositions. Update README, architecture, narrative, assets, roadmap, playtest and verification documentation with actual delivery evidence.

## Implementation record · 2026-09-21

The delivered scope uses the existing navigation, focused-work, journal, chapter and shared-rig contracts. The authored change is consequently smaller than the planning allowance.

- **Village:** nine original props, facade shade, thresholds/footings, worn ground, a separate bread-working table and bounded ordinary activity across all four spaces. Repeated opaque scenery is batched by asset; actors, cargo and cutaway structures remain independent.
- **Adventure:** Eliab, two observations, a three-by-three connectivity puzzle, north/south solutions, specific failed-test feedback, graduated hints and two equal reflections. One coordinate contract powers the world, readable plan and solver. Earned route/reflection details appear in the journal and later return dialogue.
- **Continuity:** save v11, strict arrangement validation, unchanged earlier story state, four portable examples and complete historical fixture migration. Cosmetic activity is never persisted or used to grant progress.
- **Physical and interface corrections:** imported actor facing, supported working/seated poses, upward-facing ground patches, outward-projecting awnings and preservation of focus selected before a dialog's deferred initial-focus callback.
- **Assets:** 94 GLBs totaling 5,390,092 bytes; the nine additions total 228,424 bytes. All 85 historical exports are unchanged. Every village region adds less than 192 KiB; other exploration inventories are unchanged. Blender MCP generated the workshop and independently reviewed final imports and actual Babylon-posed geometry.

Final acceptance: types, lint, 538 unit checks, formatting and production build pass. The uninterrupted Chromium desktop/phone matrix passes 149 tests with eleven intentional skips and no failures in 44.4 minutes. Firefox/WebKit passes four checks. All four chapters, the continuous fresh-save journey, 31 replay scenes, existing optional work, new landing routes and rendering contracts are covered by that run.

The [verification record](../VERIFICATION.md#capernaum-fully-realized--2026-09-21), [delivery evidence](../verification/rfc009/README.md), [case-level results and hashes](../verification/rfc009/delivery.json) and [playtest guide](../PLAYTEST.md#capernaum-fully-realized) document the actual checks, corrections, compositions and remaining human/device/editorial review. The existing engine-bundle advisory remains; publication was outside this milestone.
