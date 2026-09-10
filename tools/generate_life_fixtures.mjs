import { createServer } from 'vite';
import { writeFile } from 'node:fs/promises';
import { format } from 'prettier';

// Use the real TypeScript transitions and validator; fixtures never hand-author earned progress.
const server = await createServer({
  server: { middlewareMode: true, ws: false },
  appType: 'custom',
});
try {
  const { action, district, gateway } = await server.ssrLoadModule('/tests/helpers/campaign.ts');
  const { makeSave, parseSave } = await server.ssrLoadModule('/src/persistence/schema.ts');
  const run = (ids, initial = district()) => ids.reduce((s, id) => action(s, id), initial);
  const identified = run([
    'life-thread-accept',
    'life-clue-water',
    'life-clue-cloth',
    'life-identify',
  ]);
  const pouch = action(identified, 'life-take-pouch');
  const repair = run([
    'life-bench-inspect',
    'life-method-brace',
    'life-clear-bench',
    'life-take-brace',
  ]);
  const complete = run(
    [
      'life-return-pouch',
      'life-ending-route',
      'life-bench-inspect',
      'life-method-lashing',
      'life-take-lashing',
      'life-clear-bench',
      'life-fit-lashing',
      'life-test-bench',
      'table-accept',
      'table-courtyard',
      'take-bread',
      'place-bread-courtyard',
      'take-jug',
      'fill-jug',
      'place-water-courtyard',
      'table-finish',
    ],
    pouch,
  );
  for (const [name, state] of Object.entries({
    'v6-carrying-pouch': pouch,
    'v6-interrupted-repair': repair,
    'v6-living-capernaum': gateway(complete, 'bakehouse-exit'),
  })) {
    const save = makeSave(state);
    // These are historical migration fixtures, not current-version examples.
    save.version = 6;
    delete save.state.road;
    save.savedAt = '2026-09-09T00:00:00.000Z';
    parseSave(save);
    await writeFile(
      'tests/fixtures/saves/' + name + '.json',
      await format(JSON.stringify(save), { parser: 'json' }),
    );
    console.log('Validated ' + name);
  }
} finally {
  await server.close();
}
