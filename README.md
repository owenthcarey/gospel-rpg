# The Way

**A quiet adventure through first-century Galilee.**

A single-player browser RPG inspired by the Gospels. This first chapter takes place in an original low-poly Capernaum: meet Simon by the boats, help prepare the shore, and find a place to listen. The traveler, errands, and connective dialogue are imagined; scripture is clearly identified and referenced.

Built with **TypeScript · Babylon.js · Vite · Blender · IndexedDB**. Entirely client-side, with no account, backend, analytics, or runtime-generated dialogue.

## Play locally

Requires **Node 22.13+ (22.x) or 24+** and a browser with **WebGL 2**. Blender is only needed to rebuild assets.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. Select **Begin your journey**, then speak with **Simon** or select **Follow the path**. The main chapter takes roughly 5–10 minutes. Speak with **Ezra** or open the journal to begin **An ordinary morning**, an optional village story that adds another 3–5 minutes.

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

## Playable baseline

- A lakeside village with **18 original Blender assets**, matte materials, warm lighting, and optional ambience.
- **A complete main quest and an optional village story**, four interactive characters, dialogue choices, and three discoveries that lead to a final conversation with Ezra.
- A Blender-authored traveler walk cycle, subtle idle motion, and gold route markers along walking paths.
- Quest tracking, satchel, journal discovery cards, and a map that marks your next destination and remembered places.
- Autosave, three manual slots, reload/continue, versioned migration (including existing v1/v2 journeys), and JSON export/import.
- Responsive menus, keyboard focus management, reduced motion, and lower graphics settings.

Progress is stored in this browser. Use **Settings → Export** to change devices or keep a backup before clearing browser data. If storage is unavailable, the game provides export for the current session.

This is a playable vertical slice and a production-oriented repository foundation. Multi-region travel, the miraculous-catch sequence, skeletal/NPC animation, offline caching, and full device/accessibility review remain ahead. See the [roadmap](docs/ROADMAP.md).

## Develop and verify

```sh
npm run check             # Types, ESLint, unit tests, production build
npm run format:check      # Repository formatting
npx playwright install chromium
npm run test:e2e          # Quest, persistence, import/export, focus, responsive UI
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
