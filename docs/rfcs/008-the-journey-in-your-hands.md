# RFC-008: The Journey in Your Hands

Status: implemented and verified, 2026-09-13. Accepted and written before implementation.

Authorization: the owner requested the recommended exploration and interaction improvements, beginning with an RFC and followed by implementation end to end. This document fixes that scope before gameplay or asset changes. Commit, push, merge and deployment remain separate actions.

## Purpose and baseline

Make the existing four Gospel chapters, ten optional adventures and connected world easier to discover, understand and use. The planning allowance is 12–22K changed authored lines, with completion determined by playable outcomes rather than a line quota. Retain the quiet low-poly aesthetic, authored scripture and dialogue, ordinary traveler, optional guidance and reversible practical work.

The reviewed baseline at `eff2795` passes types, lint, formatting, build and all 430 unit tests. The fresh-save Chromium journey through all four chapters and 31 Gospel scenes passed. This was not a new full browser regression. Human pacing, editorial review, assistive technology and sustained physical-device performance remain unestablished.

The existing route planner, recap, replay library, homecoming, practical tray, channel solver, arrangement rules and transactional runtime are foundations for this milestone. No new chapter, region, economy, NPC scheduling, unrestricted sailing or offline cache is included.

## 1. A useful journal opening and compact objectives

The journal opens with a journey overview: the tracked unfinished story and its actual next destination, unfinished and available opportunities in the current region, work elsewhere, held-object return guidance and an earned closing interlude. A new traveler sees Into the Deep and Ezra's local invitation before unavailable later content. Completed work never appears as unfinished. Dynamic companions and multi-region objectives use authoritative saved locations and the existing route planner.

The complete Stories, People, Places and Memories views, status/story filters, all transcripts, recap and replay library remain deliberately accessible. Direct story shortcuts open that story regardless of a previously selected status. Explicit category/filter choices are retained during the session; opening the overview is always possible. Overview selection grants no progress and does not change story tracking until requested.

The exploration objective is compact by default at desktop and phone sizes. An accessible expand/collapse control reveals steps and provenance without losing the next-stop action. Expansion survives ordinary state refreshes within the session. Completed objectives offer useful next choices. Layouts support large text, portrait and short landscape screens without hiding essential controls or covering the selected work.

## 2. Work while seeing the world

Add a focused practical interaction surface with the target's name, current physical state, available actions, specific blockers, feedback and access to the complete inspection/plan. It occupies a bounded part of the viewport and leaves the target and traveler visible. Reading panels remain available for narrative, evidence, full plans and graduated hints. Returning from reading restores the work selection when it is still available and nearby.

Use one typed interaction description for target identity, actions, reach, motion, feedback and world focus. Extend the existing practical contract instead of duplicating progression rules. All actions continue through the pure reducer and serialized action queue. The reading panel, nearby tray and work surface have equivalent requirements. Repeated or stale commands remain harmless; animation never grants progress or delays saving.

Focus is temporary presentation state, not campaign progress. Movement, another target, menus, Gospel reading, replay, load/import, a region change or a vanished target clears or suspends it predictably. A previous temporary camera is restored when focus ends. Work controls never act remotely. Leaving work retains supplies, tested water, placement and completed choices exactly as the current save format defines them.

## 3. Two complete practical acceptance cases

### A spring for travelers

Keep the existing inspection, clearing, scoop, four channel sections, two valid basin routes, memories and graduated hints. Select individual sections through the world or a keyboard-accessible target list, approach them through ordinary navigation, rotate with free hands and see the physical openings change. Compact orientation text describes the same ports as the solver. A test at the source shows the actual wet path, identifies the stopping section or receiving basin, and records only the existing test result.

The full readable plan and optional hints remain available without requiring spatial vision. An unsuccessful test consumes nothing. Any valid north or south route works. Interrupted work, a carried scoop, orientation, hints and completion restore through existing saves. A completed spring stays readable and cannot be inadvertently reset.

### Room under the olives

Keep both sites, supply orders, the one-item carrying slot, recoverable mat/water/screen, approach constraint and equal memories. Work at the selected site shows the actual supply sockets, screen orientation and southern approach. A clearly differentiated preview can show a proposed screen position before committing it; preview is temporary and never changes saves, collision or companions. Commit uses the same guarded rotation/placement events as the readable controls.

Show occupied or obstructed approaches in both shape and words; do not rely on color alone. Players can inspect, correct, check, leave and recover supplies without a hidden modal result. Completed arrangements and visitors reconstruct faithfully. Full site descriptions and readable plans remain available.

## 4. Readable targets, cameras and input

Provide a consistent selected-target treatment, visible reach/placement cues and an explicit focus/return control. Frame spring work, farm arrangements and representative shore/landing practical actions using authored bounds and the actual available viewport. Preserve manual orbit/zoom, reduced-motion behavior, existing interior/foliage cutaways and ordinary boat state. Frame changes are cosmetic and must not change saved positions.

Resolve click/tap selection and camera gestures deliberately. A camera drag or two-pointer gesture must not produce a walk or interaction on release. Ground movement, model selection, HTML labels, E and destination lists feed consistent travel intent. A manually selected ground destination cancels current movement but leaves the saved final destination resumable, as already promised. Named selection retains that final destination until actual arrival. Dense target lists remain usable even when projected labels are hidden.

Keyboard navigation, focus restoration, meaningful announcements, visible focus and adequate touch controls are required on all new surfaces. Modal reading traps focus correctly, including disclosures and import controls; focused work exposes its nonmodal status. Document physical screen-reader/touch review separately from DOM automation.

## 5. Focused architecture and persistence

Extract reusable journey suggestions, practical interaction descriptions, work-surface rendering, focus management and camera/selection presentation into focused modules. Keep one engine/render loop, region-owned Babylon resources, transactional replacement, four concurrent model requests and simulation-owned movement.

Campaign save v10 and all v1–v9 migrations remain intact: this milestone primarily changes presentation and controls. Temporary selection, camera focus, previews and journal/HUD expansion are not serialized as earned progress. If implementation exposes a genuine need for a new durable field, amend this RFC first and add an explicit migration; never silently drop existing fields or invent earned memories. Settings remain separate from progress.

Use measured costs to guide changes to label/layout work and repeated view computations. Preserve essential scenery and the existing negative rendering tests. Broader browser smoke tests should cover actual WebGL startup, keyboard movement, menus, saved continuation and a focused practical action in Firefox/WebKit where available; report unsupported local environments accurately.

## 6. Blender MCP and visual contracts

Use the connected Blender MCP addon in an isolated workshop while preserving unrelated scenes. Refine the existing channel-end/inlet silhouettes and reed-screen orientation cues where they improve understanding. Review working, carrying and seated poses, the landing approach and target silhouettes. Reuse the original palette, meter scale, twelve-bone rig and sixteen shared clips. Do not add external assets or generated services.

Deliver changed recipes, workshop `.blend` and derived GLBs together. Independently inspect shipped exports in Blender and actual Babylon compositions. Check port direction, contact, footing, collision bounds, selected-object readability, screen preview versus committed geometry, High/Low graphics, reduced motion and desktop/phone framing. Screenshots and numeric geometry checks complement each other.

The baseline 85 GLBs total 5,152,636 bytes, leaving 90,244 bytes under the 5,242,880-byte cap. Retain that total cap, 5,000/10,000 actor/prop triangle caps, explicit per-region inventories and reference 300 High / 130 Low draw-call limits. Prefer refinements and reuse. Any budget revision must first be justified in this RFC by measurements.

## Acceptance and evidence

1. A fresh journal prioritizes available local play; incomplete, completed, carrying, companion, replay and homecoming states produce accurate suggestions. Every story, transcript, memory and prior status filter remains accessible.
2. Compact/expanded objectives retain their state and actual next action on desktop, phone and large text. No new surface causes page-width overflow; essential controls remain reachable in short landscape viewports.
3. Complete the spring through both basin routes using the focused controls, including a failed test, all hints, reading/return, interruption and reload. Confirm actual solver ports and wet meshes match the visible result. Existing completed saves remain completed.
4. Complete both resting sites in alternate supply orders. Preview without mutation, reject blocked/stale/remote actions, correct the approach, recover supplies, cross regions with an item, return and finish. Check actual screen geometry, collision and preserved companion states.
5. Perform representative shore, neighborhood, farm and lake actions through the new/shared surface and existing alternatives. Preserve Gospel progress, deliberate boarding/docking, saved routes, exact replay return and item recovery.
6. Test camera framing/restoration, selected targets, keyboard and pointer selection, drag-versus-tap behavior, cancellation, pause/blur, reduced motion, modal/nonmodal focus and meaningful announcements.
7. All historical saves and fixtures validate without changed earned state. Failed scene/asset loads retain the previous durable journey and retry behavior. Temporary previews and focus never appear in portable saves.
8. Types, lint, formatting, meaningful unit/geometry tests, build and the complete existing browser regression pass. Add focused new journeys and run the continuous fresh-save four-chapter journey. Add isolated Firefox/WebKit smoke coverage and record actual results, failures and limitations.
9. Preserve asset/download/draw-call budgets, one settled scene and essential-object visibility. Record actual Blender MCP and browser review evidence. Provide portable review fixtures for the new interaction views using existing game state and a practical human/device playtest guide.

## Implementation order

1. Write this RFC, then build pure suggestion/interaction contracts and meaningful tests.
2. Integrate journal overview, compact objectives, shared focus handling and world work controls.
3. Integrate camera/selection presentation, spring work and resting-place previews with interruption guarantees.
4. Refine and inspect the bounded Blender assets through MCP and verify actual runtime geometry.
5. Add focused and cross-browser journeys, run the complete regression, fix failures and update README, architecture, assets, playtest and verification documentation with actual evidence.

## Delivery

The overview, compact objective, physical work contract, nonmodal controls, camera reservation/restoration, temporary screen proposals, input ownership and focus behavior are implemented. Spring and shelter retain their existing reducers and all alternate outcomes. Ordinary shore, neighborhood and lake-landing work can use the same surface. Failed boarding restores its prior controls for a deliberate retry; moving away while a placement saves cannot update an obsolete panel.

The explicit `direction` option on `galilee-screen` is a command-only addition to the existing event. It uses the same expected orientation, reach, free-hand and stage guards. Save v10 and all historical migrations are unchanged. The four refined props and isolated Blender workshop fit the original budgets.

The implementation reused the mature progression and asset pipelines, so its authored change is substantially smaller than the planning allowance. Scope is measured by the acceptance cases above. [The verification record](../VERIFICATION.md) separates the complete regression, focused journeys, compatibility smoke tests, final visual refinements and human/device work still to be reviewed. [Portable saves and review steps](../verification/rfc008/README.md) make the result reviewable without playing every earlier chapter.
