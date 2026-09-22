# Asset production

The 94 checked-in GLBs are ready to use. Blender is needed only for rebuilding. The chapter kits were produced and inspected through Blender MCP with **Blender 5.2.1 LTS**. The Road to Nain workshop and eleven affected exports were recreated through MCP after restoring its addon connection; see the [rebuild record](verification/road-to-nain-mcp.json). No external models, textures or generation services are required.

`tools/blender/generate_kit.py` creates a separate workshop scene, preserves unrelated scenes, and writes only the workshop and its dependencies to `assets/source/galilee-kit.blend`. `rigging.py` supplies character skeletons and clips. Geometry uses meters, flat shading and matte materials, applied mesh transforms, selected-object export, and glTF Y-up coordinates.

## Rebuild

```sh
npm run assets:build
# For a nonstandard Blender location:
BLENDER_BIN=/path/to/blender npm run assets:build
```

The recipe uses Blender 4.2+ APIs; the checked-in exports were verified with 5.2.1. Rebuilding with another version requires the asset tests and visual checks below.

Via Blender MCP's Python execution tool:

```python
import os, sys, importlib
os.environ['GOSPEL_RPG_ROOT'] = '/absolute/path/to/gospel-rpg'
sys.path.insert(0, os.path.join(os.environ['GOSPEL_RPG_ROOT'], 'tools/blender'))
import rigging
importlib.reload(rigging)  # Pick up edits in an already-running Blender session.
recipe = os.path.join(os.environ['GOSPEL_RPG_ROOT'], 'tools/blender/generate_kit.py')
exec(compile(open(recipe).read(), recipe, 'exec'))
```

## Model contracts

- Fifteen skinned actors: traveler, Simon, Miriam, Jesus, village neighbor, James, John, Hannah, Amos, Ruth, a bearer, the healed man, a widow, a young man and Leah. Ezra uses the neighbor model; Tamar, Neri and Adina reuse Ruth, Amos and Hannah.
- Shared twelve-bone rig, with rigid per-part weights that preserve the chunky silhouettes. Named clips: `Idle`, `Walk`, `Carry`, `Gesture`, `Sit`, `Row`, `Haul`, `Kneel`, `Recline`, `Rise`, `MatCarry`, `Use`, `PickUp`, `PutDown`, `Repair`, `SitDown`. Blender NLA tracks export each clip; Babylon samples them independently per actor. This is skeletal animation with deliberately restrained deformation, not cloth simulation.
- Every actor exports `carry_socket`; the traveler uses it for baskets, jugs, tools and the sewing pouch. The boat exports `seat_front`, `seat_middle`, `seat_back`, `net_socket`, `oar_left`, and `oar_right` attachment transforms.
- Separate oar, empty/full basket, folded/cast/full net, bread bundle, mooring coil and landing mat models support persistent interactions and staged scenes.
- The original houses, market, three tree types, boat, net rack, crate, amphora, reeds, rock and well remain in the kit.

`src/content/assets.ts` is the shipped manifest; `src/content/inventories.ts` composes exploration inventories from regional layout, actors and activity props. An actor's visual wrapper compensates for Blender's forward direction after Babylon's left-handed glTF conversion. Boat and prop orientation must be checked separately; do not apply the actor correction to every model.

## Verify and hand off

```sh
npm run test -- tests/unit/assets.test.ts
```

Tests inspect every GLB for local buffers, expected model structure, bounds and geometry budgets. Actor checks cover skins, joints/weights, all sixteen shared clips, each actor’s declared specialized clips and their animated values; attachment names are checked on actors and boats. The full kit must stay under the RFC-009 allowance of 5.5 MiB, actors under 5,000 triangles each and props under 10,000.

Inspect the Blender viewport and the actual Babylon view. Check front direction, feet, seated/kneeling height, carried basket, readable net silhouettes, both graphics settings and reduced motion. Phone captions must leave the action visible. Screenshot fixtures exercise lowering, abundance, partners, astonishment and calling on desktop and phone layouts.

Keep geometry near the origin and update collision footprints with changed environment dimensions. Commit the recipe, source `.blend`, and derived GLBs together. Workshop object numbering can vary with other open scenes; reproducibility means the same asset contracts and geometry, not byte-identical Blender metadata. Record external licenses in `CREDITS.md` before adding external assets.

## Through the Roof kit

RFC-002 introduced a **53-GLB kit: 12 actor variants and 41 props**. `neighborhood.py` extends the shared workshop with Hannah, Amos, Ruth, a bearer and the healed man; modular walls, doorways, roof panels and opening; gate and exterior steps; oven, tables, benches, stool and shelves; jug, bread basket, handcart, removable handle, mats and flour sack. All are original procedural geometry produced and inspected through Blender MCP in Blender 5.2.1 LTS.

The rig adds `Recline`, `Rise`, `MatCarry`, and `Use` to the original eight clips. Reclining/rising is a restrained whole-body pose; the carried mat uses the existing attachment socket. The four bearer instances remain distinct in the presentation. Babylon staging supplies the ropes and vertical lowering motion; the gameplay checkpoint never depends on animation finishing.

Static meshes now export a single white material with the original palette baked into `COLOR_0`. This keeps repeated props to one material group. Runtime mesh clones share geometry and materials; see the rendering correction below. Actor skins remain separate. Tests require that every static model has one primitive and vertex colors, preventing an all-white export caused by a disconnected Blender vertex-color shader node.

That milestone’s kit was approximately **3.23 MiB**, below the unchanged 5 MiB limit. Every actor remains below 5,000 triangles and every prop below 10,000. The source `.blend`, recipes and derived exports are delivered together. Visual checks cover the modular rooms, supplies, moving companion, lowered mat, standing man, carried mat, both graphics levels and phone captions. The model dimensions and architecture are artistic interpretations, not archaeological measurements.

## Living Capernaum kit

`life.py` adds nine original props: a blue-edged sewing pouch, a thread clue, mending cloth with paired stitches, lashing cord, a wooden brace, loose/lashed/braced benches and loose bench pieces. The complete kit is **62 GLBs: 12 actors and 50 props**, totaling **4,125,896 bytes (3.93 MiB)**. The largest actor has 544 triangles; the largest prop has 2,320. No asset budget was increased.

The shared rig adds four finite clips to all twelve actors. `PickUp` and `PutDown` bend and reach; `Repair` uses both arms; `SitDown` lowers onto the half-meter seat, rests and stands. The runtime samples them using simulation time, stops after one pass, and restores the appropriate idle or held pose. A stationary held object samples `Carry` at its starting frame; walking advances that clip. The seated player’s temporary offset is cosmetic and does not change saved navigation position.

The workshop and exports were rebuilt using Blender MCP in 5.2.1 LTS. The original static exports were retained where geometry was unchanged. `inspect_life.py` independently imports the shipped GLBs into an isolated review scene and renders a pose/prop sheet without overwriting the workshop:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python tools/blender/inspect_life.py
```

The script accepts `GOSPEL_RPG_ROOT` and `GOSPEL_REVIEW_OUTPUT` for alternate input/output paths. Inspect [the exported prop and pose sheet](verification/living-capernaum-kit.png) alongside the actual game; it checks the pouch socket, clue details, bench variants and sitting height.

### Static scenery correction

Hardware instances created from off-scene asset-container sources could stop drawing when High shadows were disabled. Actors and terrain still drew, hiding the failure from aggregate geometry checks. The runtime now creates mesh clones with shared geometry/materials and independent render lifecycles. F3 reports placed, enabled and recently drawn meshes per asset. The software-rendered image regression also injects invisible static GLBs and requires that damaged scene to fail the reference comparison. Required-object checks cover all six regions at both quality levels.

## Road to Nain kit

`road.py` adds seven props and two actors: a town gate, terrace wall, spring marker, terrace marker, farm shelter, split olive, open procession frame, widow and young man. The full kit is **71 GLBs: 14 actors and 57 props**, totaling **4,951,908 bytes (4.72 MiB)**. All existing geometry is retained, and only the two existing actors that gained specialist clips require changed GLBs. The town gate has weathered stone courses on both faces so the detail remains visible when approaching and leaving it.

The sixteen shared clips remain on every actor. Only the young man exports `SitUp`, only the bearer exports `FrameCarry`, and only Jesus exports `TouchFrame`. The carry/touch poses place hands against the frame’s long rails; the Nain composition holds it 0.84 m above the ground. The sitting-up clip and scene root offset keep the pelvis supported, with legs resting along the frame. Reduced motion selects an established still composition. These are restrained authored poses, not physics or cloth simulation.

The Nain standing compositions and Neri's walk explicitly account for the imported skins facing −Z after the existing actor wrapper. Reclining and seated root poses are calibrated independently. `tests/unit/nain-staging.test.ts` imports the shipped GLBs with Babylon, samples the real deformed skins and measures contact with the frame rails for all eight bearer hands and Jesus's right hand. Blender appearance alone did not catch the reversed runtime orientation; both views are required.

Inspect the shipped models in an isolated Blender scene:

```sh
npm run assets:inspect:road
```

`inspect_road.py` produces a [kit sheet](verification/road-to-nain-kit.png), [frame-contact view](verification/road-to-nain-contact.png), [three sitting-up poses](verification/road-to-nain-poses.png) and [byte inventory](verification/road-to-nain-assets.json). It accepts the same root/output environment variables as the earlier inspection script and can also be executed through Blender MCP. It imports the exported GLBs rather than inspecting only source geometry. The `.blend`, recipe and GLBs are delivered together.

The initial CLI fallback has been replaced. After Blender was reopened, enabling the installed addon and connecting its server restored native MCP access (addon 1.6, protocol 5). MCP rebuilt the full isolated workshop, exported and independently imported the models, rendered the three review sheets, and installed the nine new assets plus the bearer and Jesus clips. The other sixty prior MCP exports remain unchanged. Live review prompted the gate detailing correction. The [rebuild record](verification/road-to-nain-mcp.json) includes hashes for the installed exports, recipes, source and review images. The original Blender scene was preserved. Asset contracts and acceptance budgets are unchanged.

## Living Galilee kit

`galilee.py` adds Leah and seven functional props: straight and bent channel sections, receiving basin, wooden scoop, supply rack, woven mat and reed screen. The complete kit contains **79 GLBs: 15 actors and 64 props**, totaling **5,230,036 bytes**, below the unchanged **5,242,880-byte** cap. Leah shares all sixteen established clips. The three specialist Nain clips remain confined to their original actors. No external assets or licenses were added.

The models and isolated workshop were generated through Blender MCP. Review corrected overlapping channel beds, blocked elbow corners, basin inlets and Babylon handedness. Unchanged historical exports retain their prior bytes; rebuilt metadata need not be identical. Original procedural recipes and the workshop remain the source of all geometry.

```sh
npm run assets:inspect:galilee
npm run test -- tests/unit/assets.test.ts tests/unit/galilee-staging.test.ts
```

`inspect_galilee.py` independently imports the shipped GLBs, preserves unrelated scenes, and produces a [kit sheet](verification/living-galilee-kit.png), [connected-channel sheet](verification/living-galilee-channel.png), [resting-place sheet](verification/living-galilee-rest.png) and [hashed byte inventory](verification/living-galilee-assets.json). The same script can run through Blender MCP with `GOSPEL_RPG_ROOT` set. `GOSPEL_REVIEW_OUTPUT` selects another output directory.

The functional channel basis is north/east in game coordinates. Babylon reflects the static import's X axis: bent pieces receive a quarter-turn basis correction before applying the saved turn, and receiving basins face west after a half-turn. Every rendered opening is measured against the solver in tests. Water follows only tested ports and connects through the basin's low inlet. The screen uses authored north/east/south/west sockets; its footprint updates navigation. Mat, jar and screen previews disappear as supplies are placed. Completed travelers use the existing seated/kneeling clips, leaving real companions untouched.

Carried mats/screens are reduced to 42% presentation scale, and the screen rests lower in the grip. A scoop tilt and forward offset keep it readable. Imported skin/prop tests measure hand reach for all four new carried items. These restrained silhouettes are illustrative rather than cloth, water or contact physics. The player blends clip transitions over 0.16 seconds; specialist Gospel poses retain exact sampling.

## Across the Lake kit

`crossing.py` adds five original props: `landing_pier`, `reed_bank`, `split_rock`, `cove_headland` and `boat_cushion`. The full kit has **84 GLBs: 15 actors and 69 props**, totaling **5,128,144 bytes** against the original **5,242,880-byte** cap. The boat, oars, Row/Recline clips and existing shore furniture are reused. Scene-owned fitted seat/platform meshes provide measured support without changing the earlier boat model. Blender MCP generated the workshop and new exports; no downloaded assets or new external licenses were introduced.

`compact_glb.py` reduced the prior 79 models from 5,230,036 to 5,015,744 bytes by sharing identical buffer views, accessors and animation samplers. It verifies resolved mesh attributes, indices, skins, channels, samples, sockets and materials before writing a smaller file. The [baseline comparison](verification/across-the-lake-compaction.json) records exact conservation across all 79 old models. Historical actor bytes change, but their decoded model contracts do not. New-region inventories each remain below 2.5 MiB.

```sh
npm run assets:inspect:lake
npm run test -- tests/unit/lake-staging.test.ts tests/unit/lake.test.ts tests/unit/assets.test.ts
```

The inspection command first imports the actual GLBs through Babylon's loader in geometry tests, then passes the posed meshes to Blender for a matching coordinate review. `inspect_crossing.py` separately imports the five shipped kit GLBs and renders the [kit](verification/across-the-lake-kit.png), [rower](verification/across-the-lake-rower.png) and [stern](verification/across-the-lake-stern.png). It preserves unrelated scenes. For MCP execution, set `GOSPEL_RPG_ROOT` and `GOSPEL_LAKE_POSES`; generate the latter with `LAKE_REVIEW_OUTPUT=/private/tmp/lake-poses.json npm run test -- tests/unit/lake-staging.test.ts`. `GOSPEL_REVIEW_OUTPUT` can redirect the images. The [inventory](verification/across-the-lake-assets.json) and [contact measurements](verification/across-the-lake-contact.json) accompany the review.

The first review found detached oar grips and a sleeping figure facing away from the cushion in Babylon. Oars now follow the actual exported forearm tips throughout the stroke. The ordinary rower's pelvis meets a fitted seat, with soles at the hull floor. Its waterline keeps the flat exploration water below the interior floor, including while berthed. A corrected stern orientation, platform and scaled cushion support the sleeping figure, while the disciples remain clear of the reclining body. Boat clearance around rocks was enlarged to account for the hull, and visible banks sit beyond the navigable center boundary. These are deliberate staged contacts, not a rigid-body or cloth simulation.

## A Connected Journey kit

RFC-007 adds `passage_marker` and refines `landing_pier` with shallow side strips and pale post caps, keeping both boarding ends open. `connection.py` is an original procedural recipe in the shared isolated workshop. No external assets or generation services are involved. The final **85 GLBs (15 actors, 70 props)** total **5,152,636 bytes**, leaving **90,244 bytes** under the unchanged **5,242,880-byte** cap. The marker is 15,412 bytes; the refined pier is 31,344 bytes. Only those two shipped exports changed; all 83 other GLBs retain their previous bytes.

Land gateways place the marker beside their approach, using a 0.60 × 0.56 m collision footprint checked against imported geometry. Markers become visible with their passages and are included in the local inventory. They are an original game wayfinding convention, without claims about historical sign systems. No markers are placed in navigable water. The return gathering reuses village actors; existing bench seating remains conditional on its separate repair story.

`npm run assets:inspect:connection` runs contact/placement tests, bakes actual Babylon poses and imports them alongside the final marker/pier GLBs in a separate Blender review scene. The implementation used the connected Blender MCP addon for both workshop generation and independent inspection. [Review evidence](verification/connected-journey-assets.json) records source, recipe, model and image hashes. The [kit](verification/connected-journey-kit.png), [holding](verification/connected-journey-holding.png), [seated neighbor](verification/connected-journey-seated.png), [working pose](verification/connected-journey-working.png) and [return company](verification/connected-journey-company.png) are review renders; browser images in the verification record show the actual gameplay composition.

For MCP inspection, first generate the pose JSON with `CONNECTION_REVIEW_OUTPUT=/absolute/path/poses.json npx vitest run tests/unit/connection-staging.test.ts`, set `GOSPEL_RPG_ROOT` and `GOSPEL_CONNECTION_POSES` in Blender, then execute `tools/blender/inspect_connection.py`. `GOSPEL_REVIEW_OUTPUT` can redirect evidence. Generation and inspection preserve unrelated open scenes and never save them into the workshop.

The completed original shore exposed an existing cost from individually submitted procedural scenery. Its same-material footpaths, small path stones, jetty planks/posts and distant hills now merge into static scene-owned meshes. This retains their geometry and materials while reducing submissions in both quality modes. Actors and exported GLBs retain independent scene-owned clones; the earlier hardware-instance rendering correction remains intact.

## RFC-008 interaction refinements

Blender MCP rebuilt the isolated workshop and refined four existing props: `channel_straight`, `channel_bend`, `water_basin` and `reed_screen`. Inset bands mark actual channel openings without obstructing the water bed. A woven crest and unequal knots face the resting seat and make the screen's orientation visible. The other 81 shipped GLBs retain their previous bytes; no external assets or services were used.

The 85-model kit now totals **5,161,668 bytes**, leaving **81,212 bytes** under the unchanged 5 MiB limit. The twelve-bone character rig, shared clips, triangle caps and explicit region inventories are unchanged. The browser draws the temporary proposal as a broken outline at the authoritative supply socket; it is not a new downloaded model and cannot change collision or saved placement.

[Independent final GLB review](verification/rfc008/README.md) includes the channel composition, resting arrangement and asset-kit render. The JSON asset record hashes every shipped GLB. The actual Babylon geometry tests retain their port/solver, carrying-contact, footing, placement and collision assertions, with added viewport, preview isolation and resource-disposal coverage.

## Capernaum craft kit · RFC-009

Nine original static exports add worn quay stones, a crossing plank, net-working trestle, doorway awning, herb planter, bread board, stone threshold, mooring bollard and wall footing. `tools/blender/capernaum.py` owns an isolated workshop saved in `assets/source/capernaum-kit.blend`. It restores the previous Blender scene even after a failed export. The complete build includes this recipe; a focused rebuild touches only its nine exports:

```sh
npm run assets:build:capernaum
npm run assets:inspect:capernaum
```

MCP generation and independent shipped-export review used Blender 5.2.1 LTS. Set `GOSPEL_MODEL_OUTPUT` explicitly when using an existing Blender process: a previous review session may have set a temporary output directory. The review script also imports actual Babylon posed geometry for both crossing arrangements and ordinary work. [Selected delivery images and SHA-256 hashes](verification/rfc009/README.md) are committed for review. Regenerating the full seven-image review writes to ignored `artifacts/capernaum-review/`; set `GOSPEL_REVIEW_OUTPUT` to override that destination. Copy only selected, reviewed evidence into the delivery directory and update its manifest. No historical GLB was changed.

The nine models add **228,424 bytes**, bringing 94 GLBs to **5,390,092 bytes** (about 5.14 MiB), below the explicit 5.5 MiB catalog cap. Per-region increases are 159,504 bytes at the shore, 116,116 in the lanes, 188,696 in the gathering house and 120,976 in the bakehouse. Each is below 192 KiB. Other region inventories and download bytes are unchanged. The gathering house's increase includes the existing ordinary-neighbor actor; it does not use a departed Gospel figure as ambient company.

Static batching is opt-in, per asset and limited to unpickable, unanimated opaque decorations. Shore rocks and repeated new stonework use it. Dynamic cargo, actors, boats and cutaway objects retain independent roots. Draw callbacks remain attached to merged meshes, so diagnostics still distinguish enabled geometry from actual draws. The clone-based loader and four-request limit remain.

The visible front of the final imported actor wrapper is **−Z**. `Actor.face` and walking use the corresponding half-turn; the traveler uses the same convention. Previously compensating Road/Nain callers no longer apply a second correction. Fixed authored presentation rotations and all exported rigs remain unchanged. Actual posed-hand projection tests cover four directions; seated neighbors use a 0.14 m lift and imported geometry checks cover feet and working-hand contact.
