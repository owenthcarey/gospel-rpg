# Asset production

The 53 checked-in GLBs are ready to use. Blender is needed only for rebuilding. The episode kit was built and inspected through Blender MCP using **Blender 5.2.1 LTS**. No external models, textures or generation services are required.

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
- Shared twelve-bone rig, with rigid per-part weights that preserve the chunky silhouettes. Named clips: `Idle`, `Walk`, `Carry`, `Gesture`, `Sit`, `Row`, `Haul`, `Kneel`, `Recline`, `Rise`, `MatCarry`, `Use`. Blender NLA tracks export each clip; Babylon samples them independently per actor. This is skeletal animation with deliberately restrained deformation, not cloth simulation.
- Every actor exports `carry_socket`; the traveler uses it for the basket. The boat exports `seat_front`, `seat_middle`, `seat_back`, `net_socket`, `oar_left`, and `oar_right` attachment transforms.
- Separate oar, empty/full basket, folded/cast/full net, bread bundle, mooring coil and landing mat models support persistent interactions and staged scenes.
- The original houses, market, three tree types, boat, net rack, crate, amphora, reeds, rock and well remain in the kit.

`src/content/assets.ts` is the shipped manifest and per-region inventory. An actor's visual wrapper compensates for Blender's forward direction after Babylon's left-handed glTF conversion. Boat and prop orientation must be checked separately; do not apply the actor correction to every model.

## Verify and hand off

```sh
npm run test -- tests/unit/assets.test.ts
```

Tests inspect every GLB for local buffers, expected model structure, bounds and geometry budgets. Actor checks cover skins, joints/weights, all twelve clips and their animated values; attachment names are checked on actors and boats. The full kit must stay under 5 MiB, actors under 5,000 triangles each and props under 10,000.

Inspect the Blender viewport and the actual Babylon view. Check front direction, feet, seated/kneeling height, carried basket, readable net silhouettes, both graphics settings and reduced motion. Phone captions must leave the action visible. Screenshot fixtures exercise lowering, abundance, partners, astonishment and calling on desktop and phone layouts.

Keep geometry near the origin and update collision footprints with changed environment dimensions. Commit the recipe, source `.blend`, and derived GLBs together. Workshop object numbering can vary with other open scenes; reproducibility means the same asset contracts and geometry, not byte-identical Blender metadata. Record external licenses in `CREDITS.md` before adding external assets.

## Through the Roof kit

The complete shipped kit now contains **53 GLBs: 12 actor variants and 41 props**. `neighborhood.py` extends the shared workshop with Hannah, Amos, Ruth, a bearer and the healed man; modular walls, doorways, roof panels and opening; gate and exterior steps; oven, tables, benches, stool and shelves; jug, bread basket, handcart, removable handle, mats and flour sack. All are original procedural geometry produced and inspected through Blender MCP in Blender 5.2.1 LTS.

The rig adds `Recline`, `Rise`, `MatCarry`, and `Use` to the original eight clips. Reclining/rising is a restrained whole-body pose; the carried mat uses the existing attachment socket. The four bearer instances remain distinct in the presentation. Babylon staging supplies the ropes and vertical lowering motion; the gameplay checkpoint never depends on animation finishing.

Static meshes now export a single white material with the original palette baked into `COLOR_0`. This allows repeated props to instance without carrying multiple material groups. Actor skins remain separate. Tests require that every static model has one primitive and vertex colors, preventing an all-white export caused by a disconnected Blender vertex-color shader node.

The total kit is approximately **3.23 MiB**, below the unchanged 5 MiB limit. Every actor remains below 5,000 triangles and every prop below 10,000. The source `.blend`, recipes and derived exports are delivered together. Visual checks cover the modular rooms, supplies, moving companion, lowered mat, standing man, carried mat, both graphics levels and phone captions. The model dimensions and architecture are artistic interpretations, not archaeological measurements.
