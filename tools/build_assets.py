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
if sys.argv[1:] not in ([], ['--inspect-road'], ['--inspect-galilee'], ['--inspect-lake'], ['--inspect-connection'], ['--capernaum'], ['--inspect-capernaum']):
    sys.exit('Usage: build_assets.py [--inspect-road | --inspect-galilee | --inspect-lake | --inspect-connection | --capernaum | --inspect-capernaum]')
script = 'capernaum.py' if '--capernaum' in sys.argv else 'inspect_capernaum.py' if '--inspect-capernaum' in sys.argv else 'inspect_connection.py' if '--inspect-connection' in sys.argv else 'inspect_crossing.py' if '--inspect-lake' in sys.argv else 'inspect_galilee.py' if '--inspect-galilee' in sys.argv else 'inspect_road.py' if '--inspect-road' in sys.argv else 'generate_kit.py'
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
