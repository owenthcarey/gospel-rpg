# Asset production

The 62 checked-in GLBs are ready to use. Blender is needed only for rebuilding. The episode kit was built and inspected through Blender MCP using **Blender 5.2.1 LTS**. No external models, textures or generation services are required.

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

- Twelve skinned actors: traveler, Simon, Miriam, Jesus, village neighbor, James, John, Hannah, Amos, Ruth, a bearer and the healed man. Ezra uses the neighbor model.
- Shared twelve-bone rig, with rigid per-part weights that preserve the chunky silhouettes. Named clips: `Idle`, `Walk`, `Carry`, `Gesture`, `Sit`, `Row`, `Haul`, `Kneel`, `Recline`, `Rise`, `MatCarry`, `Use`, `PickUp`, `PutDown`, `Repair`, `SitDown`. Blender NLA tracks export each clip; Babylon samples them independently per actor. This is skeletal animation with deliberately restrained deformation, not cloth simulation.
- Every actor exports `carry_socket`; the traveler uses it for baskets, jugs, tools and the sewing pouch. The boat exports `seat_front`, `seat_middle`, `seat_back`, `net_socket`, `oar_left`, and `oar_right` attachment transforms.
- Separate oar, empty/full basket, folded/cast/full net, bread bundle, mooring coil and landing mat models support persistent interactions and staged scenes.
- The original houses, market, three tree types, boat, net rack, crate, amphora, reeds, rock and well remain in the kit.

`src/content/assets.ts` is the shipped manifest; `src/content/inventories.ts` composes exploration inventories from regional layout, actors and activity props. An actor's visual wrapper compensates for Blender's forward direction after Babylon's left-handed glTF conversion. Boat and prop orientation must be checked separately; do not apply the actor correction to every model.

## Verify and hand off

```sh
npm run test -- tests/unit/assets.test.ts
```

Tests inspect every GLB for local buffers, expected model structure, bounds and geometry budgets. Actor checks cover skins, joints/weights, all sixteen clips and their animated values; attachment names are checked on actors and boats. The full kit must stay under 5 MiB, actors under 5,000 triangles each and props under 10,000.

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
