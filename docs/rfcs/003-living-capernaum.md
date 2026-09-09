# RFC-003: Living Capernaum

Status: implemented locally; accepted 2026-09-09.

Authorization: the owner requested the recommended Living Capernaum improvements, starting with this RFC and continuing through end-to-end implementation. This document was written before implementation to fix the scope below.

Implementation verification: 219 unit tests passed. The complete browser run and final affected-journey rerun together verified all 47 runnable scenarios, with seven intentional skips in the full suite. Types, lint, production build, formatting and whitespace checks passed. See the [verification record](../VERIFICATION.md) for run counts, Blender and browser review, corrected rendering measurements and external review limits.

## Purpose

Make the existing two chapters dependable and satisfying to inhabit. Preserve their scripture, checkpoints, optional stories, reflections, controls, and portable saves. Add two original adventures that make investigation and practical work part of exploration. Approximately 8–15K authored lines was a planning estimate, not a completion quota.

The review reproduced disappearing static scenery when switching High to Low quality. Existing browser checks passed because characters and terrain still produced nonzero geometry. Correct visible content must precede performance acceptance.

## Deliverables

### 1. Rendering correctness and useful diagnostics

Investigate and correct static-model instancing, visibility, and render lifecycle so houses, trees, furniture, boats, carried objects, and narrative props render independently of shadows. Check all six regions on both graphics levels, including quality switching, camera rotation, reload, and repeated region transitions. Preserve shared geometry/materials where reliable and retain one settled scene.

Add scene-object diagnostics and automated rendering regressions that detect missing scenery, beyond aggregate mesh/draw counts. Use deterministic reduced-motion reference captures, regional required-object contracts, and an image comparison that exercises the shadow-independent static asset path. Inspect production screenshots as well as automated results. Recalculate budgets after correctness is established; document any justified budget change with the visible scene and measurements.

Give exploration regions explicit asset inventories instead of loading the entire neighborhood kit in each room. Keep the overall GLB kit under 5 MiB, actors below 5,000 triangles, props below 10,000, and four concurrent asset requests. No unmeasured device-performance claims.

### 2. Shared world interactions

Extend the authored action contract with semantic motion, practical-action classification, and contextual prerequisite explanations. Pure transitions remain the sole progress authority. Simple carry/place/use/repair actions can be performed through a compact in-world action tray without opening a large conversation; conversations, choices, observations, and Gospel controls retain deliberate reading surfaces.

Pointer, keyboard, and touch use the same action authority and distance checks. Nearby actions offer readable labels and blocked reasons, with accessible focus and announcements. Menus pause motion; actions and their visual feedback tolerate save/load, duplicate input, changed targets, and interruption. A held item from another story must produce guidance to its valid return point rather than an impossible next objective.

Add distinct pick-up, put-down, repair, and sit-down motions with finite one-shot playback. Holding a stationary object must use a stationary pose; walking with it uses carrying locomotion. Motion never awards progress and reduced motion establishes an understandable result immediately.

### 3. A familiar thread — original investigation

Available after completing Into the Deep, independently of Through the Roof and the other neighborhood stories.

Ruth has misplaced a small sewing pouch on her walk between the neighborhood and shore. Accept her invitation, inspect two independent clues in either order (a colored thread by the neighborhood water point and a matching cloth sample in the bakehouse), then compare them with the pouch at the shore. Before the clues are known, the pouch location offers observation and a hint; it cannot be claimed on a guess. Journal evidence explains the matching color and distinctive double stitch.

Carry the identified pouch to Ruth and choose either to recount the route or share a quiet welcome. Both conclusions are equal, produce distinct saved memories, and leave the returned pouch visible beside her. The pouch can be set back at its shore resting place and recovered later. Clues, identification, carrying, return, and the chosen ending survive interruption. This is a bounded authored investigation with no accusation, penalty, random clue, or moral score.

### 4. A place to rest — original practical adventure

Available after Into the Deep. An unstable bench beside the landing can be made useful for neighbors. Inspect it, choose either a rope lashing or a wooden brace, clear the loose pieces, bring the chosen material, fit it, and sit to check the finished seat. Clearing and obtaining the material may occur in either order; fitting requires both. The lashing is collected on the shore, while the brace is borrowed from the bakehouse. Materials can be returned to their source.

Both approaches are valid and visibly distinct. The completed bench and a resting neighbor remain present on return visits; Miriam acknowledges the work. The bench has an explicit navigation footprint throughout. No timing challenge, crafting economy, tool durability, or requirement to repair it before a Gospel account. All intermediate states and the method are saved.

### 5. Continuity, journal, and guidance

Add both stories to the existing registry and tracking interface. Organize the journal into Stories, People, Places, and Memories, retaining access to every original entry and both transcripts. Story filtering and evidence summaries make the growing journal navigable; provenance remains visible. People and place entries describe known authored content and link to reachable destinations.

Derive persistent arrangements and neighbor reactions from state. Completed tables gain seated company in the selected location, the returned pouch stays with Ruth, and the repaired landing bench is occupied after completion. Keep Amos's saved escort position authoritative and do not move him for decorative activity. Existing reflections and optional memories remain acknowledged without inventing missing migrated choices.

### 6. Blender production

Use Blender MCP with the existing workshop and reproducible Python workflow. Preserve unrelated Blender scenes. Extend the original kit with a sewing pouch, thread/cloth clues, loose bench, lashed bench, braced bench, and the required cord/brace props; reuse existing compatible geometry. Add PickUp, PutDown, Repair, and SitDown clips to the shared rig and a stable hand attachment if required.

Verify meter scale, actor orientation, feet, sitting height, hand/object contact, complete one-shot motions, static and locomotion carrying poses, low-quality materials, and portrait/landscape framing. Export self-contained GLBs, source blend, and recipes together. Inspect actual Blender poses and Babylon compositions; passing GLB structure tests alone is insufficient.

## State and compatibility

Introduce save envelope v6 with a bounded `life` object for investigation clues, recovery, ending, bench method, and repair steps. Extend held-item and story-track enums with stable IDs. Migrate all v1–v5 saves, preserving every earned journal entry, chapter checkpoint, reflection, table location, companion position, and held item. New stories begin unstarted; migration must not invent discoveries or choices.

Validate exact derived journal sets, known IDs, phase prerequisites, mutually exclusive held items, material/method consistency, and impossible completion combinations. Preserve export/import, autosave, manual slots, transactional travel, and storage-failure recovery. Add portable v6 fixtures for interrupted investigation and repair.

## Acceptance

1. Both old chapters and all old optional stories complete; v1–v5 fixtures migrate intact. Save schema errors remain descriptive.
2. High/Low render the same essential authored objects in every region. Quality switching and region re-entry do not erase objects or accumulate scenes. Visual regression deliberately fails when static geometry disappears.
3. Both clue orders, both investigation endings, pouch return/recovery, both repair methods, both preparation orders, and mixed old/new held-item interruptions complete without trapping the player. Nearby distance and stale-event guards hold.
4. Every new destination and material source has a reachable approach. Guidance names the actual blocker and routes to a valid release/source/next target across regions.
5. Practical actions work from the compact tray using pointer and keyboard, while map-based approaches and full context remain available. Touch layouts, large text, focus, modal pause, and reduced motion remain usable.
6. Finite action clips settle; static holding does not walk in place. Visible pouch, repairs, and seated neighbors derive correctly from loaded saves, including earlier saves.
7. Journal categories, story filters, evidence, people/place destinations, scripture provenance, and full legacy memories remain accessible.
8. Types, lint, formatting, unit tests, production build, the existing browser suite, and new desktop/phone journeys pass. Capture representative Blender and browser visuals; record corrected geometry/draw calls and frame cadence.

Physical Safari/iOS/Android, sustained thermal performance, assistive-technology usability, historical/editorial review, and human pacing remain separately reported external checks where equipment or reviewers are unavailable. The human target for both optional adventures together is an unhurried 20–35 minutes, to be measured in playtesting.

## Implementation order

1. Write this RFC.
2. Reproduce/fix rendering and establish the regression contract.
3. Implement life state, actions, objectives, journal records, v6 migration, and meaningful unit tests.
4. Produce and inspect Blender props and clips.
5. Integrate interactions, persistent world reactions, journal views, and regional inventories.
6. Exercise full journeys and recovery, inspect both graphics levels and responsive layouts, correct issues, and document actual results.

## Scope boundaries

Retain TypeScript, Babylon, Vite, authored content, IndexedDB, and bounded regions. Chapter III, new towns, open-water travel, offline caching, a content editor, accounts, and backend services belong to later milestones. No push, merge, or public deployment is included.
