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

1. Push the repository and select **Settings → Pages → Source → GitHub Actions**.
2. Protect `main` and require Quality before merging.
3. Run **Publish to GitHub Pages** on `main` from Actions.
4. The reusable Quality workflow runs formatting, types, lint, unit tests, build, and Chromium integration checks. Failure prevents publishing.
5. The publish job deploys the tested build to the `github-pages` environment and reports its URL.

Publishing is manual. Local setup does not change repository settings or publish anything. Add GitHub environment reviewers if required. See [GitHub's custom Pages workflow guide](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Release checks

Play on current Chrome/Edge, Safari, and Firefox on real hardware, including a touch device. Export a save, refresh and continue, import into a clean profile, and load an older fixture. Automated coverage currently targets desktop Chromium and a mobile Chromium viewport, not every device/GPU.

Check the deployed subpath for missing assets. Saves are origin-specific: localhost, previews, and GitHub Pages do not share progress. Export before changing origins or clearing browser data.

The separately cached Babylon bundle transfers roughly 0.7 MB compressed; the GLB kit is roughly 0.6 MB. Source maps enlarge the disk artifact but are not normally downloaded during play. No CDN is required at runtime. Offline caching is not implemented; reloads require the host. Low quality reduces shadows and resolution. Profile representative GPUs before expanding regions.
