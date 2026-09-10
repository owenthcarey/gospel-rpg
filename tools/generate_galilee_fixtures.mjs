import { createServer } from 'vite';
import { writeFile } from 'node:fs/promises';
import { format } from 'prettier';

const server = await createServer({
  server: { middlewareMode: true, ws: false },
  appType: 'custom',
});
try {
  const { preparedSpring, chosenShelter, connectSpring, arrangedShelter, galileeAction } =
    await server.ssrLoadModule('/tests/helpers/galilee.ts');
  const { gateway } = await server.ssrLoadModule('/tests/helpers/campaign.ts');
  const { makeSave, parseSave } = await server.ssrLoadModule('/src/persistence/schema.ts');
  let carried = galileeAction(chosenShelter(), 'shelter-take-screen');
  carried = gateway(carried, 'farm-exit');
  let unfinished = galileeAction(chosenShelter(), 'shelter-take-mat');
  unfinished = galileeAction(unfinished, 'shelter-place-shade-mat');
  let complete = galileeAction(connectSpring(), 'spring-finish-sharing');
  complete = galileeAction(
    arrangedShelter(chosenShelter(complete, 'breeze')),
    'shelter-finish-welcome',
  );
  for (const [name, state] of Object.entries({
    'v8-channel-prepared': preparedSpring(),
    'v8-supply-on-the-road': carried,
    'v8-resting-place-unfinished': unfinished,
    'v8-living-galilee-complete': complete,
  })) {
    const save = makeSave(state);
    save.savedAt = '2026-09-10T00:00:00.000Z';
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
