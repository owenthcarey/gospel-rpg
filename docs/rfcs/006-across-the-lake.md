# RFC-006: Across the Lake

Status: implemented and verified. Drafted before gameplay and asset changes. See the [verification record](../VERIFICATION.md#across-the-lake--2026-09-12) for actual runs and external review limits.

Authorization: the owner selected the recommended improvements and requested this RFC first, followed by end-to-end implementation. This scope does not require another approval round. Pushing, merging and deployment are excluded.

## Purpose

Add a new way to explore: an ordinary, player-controlled boat on a bounded part of Galilee, two original shore destinations, one landmark-navigation adventure, and a fourth Gospel chapter, **Peace, be still**. Preserve the quiet low-poly style, authored narrative, all three earlier accounts and nine optional stories, and every supported save. The planning estimate is 12–22K changed authored lines, not a completion quota.

## Baseline

The preceding review passed types, lint, 331 unit tests, the production build and five selected Chromium journeys covering movement, initial/transactional loading recovery and completed-world rendering. It did not rerun the complete browser suite. The application has seven exploration regions and three Gospel presentation regions. The 79-model kit totals 5,230,036 bytes, leaving 12,844 bytes below the enforced 5 MiB cap. Fifteen characters account for 2,861,940 bytes and repeat the same sixteen shared motion samples.

Human pacing, historical/editorial review, screen-reader and physical touch usability, and sustained mobile/Safari performance remain unestablished. Automated viewport emulation must not be reported as physical-device validation.

## Player journey

After the Chapter III reflection, the journal invites the traveler back to Capernaum's landing at an explicitly imagined later point in the journey. This ordering is a game progression convention, not a claim about the chronology or geography of the accounts.

Three exploration spaces extend the existing connected world:

1. **The lake crossing:** a bounded, navigable water area with a rocky headland, reed bank, open channel and three landing approaches. The boat follows keyboard or click/tap navigation, respects shore/rock clearance and turns toward its direction of travel. Map destinations offer equivalent automatic navigation and explicit cancellation. Water travel has no damage, drowning, timed challenge, wind simulation or physics dependency.
2. **The reed landing:** an original quiet shore with a distinctive reed bank, split rock and landing. Its observations support the navigation adventure; paths and a resting place invite a short visit.
3. **The sheltered cove:** an original shore behind a rock headland, with a clearly visible landing, shelter, fictional neighbor and Gospel viewpoint. Both new shores can be revisited, and all prior locations remain reachable through Capernaum.

Boarding and docking are explicit local actions. The boat has one authoritative berth or afloat position and heading. Navigating close to a landing does not silently dock. Disembarking puts the traveler on reachable land and preserves the boat at that berth. Reboarding resumes at that landing. Held story objects retain their existing inventory slot across the trip (their visual models are stowed aboard while rowing); existing return guidance still leads to their sources. Earlier companions keep their actual saved region and position.

## Original adventure: A sheltered way

A fictional boatkeeper offers a recollection of a sheltered landing: reeds mark the exposed shore, a split rock marks the turning point, and a headland shelters the inward-facing berth. Inspect the two relevant landmarks in either order, compare the recollection with explicit route interpretations, then reach and inspect the matching cove. Wrong interpretations explain the mismatch without consuming anything. Reaching a location alone cannot substitute for the required observations and interpretation. Optional hints progress from broad direction to a precise route; the accessible map can navigate every required approach.

Return to the boatkeeper and choose to remember attentive observation or the welcome of a safe arrival. Both endings are equal. Evidence, interpretation, hints, arrival and memory persist. Completed visits produce visible resting activity and an original acknowledgement. The story does not gate the Gospel presentation.

## Gospel chapter: Peace, be still

Store all seven verses of **Mark 4:35–41**, World English Bible, separately from original narration, with the source https://ebible.org/engwebp/MRK04.htm. Present seven durable scenes: evening departure, other boats, the storm, waking Jesus, the command, the calm and the disciples' question. Scripture preserves the passage's words and speakers. No invented speech is attributed to Jesus. The traveler never controls the Gospel boat or determines the event's outcome; the introduction distinguishes ordinary exploration from this narrated viewpoint.

Each scene restores a complete composition. Retain Continue, pause/read, scene description, full transcript, leave/resume and finish-with-summary. Storm motion is restrained, with no flashes; reduced motion uses still poses, and all reading controls remain usable. After the presentation, revisit the cove, its quiet lookout and the fictional neighbor, then choose one of three equally valid reflections: stillness, trust or wonder. No exact archaeological reconstruction or chronology is asserted.

## Architecture

Keep pure guarded transitions as progress authority, simulation-time movement, one Babylon engine, transactional disposable scene replacement, four concurrent asset requests and explicit regional inventories. Reuse land navigation and presentation controls through focused extensions; make water walkability and boat presentation explicit. Water position/heading must be captured in snapshots, including before travel, export, autosave and page hiding. A failed load must preserve the previous scene, state and durable autosave.

Extend the existing chapter, practical-action, destination and journal contracts rather than introduce a general content editor. All contextual actions need stable IDs, local-distance/prerequisite guards and readable requirements. A selected water destination and its cancellation must be visible. The first boarding view teaches steering, landing and returning home. Full/restrained guidance, large text, keyboard/touch, landscape and reduced motion remain supported.

## Blender MCP and asset budgets

Use the connected Blender MCP addon and isolated original workshop, preserving unrelated scenes. Produce original landing planks/posts, reed-bank marker, split-rock landmark, shelter/headland details and any required boat fittings. Reuse the established boat, seat/oar sockets, actors and Row clip where their exported contacts are suitable. Add only poses needed to make boarding/docking and rowing readable; verify hand/oar, seat and foot contact in actual Babylon imports.

Before enlarging the kit, measure export/animation optimization. Shared animation loading is a candidate, not a required engine rewrite. Retain the existing 5 MiB total cap initially. Any revised total cap must be justified here with measured existing/new bytes before its test changes. Set and verify explicit per-region model inventories and byte budgets; starting Capernaum must not fetch the expansion. New reference compositions must stay below 300 High / 130 Low draw calls, actors below 5,000 triangles and props below 10,000. Essential geometry must survive quality switching.

Deliver procedural recipes, the workshop `.blend` and self-contained GLBs together. Independently import shipped exports for Blender review of scale, orientation, waterline, landings, seated/rowing contact and shore silhouettes. Review actual browser compositions at desktop and phone sizes. Record measurements and corrections, not just successful export messages.

## Save v9

Add a bounded lake record for the boat, navigation story, Gospel checkpoints/aftermath/reflection and new visited positions. Migrate v1–v8 with empty new progress; preserve prior journals, story choices, held objects and both companions. Reject future versions, unknown IDs, invalid coordinates/headings, contradictory mode/region/berth, impossible progress and forged journal sets. Preserve the 128 KiB import limit.

Provide portable examples for the unlocked crossing, an interrupted trip afloat, an interrupted navigation adventure, a docked shore visit, a Gospel checkpoint and completed content. Reload and import must load the saved region directly and support retry without discarding progress.

## Acceptance

1. Complete all four Gospel chapters and ten optional stories. The new original adventure never gates the Gospel account.
2. Board at Capernaum; steer and automatically navigate around shoreline obstacles; dock at both new shores; reboard and return. Cancel, pause, keyboard input and background suspension behave consistently.
3. Reload/export/import while afloat, docked, holding an older object or reading the Gospel. Preserve the exact saved travel state, held object and waiting companions. Failed loading keeps the earlier durable save and permits retry.
4. Complete both observation orders, incorrect interpretation/retry, all hint levels, both original endings and all Gospel reflections. Navigation and visible landmarks agree with readable clues.
5. All seven Gospel scenes, full verse coverage, descriptions, pause, summary and checkpoint restoration work independently of ordinary boating. Both graphics levels and reduced motion retain readable storm/calm staging.
6. Every required land/water approach is reachable. Boat/shore clearance, docking positions, visible routes, collision and saved state agree. Completed activity restores after revisiting and loading.
7. Keyboard and phone portrait/landscape controls, large text and restrained guidance remain usable. The first boarding explanation and map offer a complete route for players who do not use manual steering.
8. All historical fixtures migrate intact; new valid fixtures round-trip and invalid combinations are rejected. Types, lint, formatting, unit tests, production build and the complete browser regression pass.
9. Asset inventories, byte/triangle/draw-call budgets and required-object checks pass. Independently review Blender exports and Babylon visuals and document actual evidence and external review limits.

## Implementation order

1. Write this RFC; implement navigation/state/content and save v9 contracts with meaningful pure tests.
2. Measure asset capacity, produce and inspect original assets through Blender MCP, and record any justified budget decision.
3. Integrate water/shore rendering, Gospel staging, boarding/docking, contextual UI, journal and connected maps.
4. Add portable fixtures and complete/interrupted browser journeys; fix visual and interaction defects and run the entire regression.
5. Update README, architecture, narrative, assets, playtest, roadmap and verification documents with the delivered behavior and actual checks.

Offline caching, an economy, combat, unrestricted world sailing, a physics engine, voice acting and a general content editor are separate milestones.

## Asset capacity decision

Lossless sharing of identical buffer views, accessors and animation samplers reduced the original 79 exports from 5,230,036 to 5,015,744 bytes (214,292 bytes saved). Every animation channel, sample, vertex and socket is retained. This provides 227,136 bytes of headroom before the new kit, so the 5 MiB total cap remains unchanged. The compactor is part of the reproducible Blender recipe. Runtime shared-clip loading is unnecessary for this milestone. New exploration/presentation inventories have a 2.5 MiB per-region model limit; starting Capernaum retains its existing inventory.

## Measured implementation decisions

The delivered 84-model kit totals 5,128,144 bytes, leaving 114,736 bytes under the unchanged cap. Five original shore/fitting assets use the headroom recovered from the old exports. A comparison against the previous Git revision confirms identical resolved data for all 79 prior models.

Blender and Babylon review required fitted support surfaces and joint-driven oar grips. The existing Row/Recline clips are retained, with correct runtime placement and forearm-tip attachments instead of an additional animation family. Supplies remain owned by the existing one-item slot and appear stowed during rowing. Navigation excludes a larger area around the rocks to cover the rotating hull, and the cove water berth is at `(17, 17)` in the local crossing coordinates.

Opening a menu now captures a fresh autosave, and export waits for that snapshot. This closes an interruption gap discovered by steering-and-reload tests, while retaining the transactional rule that failed region loading cannot commit the destination state.

After the Nain reflection, the next objective uses Chapter IV's title and Scripture reference. Once both navigation clues are recorded, **Review the clues** opens their journal comparison directly. At the cove, the objective points to the Gospel viewpoint instead of repeating the docking instruction.
