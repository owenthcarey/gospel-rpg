# Build and release

```sh
npm ci
npm run check
npm run format:check
npx playwright install chromium
npm run test:e2e
npm run preview
```

Serve `dist/` over HTTP(S). A relative Vite base supports GitHub project subpaths and domain roots, including GLB URLs. No routing rewrites are required. Opening the HTML as a local file is unsupported.

## GitHub Pages

1. Select **Settings → Pages → Source → GitHub Actions** once when setting up the repository.
2. Protect `main` and require Quality before merging.
3. Push or merge a pull request to `main`. **Publish to GitHub Pages** starts automatically.
4. The reusable Quality workflow runs formatting, types, lint, unit tests and build in `build`, then Chromium integration checks in sixteen `browser` shards against that same build artifact. The shard denominator comes from the matrix job count, keeping test selection aligned with the matrix. The existing `verify` check gates all of those jobs, so it remains the required branch-protection check. Failure in any shard prevents publishing.
5. The publish job deploys the tested build to the `github-pages` environment at <https://owenthcarey.github.io/gospel-rpg/> and reports its URL.

Pull requests run Quality without deploying. On `main`, the Pages workflow calls Quality once and publishes its build artifact only after all checks pass. Deployments are serialized so an active release can finish. You can also run **Publish to GitHub Pages** manually from Actions on `main`; runs on other branches are skipped. Local builds do not publish anything.

The workflow uses GitHub's built-in token; no deployment secret is required. Environment reviewers, if configured, must approve each deployment. See [GitHub's custom Pages workflow guide](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Release checks

Play on current Chrome/Edge, Safari, and Firefox on real hardware, including a touch device. Export a save, refresh and continue, import into a clean profile, and load an older fixture. Automated coverage currently targets desktop Chromium and a mobile Chromium viewport, not every device/GPU.

Check the deployed subpath for missing assets. Saves are origin-specific: localhost, previews, and GitHub Pages do not share progress. Export before changing origins or clearing browser data.

The separately cached Babylon bundle transfers roughly 0.7 MB compressed; the complete 79-model GLB kit is roughly 5.23 MB (4.99 MiB). Source maps enlarge the disk artifact but are not normally downloaded during play. No CDN is required at runtime. Offline caching is not implemented; reloads require the host. Low quality reduces shadows and resolution. Profile representative GPUs before expanding regions.

For this milestone, verify all v1–v7 fixtures. Restore a saved lake, roof or Nain checkpoint, leave and resume, finish with a summary, then load an earlier manual slot. Failed model downloads must keep the previous region usable. A completed old prelude should offer Simon's continuation without repeating the net-and-bread errands. See [the verification record](VERIFICATION.md) for automated results and remaining device checks.
