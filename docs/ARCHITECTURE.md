# Architecture

A static Vite application using strict TypeScript, Babylon.js, native HTML/CSS, and IndexedDB through `idb`. No account flows, runtime APIs, remote model URLs, or generated conversations.

```text
src/main.ts             Composition, lifecycle, serialized save queue
src/game/              Serializable state, pure transitions, bounded A*
src/content/           Region placements, collision footprints, authored story
src/scene/             Rendering, camera, input, movement, optional audio
src/ui/                Event-driven interface and accessible menus
src/persistence/       Save validation, migrations, IndexedDB slots
public/assets/models/  Shipped GLBs loaded relative to the deployment base
tools/blender/         Deterministic source asset recipe
assets/source/         Blender workshop source
tests/                 Unit invariants and production-browser flows
```

UI actions dispatch explicit events. `transition` alone governs quest progress and ignores repeated or invalid actions. Scene meshes identify interactions but cannot grant rewards. Content selects conversations from the current state. Imported saves never supply executable markup.

## Movement and lifecycle

A one-meter walk grid includes building clearance. Eight-neighbor A* uses an octile heuristic and prevents diagonal corner cutting. Interactions approach a reachable cell before opening dialogue. Keyboard movement checks both axes on diagonal steps. Tests verify reachability of every authored destination.

ArcRotateCamera owns orbit and zoom. Input clears on blur, modal opening, and movement cancellation. Menus pause movement and play time. Slow frames are consumed in steps of at most 50 ms to preserve movement speed without obstacle-skipping. At most 250 ms is consumed per frame; longer suspension gaps are discarded. This is a lightweight bounded-step simulation, not a deterministic replay engine.

The traveler GLB contains a looping `Walk` clip on four rigid limb pivots. The simulation samples the clip only while moving; pausing or reduced motion resets the pose. Pooled gold route markers show the active walking path and clear on arrival, keyboard movement, or pause.

The scene loads 18 GLBs with four concurrent requests and owns asset disposal. Terrain, paths, docks, and water are procedural. Low quality disables shadows and reduces render resolution. Reduced motion removes bobbing and ripple animation. Sound is optional and begins after a user gesture.

## Persistence

Database `the-way-journeys` contains `saves` and `preferences`. Database layout version 1 is separate from save envelope version 3. One autosave and three manual slots are supported. Serialized writes prevent older snapshots from overtaking new events. Autosave occurs after story events, every 20 seconds of active play, and when the page becomes hidden. Last-moment browser shutdown writes are not guaranteed.

```json
{
  "version": 3,
  "region": "capernaum",
  "savedAt": "2026-09-08T00:00:00.000Z",
  "state": {
    "position": { "x": -1, "z": -3 },
    "quest": "not-started",
    "inventory": [],
    "discoveries": [],
    "villageStory": "not-started",
    "journal": ["arrival"],
    "playTime": 0
  }
}
```

The initial v1 migration supplies the region and missing discoveries/play time. The v2-to-v3 migration adds `villageStory: "not-started"` while preserving all chapter progress and discoveries. Ezra’s optional story progresses independently through `not-started`, `exploring`, and `complete`; completion requires all three discoveries and adds a final journal memory. Earlier discoveries count. Future versions are refused. Invalid enums, coordinates, duplicate IDs, incomplete journal records, impossible inventory, and files over 128 KB are rejected. Restored positions are checked against current walkability. If IndexedDB cannot open, memory slots and export remain available with a visible warning. Write failures never claim a durable save.

Only Capernaum is implemented. Future regions need a registry, explicit travel transition, asset unloading, and a save migration before changing the fixed region ID. Offline caching and streamed regions are deferred.
