# RFC-010: The Way, Brought to Life

Status: implemented and locally verified. Drafted before code or asset changes; delivery notes appended after acceptance.

The owner requested the recommended presentation and game-feel improvements, starting with an RFC and continuing through implementation and verification. This authorizes the local work below. The planning allowance is approximately 20–35K changed authored lines, including tests and tools; line count is not an acceptance quota. Source workshops and exported artwork are additional deliverables.

## Purpose

Establish a finished reference experience across exploration, conversation, practical work and the ten scenes of **Into the Deep**. Capernaum receives the full environment treatment; shared character, camera, interface and water improvements benefit the existing journey. Preserve the warm, matte, low-poly direction, authored narrative, ordinary traveler and independence of the Gospel accounts.

The intended change should be apparent immediately: a recognizable fishing settlement with worn, irregular paths and a convincing water edge; distinct, grounded people who turn, greet and listen; conversations composed around the speakers; clear physical work; and a more expressive catch-and-calling sequence.

## Baseline and continuity

Baseline commit: `d388fec`. Four Gospel chapters, 31 narrated/replay scenes, eleven optional stories, ten exploration regions and four presentation regions are playable. The asset catalog contains 94 GLBs totaling 5,390,092 bytes. Current checks pass 552 unit tests, types, lint, evidence validation, formatting and production build. The preceding milestone's complete browser acceptance is recorded separately; it is not a fresh run for this RFC.

Keep TypeScript, Babylon.js, Vite, local IndexedDB and static hosting. Gameplay reducers remain the sole authority for progress. Retain v11 and every historical migration unless a concrete durable-state requirement is discovered and documented before changing it. Cosmetic clocks, camera bookmarks, performances and action feedback are not save data. No task completion may depend on an animation finishing.

Preserve every existing story, solution, reflection, transcript, source label, action guard, companion position, carried object, berth/heading, saved destination and replay cursor. Changes to visible ground must respect existing walkability and saved positions. Decorative geometry cannot create hidden obstacles. Substantial additions must have explicit footprints and safe recovery for existing standing positions.

## 1. Environment direction

### Capernaum reference spaces

Give the shore and residential lanes a unified but varied settlement composition. Replace hard rectangular path edges with deterministic worn path surfaces, small edge stones, earth/grass variation and appropriate shore banks. Preserve readable open approaches. Architecture gains distinct roof/parapet details, stone courses, timber and shaded thresholds; fishing spaces gain coherent net, rope and cargo groupings. Existing house proportions and door locations remain compatible with navigation.

Treat the gathering house and bakehouse as inhabited rooms: grounded floor treatment, wall details, storage groupings, textile accents and restrained local warmth. The bread-working station remains separate from Hannah's deliverable table. Existing roof, wall and foliage cutaways remain effective.

Use an authored palette with stronger separation between warm paths, muted vegetation, pale plaster and blue-green water. Lighting preserves readable shaded faces and silhouettes without glossy materials or a heavy postprocessing stack. Shared terrain/material and water components should be scene-owned, deterministic and disposable. Later regions receive compatible shared improvements, while retaining their distinct layouts and chapter staging.

### Water

Introduce a reusable stylized water surface with bounded wave motion, shallow/deep color variation and shoreline/ripple accents. Ordinary lake exploration retains its existing navigable plane and boat authority. Replace the storm's disconnected rectangular wave slabs with coherent waves and foam appropriate to the same visual language. Reduced motion uses a deliberate still composition; Low keeps readable water with reduced optional detail.

## 2. Character identity and movement

Refine the traveler and principal opening characters with recognizable hair, wraps, belts, facial features and garment colors at the actual play camera distance. Keep the shared meter-scale skeleton and attachment contracts. Shared model changes must pass all imported geometry/contact tests for seated, carried, rowing and procession poses.

Add a small useful vocabulary of original performance clips for greeting, listening and response. Improve walking cadence, smooth directional changes and transitions between idle, walking and work. Navigation positions and reach checks remain authoritative. Turning and body settling must not delay input, cause sliding through collision or move a saved companion cosmetically into another region.

Batch actor color materials where practical to create rendering headroom. Measure actual draw calls after importing the final skins. Keep meaningful differences between characters rather than increasing their detail uniformly.

## 3. Conversations and interface

Add a scene-owned conversation presentation controller. An ordinary nearby person can be framed with the traveler, preserving the prior camera and restoring it when the conversation closes. Camera limits and composition use the visible viewport rather than assuming a fixed desktop panel height. Indoor, narrow portrait and short landscape layouts keep the speaking actor visible. Non-person observations and full work inspections retain a reading-focused presentation.

Gameplay, companions and quests remain paused while a conversation is open. A separate bounded cosmetic presentation clock can animate the speaker and listener. It stops on hidden documents, loading, graphics loss, explicit presentation pause and reduced motion. Opening another menu suspends/clears conversation staging appropriately. Exiting, saving, reloading, walking away and failing a region load must not leave a camera or actor locked in conversation mode.

Replace the generic portrait treatment for recognized speakers with identity-bearing artwork derived from the shipped character assets. Keep narration clearly distinguished. Text is immediately readable, with source labels, keyboard choices, accessible names and full controls. Refine panel spacing and HUD hierarchy so the selected action and people receive emphasis. Provide contextual opening guidance derived from existing progress; the journal's full guidance and destination list remain available.

The revised conversation surface must support the legacy dialogue and later named-person context panels through one presentation contract. Do not rewrite the authored stories solely to use the new presentation.

## 4. Physical actions

Use existing action definitions to coordinate facing, approach framing, finite motion, sound and world feedback. Improve visible pickup/placement/work contact and avoid an immediate panel reopening that hides the resulting action. The focused work surface and full inspection dispatch identical guarded commands.

The landing, basket delivery, bench repair and spring/resting arrangements are representative cases. Their geometry remains consistent with their solver and saved result. Feedback distinguishes selecting an action, an accepted state change and an unsuccessful test. No decorative feedback grants progress, duplicates an action, consumes an extra item or becomes a collision/pick target. Interrupting a visual action leaves the committed gameplay state and recoverable supplies intact.

## 5. Into the Deep as the reference sequence

Review and refine all ten durable scene compositions: gathering, teaching, invitation, answer, lowering, abundance, partners, astonishment, calling and return. Establish the shore/boats spatially, keep the subject clear beside the actual reading surface, and use restrained camera transitions and coordinated character reactions. Net, rope, oar and cargo staging should communicate the work and catch at both screen sizes.

All scripture, original narration and scene IDs remain unchanged. No invented teaching or speech is attributed to Jesus. The traveler stays an observer. Continue is always available; pause, leave/resume, summary and replay reconstruct a complete readable composition. Reduced motion selects useful still states. The existing original score is retained with appropriate motion/effect accents; audio remains optional and separately adjustable.

Shared presentation improvements apply to the roof, Nain and storm accounts where compatible. Full bespoke reauthoring of those three accounts is outside this milestone, except the shared water/storm correction and necessary framing/character compatibility changes.

## 6. Blender MCP and asset delivery

Use the connected Blender MCP instance in an isolated workshop, preserving the user's original scene and objects. Preflight found Blender 5.2.1 LTS with addon protocol 5; the server expects protocol 7 but reports working native inspection/code capabilities. Check required operations before production and record the actual execution path. Updating the installed addon is unnecessary if the required native operations work.

Deliver reproducible recipes, a source workshop and shipped GLBs/portraits. Independently import final exported GLBs in a separate review scene. Inspect silhouettes, vertex colors, rig motions, orientation, hands, feet, seated support, attachments and environment scale. Compare these with the actual Babylon import and browser compositions; a Blender render alone cannot establish runtime correctness.

Retain the existing evidence policy: full output in ignored `artifacts/` and `test-results/`, a small selected permanent gallery with hashes and declared budgets. No external asset library, generated-model service or voice service is required.

## 7. Performance and loading budgets

This RFC explicitly increases the total GLB catalog ceiling from 5.5 MiB to **7.5 MiB** to support character animation and original environment refinements. The allowance is not a download target. Portraits have a separate **384 KiB total** ceiling and load only for displayed speakers. Each exploration region may add at most **768 KiB** of GLB downloads over its captured baseline. Record exact before/after inventories, totals and all changed exports.

Retain fewer than 5,000 triangles per actor and 10,000 per prop; at most four concurrent model requests; one settled scene; and the existing reference **300 High / 130 Low draw-call** ceilings. New scenery should be merged by compatible material/asset where safe. Preserve the clone-based loader and missing-geometry negative controls. Do not silently increase render budgets or remove essential scenery to meet them.

Preserve deferred region assets and the no-model welcome scene. Record production bundle bytes, regional downloads and representative render cadence. Targets remain 60 FPS on a representative laptop at High and 30 FPS on a representative midrange phone at Low; desktop viewport emulation does not establish physical-device performance. No new mandatory runtime network services or textures from remote URLs.

## Acceptance and verification

1. Visually review shore, lanes, gathering house and bakehouse before/after at the same positions and qualities. Show distinct terrain/path edges, architecture, readable people and usable entrances. Review every Chapter I scene and the storm water at desktop, portrait and short landscape sizes.
2. Nearby characters retain recognizable portraits, visible speaking/listening poses and useful camera framing. Close/menu/reopen, reduced motion, hidden page, save/reload and region failure release or suspend presentation correctly. Saved gameplay and actual companion positions do not drift during conversation.
3. Keyboard, pointer/touch and map approaches remain equivalent. Text, provenance and Continue remain accessible at standard/large text sizes. Work inspection, action feedback and conversation focus preserve intended keyboard order.
4. Validate real imported geometry: character facing and support, all existing contacts/ports/solvers, new animation distinctions, action interruption and scenery/collision bounds. Verify deterministic cosmetic clocks and cleanup rather than tests that merely mirror generated markup.
5. Run types, lint, formatting, unit tests and production build; the complete Chromium desktop/phone regression; the uninterrupted fresh-save four-chapter journey; Firefox/WebKit compatibility; and new presentation journeys. Record failures and reruns accurately. Review changed screenshot baselines before accepting them, then run without snapshot updates and retain missing-geometry negative controls.
6. Measure asset/portrait/regional bytes, draw calls and one settled scene. Compare production browser renders and independently imported Blender exports. Retain hashes and a practical review guide.
7. Document a focused human playtest covering discovery, visual identity, interaction clarity, conversation comfort and chapter pacing. Record actual human/device/editorial results only when performed; list unavailable physical-device or human reviews as outstanding rather than claiming automation substitutes for them.

## Implementation sequence

1. Draft this RFC and capture unchanged baseline inventories/compositions.
2. Implement shared visual, movement and conversation presentation contracts with bounded clocks and meaningful tests.
3. Produce/refine the original Blender assets and portraits through MCP; integrate the shore as the first complete reference, then lanes and interiors.
4. Integrate physical feedback and complete all ten Chapter I scenes; propagate shared changes and refine storm water.
5. Review browser/Blender output, optimize measured costs, complete regression and compatibility checks, and document actual results and remaining external reviews.

No fifth chapter, new optional story, combat, crafting economy, moral score, unrestricted sailing, general day/night simulation, offline/update system, voice acting or engine rewrite is included.

## Delivery notes · 2026-09-22

The shared presentation controllers, Capernaum environment treatment, fifteen character identities and portraits, physical-action accents, all ten Chapter I compositions and continuous lake/storm water are implemented. Blender MCP produced nineteen revised exports and the original source workshop; independent imports verified the delivered files. Save v11, all four chapters, authored accounts and practical-story rules remain intact.

The catalog totals **6,706,812 bytes**; portraits total **50,576 bytes**. The largest regional increase is **715,700 bytes**, within the agreed allowance. Vertex-palette batching lowers measured draw calls in every reference Capernaum space. No draw-call, evidence-retention or loading-concurrency limit was raised.

Acceptance passed **562 unit checks**, the complete Chromium matrix (**155 passed, eleven intentional skips, zero failures; 46.1 minutes**), four Firefox/WebKit compatibility checks and six final presentation checks. Types, lint, build, formatting and evidence validation pass. The [delivery guide](../verification/rfc010/README.md) links the selected images, source/build hashes, case outcomes and measurements. Human pacing/editorial review, assistive-technology/touch review and sustained physical-device performance remain outstanding external reviews; automation does not establish them.
