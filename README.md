# The Way

**A quiet adventure through first-century Galilee.**

A single-player browser RPG inspired by the Gospels. The first chapter, **Into the Deep**, begins in an original low-poly Capernaum: help prepare the shore, witness a narrated dramatization of the catch and calling in Luke 5:1–11, then return to the village and choose a memory for the road. The traveler, errands, and connective dialogue are imagined; scripture is clearly identified and referenced.

Built with **TypeScript · Babylon.js · Vite · Blender · IndexedDB**. Entirely client-side, with no account, backend, analytics, or runtime-generated dialogue.

## Play locally

Requires **Node 22.13+ (22.x) or 24+** and a browser with **WebGL 2**. Blender is only needed to rebuild assets.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. Select **Begin your journey**, then speak with **Simon** or select **Follow the path**. After the opening net-and-bread errand, return to Simon to begin **Into the Deep**. Existing completed saves can continue here immediately. Speak with **Ezra** or open the journal for **An ordinary morning**, an independent village story. The episode is unhurried: lake scenes advance when you choose, and can be paused, left and resumed, or finished with a summary.

| Control                                 | Action                      |
| --------------------------------------- | --------------------------- |
| Click/tap the ground                    | Walk around obstacles       |
| Click a name / choose a map destination | Approach and interact       |
| WASD / arrow keys                       | Move relative to the camera |
| E                                       | Interact nearby             |
| Right-drag / two fingers                | Orbit                       |
| Scroll / pinch / zoom buttons           | Zoom                        |
| Q / rotate buttons                      | Rotate                      |
| R                                       | Reset camera                |
| J / I / M                               | Journal / satchel / map     |
| Escape                                  | Pause or close a menu       |

## Playable chapter

- **A complete catch-and-calling episode:** shoreline preparation, ten narrated lake scenes, return, aftermath conversations and three remembered reflections.
- **29 original Blender assets**, seven skinned character variants and eight named clips, including walking, carrying, sitting, rowing, hauling and kneeling.
- A visible carried basket, placed supplies, mooring work, gathering neighbors, moving boats, staged nets and cargo, and a changed shore after the fishermen depart.
- The original prelude, Ezra's independent village story, three discoveries, additional shoreline observations, selectable story tracking, satchel, journal and navigable map.
- User-paced captions with scripture provenance, full transcript, pause, checkpoint resume and finish-with-summary controls. Your imagined traveler remains on shore during the narrated lake views.
- Autosave, three manual slots, JSON export/import and **v4 migration from v1/v2/v3 saves**, including interrupted lake scenes and remembered choices.
- Compact phone objectives, readable captions, keyboard focus management, reduced motion, lower graphics settings and optional ambience.
- Transactional region loading with retry and a local F3 rendering snapshot.

Progress is stored in this browser. Use **Settings → Export** to change devices or keep a backup before clearing browser data. If storage is unavailable, the game provides session slots and export for the current session.

This completes the opening episode; additional towns, open-water sailing, offline caching and full device/accessibility review remain ahead. See the [roadmap](docs/ROADMAP.md), [milestone RFC](docs/rfcs/001-into-the-deep.md), and [verification record](docs/VERIFICATION.md).

## Develop and verify

```sh
npm run check             # Types, ESLint, unit tests, production build
npm run format:check      # Repository formatting
npx playwright install chromium
npm run test:e2e          # Full episode, legacy stories, migration, recovery and responsive UI
npm run preview          # Serve the production build
```

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
