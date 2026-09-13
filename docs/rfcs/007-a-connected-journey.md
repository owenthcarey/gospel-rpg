# RFC-007: A Connected Journey

Status: implemented locally, 2026-09-12. Written and accepted for implementation before gameplay or asset changes.

Authorization: the owner selected the recommended improvements and requested this RFC first, followed by implementation end to end. This authorizes the work below without another approval round. Commit, push, merge and deployment are separate actions.

## Purpose

Make the existing four Gospel chapters, ten optional stories and ten exploration regions feel like a continuous journey. Preserve the quiet original low-poly world, authored narrative, ordinary traveler, scripture provenance and all supported saves. The planning range is 15–25K changed authored lines, not a completion quota; acceptance depends on behavior and evidence.

The reviewed baseline passes types, lint, 390 unit tests, build and formatting. Six selected Chromium scenarios passed across an initial run and an unchanged rerun of two screenshot/click timeouts. This was not a full browser regression. The 84-model kit totals 5,128,144 bytes, leaving 114,736 bytes under its existing 5 MiB limit. Human pacing, physical-device performance and assistive-technology review remain unestablished.

## 1. Persistent travel intent

Selecting a person, place or return point from a map, journal or objective records the final destination. A route planner derives the next reachable passage from the existing unlocked graph. The interface names the final destination and current leg. A deliberate gateway action continues guidance toward that destination in the next region; it never grants story progress. Final arrival clears the itinerary. Selecting another destination replaces it.

Menus and Gospel reading suspend movement but retain the itinerary. Reload/import restore the destination with a visible Resume route control; they do not begin moving without input. Explicit cancellation clears the itinerary. Manual movement stops automatic movement and leaves a resumable destination. Local ground clicks may replace the current walk but must not silently resume an old route.

Boarding and docking remain explicit. Route plans account for current boat mode/berth and chapter availability. No shortcut teleports the boat, supplies or companions. Amos and Neri retain their actual positions and existing meeting-point requirements. A failed load retains the earlier scene, state, itinerary and durable save. Disappeared or unavailable destinations explain why a route cannot continue and permit cancellation.

## 2. Returning to the game

Continue presents a compact journey recap with current place/chapter, the last meaningful recorded memory, tracked work, unfinished stories, any held supply and its return destination, both active companions, and any saved itinerary or replay. Beginning a new journey keeps the existing opening experience. The recap supports continuing, choosing a story and resuming a route, with no forced reading or story advancement.

The journal adds status views for active, available and completed stories, alongside All stories and the existing story/category filters. All retains access to locked stories and all transcripts. Status views use the shared chapter registry rather than reimplementing availability. Empty states are useful and filtering preserves focus. Recap and journal controls fit phone portrait/landscape and large text.

## 3. Consistent ordinary actions

Use the existing practical-action contract to make physical interactions consistent across the original shore, neighborhood, road, farm and lake. Pick-up, put-down, repair and sit actions close the inspection panel when appropriate, give readable feedback and expose their motion in the world. The nearby tray and inspection panel share requirements. Reading, evidence comparison, choices and puzzle plans remain available in their reading panels.

One held-object slot, distance guards, reversible supplies and saved outcomes remain authoritative. Animation is presentation only; it cannot complete a task or delay durability. Menus, interruptions and reduced motion cannot trap an item or require waiting for an animation. Legacy motion and placement behavior receives regression coverage.

## 4. Return encounters: The way home

After the Chapter IV reflection, offer an optional original closing interlude across existing places. Three independently visitable encounters can be completed in any order:

1. **Leah at the farm — Room on the road.** Remember ordinary welcome. The dialogue distinguishes an arranged resting place (including its chosen site) from an uncompleted one, and acknowledges restored water only if it exists. Choose to remember making room or accepting company.
2. **Hannah at the bakehouse — A shared table.** Remember the neighbors met along the way. Text recognizes the actual table choice, Ruth's returned pouch and companion memories when earned, with equally complete alternatives for skipped stories. Choose to remember listening or sharing what is at hand.
3. **Miriam at the shore — The familiar landing.** Return to the first place. Text recognizes the Chapter I reflection, Ezra's chosen memory, the repaired bench and the lake journey when present. Choose to remember looking closely or beginning again.

After all three, the shore offers a closing traveler reflection: carry the welcome onward or remain awhile. This marks the end of this part of the journey and records an original journal memory; the entire world and unfinished stories remain open. No optional story is retroactively completed or required. Encounter choices and partial progress persist; repeated actions are harmless. A completed encounter provides a remembered acknowledgement on later visits. A small visible gathering at the completed shore interlude uses existing actors and respects crowd limits.

These encounters introduce no scripture, invented Jesus speech, historical incident, spiritual score or preferred outcome. They refer only to memories actually present in the save. Migration must not supply missing choices. Provide a dedicated journal track and local destinations with readable provenance and guidance.

## 5. Gospel replay

Completed Gospel chapters become available in a scene library. Choose any of the 10/8/6/7 existing scenes, read its original captions and scripture, pause motion, move backward/forward or select another scene. Replay uses the original staged compositions and full transcripts.

Replay is a separate saved presentation cursor. The authoritative campaign progress, journal, reflections, original Gospel checkpoint, itinerary, held objects, boat heading/berth, companions and exploration position remain untouched. Runtime/UI receive a derived presentation state; saving records the underlying journey plus the replay cursor. Returning restores the exact ordinary journey. Reload/import can resume replay directly with transactional retry. The final replay scene returns to the journey without granting any progress. Uncompleted chapters cannot be replayed. Replay can start from exploration; while witnessing an unfinished Gospel, the player must deliberately leave it before starting replay.

Use a focused account registry for IDs, scenes, completion and presentation projection. Keep chapter-specific compositions and source modules. The scene library clearly distinguishes replay from first-time Gospel reading.

## Architecture and save v10

Add a focused connected-journey state for itinerary, replay cursor and closing interlude. Extend the pure reducer with explicit guarded events. Keep one Babylon engine, simulation-time movement, four concurrent asset requests, disposable scene ownership and transactional replacement. Factor action feedback, account selection and journey presentation where this removes duplicated rules; do not replace the engine or build a general editor.

Save v10 migrates v1–v9 with empty new progress. Preserve old region/checkpoint validation, all choices, journals, supplies and companions. Validate destination IDs and availability, account/checkpoint membership and completion, bounded encounter choices, closing prerequisites and exact journal membership. Reject forged combinations and future versions. Keep the 128 KiB import limit and serialized writes. Store only known fields and keep settings separate from progression.

## Blender MCP and visual work

Use the connected Blender MCP addon in an isolated original workshop, preserving unrelated scenes. Scope the asset work to an original reusable passage marker and refinements to the existing landing pier's edge/post silhouette, plus independent review of traveler holding/working and seated return-company poses. Reuse existing actors, furniture, the twelve-bone rig and sixteen shared clips. Refine runtime contact/placement when it is the source of the visual problem.

Deliver recipes, workshop `.blend` and GLBs together. Inspect shipped exports independently in Blender and actual Babylon compositions for scale, orientation, landing waterline, hand/prop and seat/foot contact, marker visibility and collision agreement. Review passage, landing, work and return-company compositions at desktop and phone sizes, High/Low and reduced motion. Caption and controls must leave useful world space.

Retain the existing 5 MiB total GLB cap, 5,000/10,000 actor/prop triangle caps, per-region inventories and 300 High / 130 Low reference draw-call limits. Measure new bytes before delivery. Any budget revision must first be justified here using measurements; no revision is assumed. Reuse the existing kit for the new interlude rather than adding a new character family.

## Acceptance and verification

1. Select a destination across at least three regions; deliberately cross passages and arrive at the original destination. Exercise replacement, cancellation, manual interruption, menus, reload/import and unavailable destinations.
2. Route from land through explicit boarding/docking to either shore and back. Carry an old supply and leave a companion waiting; all authoritative positions and possessions survive. Failed loading preserves earlier durable state and supports retry.
3. Continue/import show an accurate recap. Every journal status view agrees with chapter availability/completion, with usable empty states, large text, keyboard focus and phone layouts.
4. Perform representative shore/neighborhood/farm physical actions from inspection and tray. Observe their feedback and motion; reduced motion, menus and interruption preserve correct durable outcomes and recovery.
5. Complete all three return encounters in any order, both choices at each and both closing reflections, with and without prior optional stories. Partial saves round-trip and only earned earlier memories are acknowledged. Completed company appears on revisits and restoration.
6. Replay all four accounts, select every checkpoint, move backward/forward, read transcripts, pause, leave and reload/import. Campaign progress, journal, possessions, companions, boat and return position are unchanged. Failed replay startup/return supports retry without save loss.
7. All historical fixtures migrate; valid v10 fixtures round-trip and forged combinations are rejected. Supply portable examples for a multi-region itinerary, interrupted replay, partial return encounters and completed interlude.
8. Types, lint, formatting, unit tests, build and the complete browser suite pass. Add one continuous new-save browser journey through all four chapters, preserving its state between chapters, plus focused interruption tests. Record actual failures/reruns without claiming a clean run when there was none.
9. Asset inventories, decoded export contracts, byte/triangle/draw-call limits and essential-object rendering checks pass. Record Blender MCP and browser review evidence. Document physical-device, human pacing/editorial and assistive-technology checks separately from automation.

## Implementation order

1. Write this RFC, then implement account/itinerary/interlude contracts, save v10 and meaningful pure tests.
2. Integrate transactional replay/travel, recap, journal status views and shared physical-action handling.
3. Author and integrate the three return encounters, closing reflection and visible company.
4. Produce/inspect the bounded Blender improvements and verify Babylon placement, camera and phone compositions.
5. Generate portable fixtures, run focused and continuous journeys, fix failures, then run the complete regression and update all relevant documentation with actual results.

Additional regions, Chapter V, unrestricted sailing, offline caching, real-time schedules, an economy and a content editor remain separate milestones.

## Delivery record

The scope above is implemented. [Verification](../VERIFICATION.md#a-connected-journey--2026-09-12) records 430 passing unit checks, the full 111-pass/11-skip browser regression, final selections covering all 113 runnable scenarios in the expanded 124-case suite, the uninterrupted four-chapter software-renderer run, measured reading contrast, unchanged asset/rendering limits, and visual evidence. [The playtest guide](../PLAYTEST.md#a-connected-journey) includes the four portable v10 journeys and remaining human/device review.

Verification corrected inherited reading colors, native route-button colors, quick-tray route continuation, recap cancellation, direct story shortcuts after status filtering, and static-mesh shadow/selection properties. Geometry batching retains the existing scenery within the original draw-call caps. No milestone budget was raised.
