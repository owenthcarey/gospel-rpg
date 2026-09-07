# Contributing

Use the Node 22 version in `.nvmrc` (22.13+), or Node 24+, and `npm ci`. Keep changes small enough to play and review. Run `npm run check`, `npm run format:check`, and relevant Playwright tests. Dependencies are pinned; upgrade Babylon packages together.

- Gameplay state belongs in `src/game`, without Babylon or DOM dependencies.
- Author conversations in `src/content`. Every node states its provenance. Never invent quotations attributed to Jesus. See [the narrative guide](docs/NARRATIVE.md).
- Treat saves as untrusted. Add a migration and tests when changing stored data; do not silently discard older saves.
- Keep frame updates inside the scene. UI modules respond to state changes.
- Export Blender assets at meter scale, at the origin, with applied transforms. Commit source and GLBs. Record licenses for all external assets.
- Validate camera rotation, navigation around obstacles, menu focus, save restoration, and narrow viewports when those areas change.

See [architecture](docs/ARCHITECTURE.md), [assets](docs/ASSETS.md), and [releases](docs/DEPLOYMENT.md). The project does not currently have an open-source license; see [LICENSE.md](LICENSE.md).
