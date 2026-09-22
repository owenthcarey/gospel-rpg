# Review evidence

Keep a small, useful gallery in Git alongside compact measurements and test outcomes. Full viewport/quality matrices, routine Blender renders, negative-control captures, browser reports and raw command logs are generated artifacts. The [manifest](manifest.json) identifies every permanent review image, its purpose, exact byte count and SHA-256.

## What belongs in Git

- Game models in `public/assets/models/` and their Blender sources in `assets/source/` remain versioned together. Existing asset tests enforce the model contracts and download budgets.
- Automated screenshot references in `tests/e2e/screenshots/` remain versioned because the rendering tests depend on them.
- Keep selected review images that establish distinct behavior, geometry, accessibility layouts or meaningful before/after comparisons. Usually four to six images suffice for a milestone.
- Keep structured verification records, measurements and portable save fixtures. Historical source/model hashes describe the original run; they are not promises that today's files still have those bytes.

The current gallery contains **42 images / 28.4 MiB**. Its total budget is **30 MiB**. Each collection has its own count and byte budget in the manifest, with defaults capped at six files and 6 MiB. A larger collection requires an `exceptionReason`; the twelve-image Capernaum gallery preserves four before/after pairs, two phone solutions and two independent Blender reviews. Budget changes require an explicit, explained manifest edit.

## Generate, review, select

1. Generate browser captures in ignored `test-results/` or `test-results-compat/`. [CI](../../.github/workflows/ci.yml) uploads browser reports and captures with seven-day retention. They can expire without breaking permanent documentation.
2. Generate Blender reviews in ignored `artifacts/reviews/<collection>/`. Every inspection script uses this default. `GOSPEL_REVIEW_OUTPUT` overrides it for CLI or MCP runs; clear stale overrides before relying on the default. CI does not run Blender.
3. Inspect the results and copy only the selected images into this directory. Regeneration uses the current models; reproduce an older milestone from its historical checkout.
4. Add or update each selected file in `manifest.json`: `path`, `collection`, `purpose`, `bytes` and `sha256`. For an intentionally changed file, compute its bytes and digest after review, for example with `wc -c` and `shasum -a 256`. Update any delivery record that also lists that image. Do not change historical test outcomes or source hashes to imply a new validation run.
5. Link the retained images from the relevant review guide. When retiring an image, remove its manifest entry and update documentation links and image inventories in the same change. Preserve the original measurements and case outcomes.
6. Run `npm run evidence:check` and `npm run format:check`. The evidence check is also the first step of `npm run check`, including in CI. It includes non-ignored untracked files locally so accidental captures fail before staging.

The check rejects unlisted binaries outside the game-model, Blender-source and automated-baseline directories; missing or ignored declared images; duplicate entries; changed bytes or checksums; exceeded budgets; broken local Markdown file links; and missing media references in verification JSON. It checks file targets, not Markdown heading fragments or external URLs. It never regenerates the manifest automatically.

The gallery was curated from 83 to 42 images in this maintenance pass. Removed captures remain available in Git history; this cleanup reduces the current checkout and limits future growth without rewriting published history.

## Selected galleries

The following images are retained for distinct review purposes. Full generation commands and original validation details are in [the asset guide](../ASSETS.md) and [verification record](../VERIFICATION.md).

### Living Capernaum

| Evidence                                                             | Purpose                                                 |
| -------------------------------------------------------------------- | ------------------------------------------------------- |
| [living-capernaum-bench.png](living-capernaum-bench.png)             | Completed bench arrangement in the game.                |
| [living-capernaum-kit.png](living-capernaum-kit.png)                 | Original village props, clue details and sitting poses. |
| [living-capernaum-pouch-phone.png](living-capernaum-pouch-phone.png) | Pouch controls at phone width.                          |

### Road to Nain

| Evidence                                                             | Purpose                                           |
| -------------------------------------------------------------------- | ------------------------------------------------- |
| [road-to-nain-command-desktop.png](road-to-nain-command-desktop.png) | Gospel command and scene on desktop.              |
| [road-to-nain-contact.png](road-to-nain-contact.png)                 | Bearer hands and supported procession frame.      |
| [road-to-nain-kit.png](road-to-nain-kit.png)                         | Original road architecture, props and characters. |
| [road-to-nain-landscape.png](road-to-nain-landscape.png)             | Large-text phone landscape presentation.          |
| [road-to-nain-poses.png](road-to-nain-poses.png)                     | Three stages of the sitting-up animation.         |
| [road-to-nain-restored.png](road-to-nain-restored.png)               | Restored mother and son together.                 |

### Living Galilee

| Evidence                                                               | Purpose                                                 |
| ---------------------------------------------------------------------- | ------------------------------------------------------- |
| [living-galilee-channel.png](living-galilee-channel.png)               | Original channel geometry before the later refinements. |
| [living-galilee-shelter-phone.png](living-galilee-shelter-phone.png)   | Completed resting place at phone width.                 |
| [living-galilee-spring-desktop.png](living-galilee-spring-desktop.png) | Completed spring in the actual desktop game.            |

### Across the Lake

| Evidence                                                                   | Purpose                                                |
| -------------------------------------------------------------------------- | ------------------------------------------------------ |
| [across-the-lake-cargo.png](across-the-lake-cargo.png)                     | Carried farm screen stowed in the boat.                |
| [across-the-lake-evidence-phone.png](across-the-lake-evidence-phone.png)   | Investigation evidence at phone width.                 |
| [across-the-lake-kit.png](across-the-lake-kit.png)                         | Original lake kit independently imported from exports. |
| [across-the-lake-rower.png](across-the-lake-rower.png)                     | Rowing pose using actual imported Babylon geometry.    |
| [across-the-lake-storm-landscape.png](across-the-lake-storm-landscape.png) | Large-text storm presentation in phone landscape.      |
| [across-the-lake-water-desktop.png](across-the-lake-water-desktop.png)     | Boat and water composition on desktop.                 |

### Connected Journey

| Evidence                                                                         | Purpose                                     |
| -------------------------------------------------------------------------------- | ------------------------------------------- |
| [connected-journey-holding.png](connected-journey-holding.png)                   | Carried pouch and hand contact.             |
| [connected-journey-home-phone.png](connected-journey-home-phone.png)             | Homecoming dialogue at phone width.         |
| [connected-journey-kit.png](connected-journey-kit.png)                           | Passage marker and revised pier silhouette. |
| [connected-journey-replay-landscape.png](connected-journey-replay-landscape.png) | Large-text replay in landscape.             |
| [connected-journey-seated.png](connected-journey-seated.png)                     | Seated neighbor and foot support.           |
| [connected-journey-shore-desktop.png](connected-journey-shore-desktop.png)       | Completed shore and company on desktop.     |

### The Journey in Your Hands

| Evidence                                                                        | Purpose                                          |
| ------------------------------------------------------------------------------- | ------------------------------------------------ |
| [channel-work-phone.png](rfc008/channel-work-phone.png)                         | Nonmodal channel controls at phone width.        |
| [fresh-journey-overview-desktop.png](rfc008/fresh-journey-overview-desktop.png) | Focused journal overview on desktop.             |
| [living-galilee-channel.png](rfc008/living-galilee-channel.png)                 | Refined open channel ports and receiving basins. |
| [living-galilee-kit.png](rfc008/living-galilee-kit.png)                         | Refined channel, basin and screen kit.           |
| [living-galilee-rest.png](rfc008/living-galilee-rest.png)                       | Screen crest, seat facing and open approach.     |
| [screen-preview-844-phone.png](rfc008/screen-preview-844-phone.png)             | Screen proposal in short landscape viewport.     |

### Capernaum, Fully Realized

| Evidence                                                                    | Purpose                                                            |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [bakehouse-high-desktop.png](rfc009/bakehouse-high-desktop.png)             | Delivered bakehouse composition for before/after comparison.       |
| [before-bakehouse.png](rfc009/before-bakehouse.png)                         | Baseline bakehouse composition for before/after comparison.        |
| [before-capernaum-lanes.png](rfc009/before-capernaum-lanes.png)             | Baseline capernaum lanes composition for before/after comparison.  |
| [before-capernaum.png](rfc009/before-capernaum.png)                         | Baseline capernaum composition for before/after comparison.        |
| [before-gathering-house.png](rfc009/before-gathering-house.png)             | Baseline gathering house composition for before/after comparison.  |
| [blender-kit.png](rfc009/blender-kit.png)                                   | Nine original Capernaum props imported from final GLBs.            |
| [blender-net-work.png](rfc009/blender-net-work.png)                         | Supported hands at the net workbench.                              |
| [capernaum-high-desktop.png](rfc009/capernaum-high-desktop.png)             | Delivered capernaum composition for before/after comparison.       |
| [capernaum-lanes-high-desktop.png](rfc009/capernaum-lanes-high-desktop.png) | Delivered capernaum lanes composition for before/after comparison. |
| [gathering-house-high-desktop.png](rfc009/gathering-house-high-desktop.png) | Delivered gathering house composition for before/after comparison. |
| [north-passage-tested-phone.png](rfc009/north-passage-tested-phone.png)     | Tested north passage and plan at phone width.                      |
| [south-short-landscape-phone.png](rfc009/south-short-landscape-phone.png)   | South solution with large text in short landscape.                 |
