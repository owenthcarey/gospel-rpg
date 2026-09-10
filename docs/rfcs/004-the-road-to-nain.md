# RFC-004: Beyond Capernaum — The Road to Nain

Status: implemented and locally verified, 2026-09-09. Drafted and accepted before implementation.

Authorization: the owner selected the recommended expansion and requested this RFC first, followed by end-to-end implementation. This document fixes the scope before gameplay or asset changes.

## Purpose

Give the traveler a destination beyond Capernaum: an imagined journey through Galilee, two optional adventures that reward observation and route choices, and a bounded presentation of Luke 7:11–17. Preserve the quiet low-poly style, authored narrative, user-paced reading, all previous stories, and portable saves. Approximately 12–20K changed authored lines is an estimate, not an acceptance quota.

## Baseline and review limits

The pre-implementation review passed 219 unit tests, 47 production Chromium browser checks and seven intentional skips, plus types, lint, formatting and production build. Both graphics levels render essential scenery in all six existing regions. The full browser run took 16.2 minutes locally. The 62-model kit totals 4,125,896 bytes (3.93 MiB), leaving 1,116,984 bytes under its 5 MiB cap.

The review reproduced a completed-prelude journal card displaying the tracked Chapter II objective. The player, interaction labels and escort currently assume flat ground. Region factories, story guidance and Gospel controls contain chapter-specific branches.

Human pacing, historical/editorial review, physical screen-reader/touch usability, and sustained Safari/iOS/Android GPU performance have not been established. Begin with this baseline, inspect production compositions throughout implementation, and report those external checks honestly. Automated phone emulation is not a physical-device result. Preserve targets of 30 FPS on a representative phone at Low and 60 FPS on a representative laptop at High; do not claim them without measurement.

## The player journey

After completing Through the Roof, the journal offers The Road to Nain. An exit from Capernaum's lanes leads to an explicitly imagined journey at a later time. Three new exploration regions form a compact connected route:

1. **The Galilean road:** a fork, a spring landmark, terraced paths, a shaded meeting place and a view back toward the lake.
2. **A roadside farm:** olive trees, a resting shelter, a work courtyard, a landmark and a traveler preparing to continue.
3. **The gate of Nain:** a distinctive gate, a small courtyard and a quiet place to return after the account.

The road connects to the farm and Nain, and remains connected to Capernaum. These spaces compress travel for play; their geometry, distances, route and buildings are artistic interpretations. They do not establish an archaeological location or a precise chronology between Gospel accounts. All mandatory destinations remain reachable without solving optional stories. Earlier chapters and optional work remain available on return.

## Two original adventures

### A way remembered

Tamar, a fictional traveler on the road, recalls a resting place by its landmarks. Accept her invitation and inspect the spring and terrace markers in either order. A focused inspection view presents the actual visible details alongside equivalent readable descriptions. Record those details, compare them with Tamar's recollection, and choose the matching route from explicit alternatives. An unsupported interpretation explains the mismatch and permits another attempt without a penalty or lost evidence.

Follow the identified route to the farm's resting place, confirm the matching landmark and return to Tamar. Choose to remember either the careful observation or the company along the way. Evidence, interpretation, arrival and the ending persist. Discovery guidance starts with a direction or landmark; optional hint levels can reveal the precise destination using the existing accessible approach controls. This is an authored investigation, not random evidence or a test of religious knowledge.

### Company on the road

Neri, a fictional traveler at the farm, would welcome company to Nain. Choose a shaded route or an open terrace route. Both are valid and visibly distinct. Walk together through authored meeting points in the farm, road and Nain. The party pauses when the player leaves, opens a menu, enters a Gospel presentation, or moves too far ahead. A route overview and a Find Neri destination always explain where to regroup.

The traveler may visit other regions without moving Neri. Companion region, actual position, route and meeting-point index are saved. Crossing a boundary moves the companion only when the relevant meeting point has been reached together and the player deliberately continues through the route's gateway. A different exit leaves Neri waiting. Both routes finish at the same courtyard, with distinct journal memories and visible resting company. This story can be completed before or after the Gospel account and never gates it.

## Chapter III: At the gate

Use the World English Bible text of **Luke 7:11–17**, stored verse by verse with its source URL. Six durable scenes present the approaching company, the widow and procession, compassion, the stopped bearers and command, the son sitting up and being given to his mother, and the people's response. The traveler observes; the player's optional work neither causes nor earns the event. Do not invent speech for Jesus or the unnamed mother/son. Original narration and staging remain explicitly labeled.

Reuse a common accessible Gospel reading/control surface for all three accounts while retaining distinct scene staging and existing durable IDs. Every checkpoint establishes a complete composition, including after reload. Continue, pause, describe, transcript, leave/resume and finish-with-summary remain available. Summary preserves the full account in the journal and returns to exploration. Afterward, visit the gate, the courtyard and a fictional neighbor, then choose one of three equal reflections: compassion, restoration or shared wonder. Earlier memories can be acknowledged without inventing absent migrated choices.

## Exploration and architecture

- Add a regional journey map showing known places, connections, current region, next doorway and the companion's location. Retain local destination lists and keyboard/touch access. New regions become known through arrival; guidance to the next chapter remains available before discovery.
- Support gentle terrain elevation through a deterministic ground-height contract shared by the traveler, companion, placed actors, labels, route markers and interaction targets. Retain the bounded two-dimensional A* grid with explicit walkability and obstacle footprints. No stacked walkable floors, jumping, climbing or full physics simulation is required.
- Keep transactional region replacement, one settled scene, four concurrent model requests and separate disposable scene resources. Give every new region an explicit asset inventory and required-object rendering contract.
- Consolidate story status/objective metadata and shared Gospel controls only where the third chapter needs them. Preserve existing reducers and chapter-specific compositions. Correct the prelude journal objective and remove misleading Capernaum-only labels from shared travel UI.
- All new progress comes from typed, validated transitions with local-distance, prerequisite and stale-checkpoint guards. Presentation timing never grants progress. Current carrying/return-point guidance works in every new exploration region.

## Blender production

Use Blender MCP and the existing original procedural workshop. Preserve unrelated Blender scenes. Extend the kit with a distinct town gate, terrace/roadside details, farm shelter and landmark props, an open procession carrying frame, and widow/young-man variants. Reuse compatible buildings, foliage, actors and furniture. Add only necessary carrying/sitting-up animation and attachments; retain every existing clip contract.

Inspect exported assets in Blender and actual Babylon views: meter scale, handedness, actor feet on slopes, hand/frame contact, supported body poses, seated height, matte vertex-color materials and clear procession silhouettes. Deliver reproducible recipes, the workshop `.blend`, and self-contained GLBs together.

Start with the existing 5 MiB total kit cap. If the final inventory cannot fit after sensible reuse, document the measured reason and revised cap in this RFC before accepting the exports. Individual actor/prop triangle limits remain 5,000/10,000. New regions must remain under 300 High / 130 Low draw calls in their defined reference compositions; the earlier shore baseline remains separately reported. No budget is increased to hide missing geometry or a failed check.

## Saves and compatibility

Introduce envelope v7 with a bounded `road` record: chapter checkpoint/aftermath/reflection, route evidence/interpretation/ending, companion route/step/region/position, hints, and visited new regions. Preserve every v1–v6 field and earned journal entry through migration; new stories start unstarted. Existing in-progress lake/roof scenes, Amos walks, held items and bench/pouch work retain their meaning.

Validate known IDs, exact derived journal sets, finite coordinates, chapter unlocks, route prerequisites, companion locations and phase consistency. Restored exploration positions must be reachable. Save/export/import must work at all new stages and region boundaries. Failed asset loads leave the previous state and durable autosave intact. Provide portable fixtures for an interrupted road investigation, a companion waiting across a boundary, a Nain Gospel checkpoint and a completed journey.

## Acceptance

1. All three chapters and seven optional stories complete; every existing fixture migrates intact. Optional adventures never gate the Gospel account.
2. Both evidence orders, incorrect interpretations/retry, all hint levels and both investigation endings work without losing progress.
3. Both companion routes work across regions. Menus, abandonment, alternate exits, a held item, Gospel reading, reload and manual/imported saves never teleport, duplicate or strand the companion.
4. Every new destination has a reachable approach. Slopes, obstacles, route markers, actor feet, labels and restored positions agree. Players can return to Capernaum at any stage.
5. Every Nain checkpoint supports pause, leave/resume/reload and summary. All seven source verses appear in the transcript with provenance. Aftermath and all reflections persist independently of optional tasks.
6. Journey map, local map, journal, inspection and optional hints remain usable with pointer, keyboard, phone portrait/landscape, large text and reduced motion.
7. New and legacy essential scenery renders on High and Low, quality switches and re-entry. Region transitions settle to one scene; required-object and visual regressions detect missing geometry. Measured asset and draw-call budgets pass.
8. Types, lint, formatting, unit tests, production build, existing browser tests and new desktop/phone journeys pass. Inspect representative Blender and browser visuals and document corrections, measured results and external review limits.

## Implementation sequence

1. Write this RFC and preserve the verified baseline.
2. Implement road state, authored content, terrain/route contracts, v7 migration and meaningful pure tests.
3. Produce and inspect the Blender kit through MCP.
4. Integrate exploration, companion travel, inspection/hints, journey map, shared chapter controls and Gospel staging.
5. Exercise interrupted and complete journeys, correct visual/usability issues, run regression checks and update the README, playtest guide and verification record.

Offline caching, an economy, combat, free sailing, runtime-generated dialogue, a general content editor and a full open world are separate milestones. No push, merge or deployment is part of this local implementation.

## Implementation record

The accepted scope is implemented locally. The kit contains 71 GLBs (14 actors and 57 props), totaling 4,951,908 bytes; the 5 MiB cap is unchanged. Sixteen shared clips remain on all actors; three specialized clips appear only on the young man (`SitUp`), bearer (`FrameCarry`) and Jesus (`TouchFrame`). Regional travel and map distances remain explicitly fictional compression; no historical distance claim is introduced.

**Blender MCP production restored:** The initial asset pass used a CLI fallback while the addon was unavailable and the desktop locked. After Blender was reopened, enabling the addon and connecting the server restored native MCP access. The full workshop, nine new assets, two actors with new clips, and independent GLB review sheets were then recreated through MCP in Blender 5.2.1 LTS, replacing that fallback. Live review added stone courses to both gate faces. The other sixty prior MCP exports and the user's original Blender scene were preserved. The [MCP rebuild record](../verification/road-to-nain-mcp.json) records versions and output hashes; scope and budgets remain unchanged.

The [verification record](../VERIFICATION.md) records completed checks and representative images; [PLAYTEST.md](../PLAYTEST.md) provides full journeys and portable v7 fixtures. Human editorial/pacing, physical accessibility, Safari/iOS/Android and sustained hardware performance remain external review items identified above.
