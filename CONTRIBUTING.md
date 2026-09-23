# Contributing

Use the Node 22 version in `.nvmrc` (22.13+), or Node 24+, and `npm ci`. Keep changes small enough to play and review. Run `npm run check`, `npm run format:check`, and relevant Playwright tests. Dependencies are pinned; upgrade Babylon packages together.

Follow the [review-evidence policy](docs/verification/README.md) for screenshots and other generated media. Put full captures in ignored artifact directories and link CI artifacts in the PR. Commit only selected permanent images, declaring their purpose, bytes and SHA-256 in `docs/verification/manifest.json`. Update image inventories and links when retiring captures. `npm run evidence:check` runs inside `npm run check` locally and in CI; it enforces the declared gallery budgets and detects unlisted binaries, changed hashes and missing file references. Keep shipped models, source workshops and automated screenshot baselines versioned.

Quality builds the game once, then discovers the current desktop/phone suite with Playwright and groups tests by recorded Linux runtimes. The planner starts with 32 groups, assigns the longest cases first, and adds groups whenever another test would exceed a five-minute estimate. A case longer than the target runs alone. New or renamed tests are included automatically with a conservative three-minute estimate; timing data never determines which tests exist. Before publishing the matrix, the planner checks every list against Playwright discovery and fails if any selected cases differ. The exact lists and estimates are retained in the `browser-plan` artifact, with a summary in the build job.

Each group uses one worker and fresh browser contexts, prints progress, and retains its HTML report and failure traces. A 20-minute suite deadline provides headroom for runner variability and diagnostic retries, leaving five minutes before the 25-minute job limit for setup and report uploads. The uninterrupted four-chapter test still runs in a separate Chromium job with the same deadlines. The `verify` gate includes the build, every browser group, the continuous journey and Firefox/WebKit compatibility; require it in the `main` ruleset as described in [Build and release](docs/DEPLOYMENT.md#github-pages).

CI retries a failed browser test once for diagnostics, and `failOnFlakyTests` makes the job fail even if that retry passes. Fix the underlying failure before merging. For routes that continue automatically after a doorway, wait for the final destination's dialogue and close it before using the toolbar; reaching a region does not mean the route has finished.

For a local CI-style run, build first, stop any existing preview server, then run `npm run test:e2e:plan` and `CI=1 npm run test:e2e -- --test-list=artifacts/browser-plan/1.txt` (repeat for the generated lists). The plan is rebuilt from the current checkout; it is not committed. `tools/ci/browser-durations.json` records approximate seconds from the linked successful Linux CI run, keyed by project, file and full title without line numbers. Refresh those estimates from successful Linux browser logs when existing journeys grow; do not use faster local GPU timings. Runtime estimates guide scheduling only, not test timeouts or assertions. The planner is covered by unit tests, including the five journeys that previously collided in shard 13.

Run the continuous journey with `CI=1 npm run test:e2e -- tests/e2e/continuous-journey.spec.ts --project=chromium --global-timeout=1200000`. A normal `npm run test:e2e` includes everything in one local run.

- Gameplay state belongs in `src/game`, without Babylon or DOM dependencies.
- Author conversations in `src/content`. Every node states its provenance. Never invent quotations attributed to Jesus. See [the narrative guide](docs/NARRATIVE.md).
- Treat saves as untrusted. Add a migration and tests when changing stored data; do not silently discard older saves.
- Keep frame updates inside the scene. UI modules respond to state changes.
- Export Blender assets at meter scale, at the origin, with applied transforms. Commit source and GLBs. Record licenses for all external assets.
- Validate camera rotation, navigation around obstacles, menu focus, save restoration, and narrow viewports when those areas change.

See [architecture](docs/ARCHITECTURE.md), [assets](docs/ASSETS.md), and [releases](docs/DEPLOYMENT.md). The project does not currently have an open-source license; see [LICENSE.md](LICENSE.md).
