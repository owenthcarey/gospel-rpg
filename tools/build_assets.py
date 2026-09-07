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
subprocess.run([blender, "--background", "--python", str(root / "tools/blender/generate_kit.py")], env=env, check=True)
