# The Way

**A quiet adventure through first-century Galilee.**

A single-player browser RPG inspired by the Gospels. The first chapter, **Into the Deep**, begins in an original low-poly Capernaum: help prepare the shore, witness a narrated dramatization of the catch and calling in Luke 5:1–11, then return to the village and choose a memory for the road. The traveler, errands, and connective dialogue are imagined; scripture is clearly identified and referenced.

Chapter II, **Through the Roof**, continues some days later in an explorable Capernaum neighborhood. Enter the gathering house to witness Mark 2:1–12, walk with Amos, and help Hannah prepare a table for neighbors. The optional stories preserve your choices and can be played before or after the account. **Living Capernaum** adds Ruth’s missing-pouch investigation and a choice of repairs for the landing bench, with lasting changes to the village.

**Beyond Capernaum — The Road to Nain** continues after Chapter II with an explorable Galilean road, roadside farm and town gate. Follow Tamar’s landmark investigation, walk across regions with Neri, and witness **At the gate**, a six-scene presentation of Luke 7:11–17.

**Living Galilee** makes those places useful to revisit: restore a working water channel beside the road, then help Leah arrange a resting place at the farm. Both original adventures offer alternate solutions, recoverable supplies and lasting visible results.

**Across the Lake** opens after Chapter III: steer an ordinary boat between Capernaum and two new shores, investigate **A sheltered way** with Joel, and witness Chapter IV, **Peace, be still** (Mark 4:35–41). The navigation adventure is optional; neither steering nor story choices determine the Gospel account.

**A Connected Journey** joins those places together. Save a destination across several regions, return with an accurate journey recap, and revisit any completed Gospel scene without changing your traveler’s progress. After Chapter IV, **The way home** offers three original return encounters with Leah, Hannah and Miriam, followed by a closing reflection. Earlier unfinished stories remain available.

Built with **TypeScript · Babylon.js · Vite · Blender · IndexedDB**. Entirely client-side, with no account, backend, analytics, or runtime-generated dialogue.

## Play locally

Requires **Node 22.13+ (22.x) or 24+** and a browser with **WebGL 2**. Blender is only needed to rebuild assets.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. Select **Begin your journey**, then speak with **Simon** or select **Follow the path**. After the opening net-and-bread errand, return to Simon to begin **Into the Deep**. Existing completed saves can continue here immediately. Speak with **Ezra** or open the journal for **An ordinary morning**, an independent village story. The episode is unhurried: lake scenes advance when you choose, and can be paused, left and resumed, or finished with a summary.

| Control                                 | Action                                   |
| --------------------------------------- | ---------------------------------------- |
| Click/tap ground or water               | Walk or steer around obstacles           |
| Click a name / choose a map destination | Approach and interact                    |
| WASD / arrow keys                       | Move relative to the camera              |
| E                                       | Interact nearby                          |
| Right-drag / two fingers                | Orbit                                    |
| Scroll / pinch / zoom buttons           | Zoom                                     |
| Q / rotate buttons                      | Rotate                                   |
| R                                       | Reset camera                             |
| J / I / M                               | Journal / satchel / map                  |
| Escape                                  | Pause or close a menu                    |
| Cancel walk                             | Clear the approach and saved destination |
| Resume route                            | Continue toward the saved destination    |

## Playable chapters

- **The way home:** revisit Leah, Hannah and Miriam in any order after Chapter IV, remember what the journey meant to your traveler, and choose a closing reflection. Unfinished stories and every region remain open.
- **Across the Lake:** steer or use map routes, dock explicitly at the reed landing and sheltered cove, then reboard and return. The boat remembers its berth or exact saved position and heading.
- **Peace, be still:** seven complete Gospel scenes, full Mark 4:35–41 transcript, three aftermath visits and three equal reflections.
- **A sheltered way:** study reeds and split rock in either order, compare interpretations, use graduated hints, find the sheltered landing and return to Joel with either memory.

- **A spring for travelers:** inspect and clear the channel, rotate its physical sections, test water through either connected route, and choose a memory. Readable plans and optional graduated hints support exploration.
- **Room under the olives:** inspect two sites, carry and place a mat, water and screen, leave an open approach, and welcome company. Supplies can be recovered or returned before completion.
- **At the gate:** six user-paced Gospel scenes, three aftermath visits and an equal choice of reflections; three new exploration regions, gentle slopes and a connected journey map.
- **Two independent road adventures:** compare physical landmarks with Tamar’s recollection, or choose a shaded or terrace route with Neri. Evidence, hints, endings and the companion’s actual region and position persist.
- **Through the Roof:** eight narrated Gospel scenes, three aftermath visits and a chosen reflection; explorable lanes and two enterable buildings.
- **Four independent neighborhood stories:** investigate Ruth’s missing sewing pouch, repair the landing bench with cord or a brace, choose a walking route with Amos, or a table location with Hannah; carry bread and water, clear a passage, and return to visible results.
- **A complete catch-and-calling episode:** shoreline preparation, ten narrated lake scenes, return, aftermath conversations and three remembered reflections.
- **85 original Blender assets**, fifteen skinned character variants, sixteen shared clips and three specialized procession clips, including walking, carrying, sitting, rowing, hauling and kneeling. Passage markers and refined landing edges help identify deliberate crossings.
- A compact nearby-action tray for practical tasks, distinct pick-up/put-down/repair/sit motions, stationary holding, persistent repaired benches and seated table company.
- A journal organized into **Stories, People, Places, and Memories**, with story/status filters, investigation evidence, destinations, a journey recap and a completed-account replay library.
- A visible carried basket, placed supplies, mooring work, gathering neighbors, moving boats, staged nets and cargo, and a changed shore after the fishermen depart.
- The original prelude, Ezra's independent village story, three discoveries, additional shoreline observations, selectable story tracking, satchel, journal and navigable map.
- User-paced captions with scripture provenance, full transcript, pause, checkpoint resume and finish-with-summary controls. Your imagined traveler remains on shore during the narrated lake views.
- Autosave, three manual slots, JSON export/import and **v10 migration from v1–v9 saves**, including interrupted scenes, routes, return encounters and replay cursors.
- Persistent destinations across land and lake: menus retain your route, manual movement leaves it resumable, and each gateway, boarding and docking action remains deliberate.
- Replay all **31 scenes** from completed Gospel accounts, with previous/next, transcript, pause, scene selection and exact return to your saved traveler, supplies, companions and boat.
- Compact phone objectives, standard/large reading sizes, readable captions, keyboard focus management, reduced motion, lower graphics settings and optional ambience.
- Welcome and save controls open before any models download; continue/import load the saved region directly with retry.
- Saved full/restrained exploration guidance, explicit walk cancellation, placement guides, and camera cutaways for obstructing trees.
- Transactional region loading with retry, explicit regional asset inventories and a local F3 rendering snapshot with object visibility counts.

Progress is stored in this browser. Use **Settings → Export** to change devices or keep a backup before clearing browser data. If storage is unavailable, the game provides session slots and export for the current session.

After completing Into the Deep, follow **The road into Capernaum** or track Chapter II in the journal. Use the local map to find entrances. **Walk with Amos** guides a companion walk at a shared pace; if you leave him, the map locates him again. Carry one object at a time, and use the satchel’s return-point guidance to put it down. Speak with **Ruth** for **A familiar thread**, or inspect **The landing bench** on the shore for **A place to rest**. Both unlock after Into the Deep; neither gates the Gospel account. Simple tasks appear in the **Within reach** tray after you approach and close the reading panel.

After completing Through the Roof, take **The road beyond Capernaum** from the lanes. Tamar waits near the road’s southern end; Neri waits at the farm. Choose **Map → Journey map** for connected places and **Find Neri** to regroup. At a route gateway, reach its meeting point together before continuing. Both new adventures are optional; you can go directly to the Nain account.

At **The spring channel**, restore water to either basin. At the farm, speak with **Leah** to prepare **Room under the olives**. Both unlock after Chapter II and can be interrupted at any point. Carry one supply at a time; return placed supplies to the rack to relocate the resting place before completing it. Choose **Settings → Exploration guidance** for fewer distant markers.

After completing At the gate, return to Capernaum and approach **Board for the lake**. Joel offers the optional landmark story. Steer with the same controls as walking, or choose any named landing/landmark on the local map. Approach a landing, choose **Dock and step ashore**, and use **Board the boat** to return. A carried item stays in its existing slot and appears stowed aboard while rowing. At the cove, approach **A view over the lake** for Chapter IV. The journal keeps your observations, hints and unfinished work.

After your Chapter IV reflection, open **Journal → The way home**. Visit **Room on the road**, **A shared table** and **The familiar landing** in any order, then return to Miriam for a closing reflection. Your choices acknowledge only work and memories you actually completed. The world remains open afterward.

Use **Journal → Replay Gospel scenes** to revisit a completed account. Replay has its own saved reading place; it leaves the ordinary journey unchanged. **Journey recap** gathers your last memory, unfinished stories, carried object, waiting companions and saved route. Continue shows a compact recap before loading. A restored route waits for **Resume route**; it never moves the traveler on its own.

This delivers four bounded Gospel chapters, ten optional stories and an optional closing interlude. More of Galilee/Judea, unrestricted sailing, offline caching and full device/accessibility review remain ahead. See the [roadmap](docs/ROADMAP.md), [current milestone RFC](docs/rfcs/007-a-connected-journey.md), and [verification record](docs/VERIFICATION.md).

For a guided review and portable example saves, see the [playtest guide](docs/PLAYTEST.md).

## Develop and verify

```sh
npm run check             # Types, ESLint, unit tests, production build
npm run format:check      # Repository formatting
npx playwright install chromium
npm run test:e2e          # Full episode, legacy stories, migration, recovery and responsive UI
npm run preview          # Serve the production build
```

Use `npm run fixtures:connection` for portable v10 route, replay and homecoming examples, and `npm run assets:inspect:connection` to review shipped passage/landing assets and actual Babylon poses in Blender. Historical fixture and asset-review commands remain available.

Use `npm run format`, `npm run test:watch`, and `npm run assets:build` as needed. Dependencies are pinned; the lockfile is committed.

| Location                           | Responsibility                                    |
| ---------------------------------- | ------------------------------------------------- |
| `src/game/`                        | State, quest transitions, A*                      |
| `src/content/`                     | Region layout, conversations, journal             |
| `src/scene/`                       | Rendering, camera, movement, input, audio         |
| `src/ui/`                          | HTML/CSS interface, menus, map, dialogue          |
| `src/persistence/`                 | IndexedDB, validation, migrations, portable saves |
| `public/assets/models/`            | Shipped GLBs                                      |
| `assets/source/`, `tools/blender/` | Blender source and reproducible recipe            |
| `tests/`                           | Unit and browser checks                           |
| `.github/workflows/`               | Quality and automatic Pages publishing            |

- [Architecture and save format](docs/ARCHITECTURE.md)
- [Narrative and scripture guide](docs/NARRATIVE.md)
- [Blender asset workflow](docs/ASSETS.md)
- [GitHub Pages release guide](docs/DEPLOYMENT.md)
- [Original project vision](docs/VISION.md)
- [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Credits](CREDITS.md) · [Licensing](LICENSE.md)

Every push or merged pull request to `main` automatically runs **Publish to GitHub Pages**. Quality checks must pass before the tested build is deployed to [the live game](https://owenthcarey.github.io/gospel-rpg/). The workflow can also be run manually on `main`. GitHub Actions must be enabled as the repository's Pages source; see the [release guide](docs/DEPLOYMENT.md).
