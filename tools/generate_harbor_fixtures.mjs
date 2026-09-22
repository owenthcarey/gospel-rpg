import { createServer } from 'vite';
import { writeFile, readFile, stat } from 'node:fs/promises';
import { format } from 'prettier';
const server = await createServer({
  server: { middlewareMode: true, ws: false },
  appType: 'custom',
});
try {
  const { harborAction, preparedHarbor, clearHarbor } = await server.ssrLoadModule(
    '/tests/helpers/harbor.ts',
  );
  const { makeSave, parseSave } = await server.ssrLoadModule('/src/persistence/schema.ts');
  const states = {
    'v11-landing-observed': preparedHarbor(),
    'v11-landing-interrupted': harborAction(harborAction(preparedHarbor(), 'clear'), 'plank-south'),
    'v11-landing-north': harborAction(clearHarbor('north'), 'remember-patience'),
    'v11-landing-south': harborAction(clearHarbor('south'), 'remember-room'),
  };
  for (const [name, state] of Object.entries(states)) {
    const save = makeSave(state);
    save.savedAt = '2026-09-21T00:00:00.000Z';
    parseSave(save);
    await writeFile(
      'tests/fixtures/saves/' + name + '.json',
      await format(JSON.stringify(save), { parser: 'json' }),
    );
    console.log('Validated ' + name);
  }
  const { explorationAssets } = await server.ssrLoadModule('/src/content/inventories.ts');
  const baseline = JSON.parse(
    await readFile('docs/verification/rfc009/asset-baseline.json', 'utf8'),
  );
  const report = {};
  for (const [region, old] of Object.entries(baseline)) {
    const assets = explorationAssets(region);
    const bytes = (
      await Promise.all(
        assets.map(async (n) => (await stat('public/assets/models/' + n + '.glb')).size),
      )
    ).reduce((a, b) => a + b, 0);
    report[region] = {
      models: assets.length,
      bytes,
      baselineBytes: old.bytes,
      addedBytes: bytes - old.bytes,
      addedAssets: assets.filter((n) => !old.assets.includes(n)),
    };
  }
  await writeFile(
    'docs/verification/rfc009/asset-delivery.json',
    await format(JSON.stringify(report), { parser: 'json' }),
  );
} finally {
  await server.close();
}
