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
scripts = {
    '--inspect-road': 'inspect_road.py', '--inspect-galilee': 'inspect_galilee.py',
    '--inspect-lake': 'inspect_crossing.py', '--inspect-connection': 'inspect_connection.py',
    '--capernaum': 'capernaum.py', '--inspect-capernaum': 'inspect_capernaum.py',
    '--presence': 'presence.py', '--inspect-presence': 'inspect_presence.py',
}
if len(sys.argv) > 2 or (len(sys.argv) == 2 and sys.argv[1] not in scripts):
    sys.exit('Usage: build_assets.py ['+' | '.join(scripts)+']')
script = scripts[sys.argv[1]] if len(sys.argv) == 2 else 'generate_kit.py'
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
    subprocess.run([blender, "--background", "--python", str(root / "tools/blender" / script)], env=env, check=True)

if not sys.argv[1:]:
    subprocess.run([blender, '--background', '--python', str(root / 'tools/blender/capernaum.py')], env=env, check=True)

    subprocess.run([blender, '--background', '--python', str(root / 'tools/blender/presence.py')], env=env, check=True)
