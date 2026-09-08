# Asset production

Checked-in GLBs are ready to use. Blender is only required for rebuilding.

The original kit was generated through Blender MCP on port 9876 using Blender 5.2.1 LTS. The recipe creates a separate workshop scene, preserves existing scenes, and writes only the workshop and its dependencies to the `.blend`, preserving other open scenes without including them in the shipped source. Assets use meters, applied transforms, flat shading, matte materials, and glTF's Y-up export. Babylon uses left-handed coordinates.

Rebuild with Blender 4.2+:

```sh
npm run assets:build
# For a nonstandard Blender location:
BLENDER_BIN=/path/to/blender npm run assets:build
```

Via Blender MCP's Python execution tool:

```python
import os
os.environ['GOSPEL_RPG_ROOT'] = '/absolute/path/to/gospel-rpg'
recipe = os.path.join(os.environ['GOSPEL_RPG_ROOT'], 'tools/blender/generate_kit.py')
exec(compile(open(recipe).read(), 'generate_kit.py', 'exec'))
```

The 18 models include two houses, market canopy, three tree types, fishing boats, nets, crates, amphorae, reeds, rocks, well, and five figures. The traveler has a rigid hierarchy with separate body, arm, and leg meshes and a looping `Walk` clip exported from Blender NLA tracks. Babylon samples this clip during movement and restores the rest pose when paused or reduced motion is enabled. The other figures are static; skeletal animation remains future work.

Keep geometry near the origin, export only selected objects, avoid remote textures, and inspect front orientation after coordinate conversion. Update collision footprints with building dimensions. Review both graphics settings. Commit the recipe, source `.blend`, and derived GLBs together. Use Git LFS if later binary sources become large. Record external asset licenses in `CREDITS.md` before inclusion.

For a traveler-only GLB rebuild, set `GOSPEL_RPG_TRAVELER_ONLY=1` before running the recipe. This still refreshes the workshop source. Exports are restricted to the active scene and selected asset so geometry from another open scene cannot enter a shipped model. The asset test checks the traveler hierarchy and four animated limbs.
