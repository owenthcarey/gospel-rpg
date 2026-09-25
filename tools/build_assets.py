"""Rebuild the GLB kit with a local Blender executable; no MCP required."""
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile

root = pathlib.Path(__file__).resolve().parents[1]
blender = os.environ.get("BLENDER_BIN") or shutil.which("blender")
if not blender and sys.platform == "darwin":
    blender = "/Applications/Blender.app/Contents/MacOS/Blender"
if not blender or not pathlib.Path(blender).exists():
    sys.exit("Set BLENDER_BIN to your Blender 4.2+ executable.")
env = dict(os.environ, GOSPEL_RPG_ROOT=str(root))
def finalize(models):
    """Pure-Python passes over the whole catalog: palette packing, rest-channel pruning, sharing."""
    sys.path.insert(0, str(root / 'tools/blender'))
    from pack_palette import pack_palette
    from prune_channels import prune_channels
    from compact_glb import compact_kit
    for path in sorted(models.glob('*.glb')):
        pack_palette(path)
        prune_channels(path)
    compact_kit(str(models))


scripts = {
    '--inspect-road': 'inspect_road.py', '--inspect-galilee': 'inspect_galilee.py',
    '--inspect-lake': 'inspect_crossing.py', '--inspect-connection': 'inspect_connection.py',
    '--capernaum': 'capernaum.py', '--inspect-capernaum': 'inspect_capernaum.py',
    '--presence': 'presence.py', '--inspect-presence': 'inspect_presence.py',
}
if len(sys.argv) > 2 or (len(sys.argv) == 2 and sys.argv[1] not in scripts and sys.argv[1] != '--rfc011'):
    sys.exit('Usage: build_assets.py ['+' | '.join([*scripts, '--rfc011'])+']')
script = scripts.get(sys.argv[1], 'generate_kit.py') if len(sys.argv) == 2 else 'generate_kit.py'
with tempfile.TemporaryDirectory(prefix='the-way-lake-review-') as output:
    if '--inspect-capernaum' in sys.argv:
        poses=str(pathlib.Path(output)/'capernaum-poses.json')
        subprocess.run(['npm','run','test','--','tests/unit/harbor-staging.test.ts'],cwd=root,env=dict(env,HARBOR_REVIEW_OUTPUT=poses),check=True)
        env['GOSPEL_HARBOR_POSES']=poses
    if '--inspect-lake' in sys.argv:
        poses=str(pathlib.Path(output)/'poses.json')
        subprocess.run(['npm', 'run', 'test', '--', 'tests/unit/lake-staging.test.ts'], cwd=root, env=dict(env, LAKE_REVIEW_OUTPUT=poses), check=True)
        env['GOSPEL_LAKE_POSES']=poses
    if '--inspect-connection' in sys.argv:
        poses=str(pathlib.Path(output)/'connection-poses.json')
        subprocess.run(['npm', 'run', 'test', '--', 'tests/unit/connection-staging.test.ts'], cwd=root, env=dict(env, CONNECTION_REVIEW_OUTPUT=poses), check=True)
        env['GOSPEL_CONNECTION_POSES']=poses
    if sys.argv[1:] != ['--rfc011']:
        subprocess.run([blender, "--background", "--python", str(root / "tools/blender" / script)], env=env, check=True)

if not sys.argv[1:] or sys.argv[1] == '--rfc011':
    # Order matters: later passes replace earlier exports with the same name.
    for recipe in ['capernaum.py', 'presence.py', 'characters.py', 'vegetation.py']:
        if sys.argv[1:] and recipe == 'capernaum.py':
            continue
        subprocess.run([blender, '--background', '--python', str(root / 'tools/blender' / recipe)],
                       env=dict(env, GOSPEL_RUN_CHARACTERS='1'), check=True)
    finalize(root / 'public/assets/models')
