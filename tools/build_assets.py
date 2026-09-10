"""Rebuild the GLB kit with a local Blender executable; no MCP required."""
import os
import pathlib
import shutil
import subprocess
import sys

root = pathlib.Path(__file__).resolve().parents[1]
blender = os.environ.get("BLENDER_BIN") or shutil.which("blender")
if not blender and sys.platform == "darwin":
    blender = "/Applications/Blender.app/Contents/MacOS/Blender"
if not blender or not pathlib.Path(blender).exists():
    sys.exit("Set BLENDER_BIN to your Blender 4.2+ executable.")
env = dict(os.environ, GOSPEL_RPG_ROOT=str(root))
if sys.argv[1:] not in ([], ['--inspect-road'], ['--inspect-galilee']):
    sys.exit('Usage: build_assets.py [--inspect-road | --inspect-galilee]')
script = 'inspect_galilee.py' if '--inspect-galilee' in sys.argv else 'inspect_road.py' if '--inspect-road' in sys.argv else 'generate_kit.py'
subprocess.run([blender, "--background", "--python", str(root / "tools/blender" / script)], env=env, check=True)
