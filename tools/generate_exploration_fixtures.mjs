import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { format } from 'prettier';

// Presentation is deliberately absent from portable saves. Import, then select the named
// map destination to review exactly the same work controls as an ordinary traveler.
const server = await createServer({
  server: { middlewareMode: true, ws: false },
  appType: 'custom',
});
try {
  const { newGame } = await server.ssrLoadModule('/src/game/types.ts');
  const { preparedSpring, chosenShelter, arrangedShelter, galileeAction } =
    await server.ssrLoadModule('/tests/helpers/galilee.ts');
  const { gateway } = await server.ssrLoadModule('/tests/helpers/campaign.ts');
  const { makeSave, parseSave } = await server.ssrLoadModule('/src/persistence/schema.ts');
  const folder = 'docs/verification/rfc008/saves';
  await mkdir(folder, { recursive: true });
  for (const [name, state] of Object.entries({
    'fresh-traveler': newGame(),
    'channel-ready-to-turn': preparedSpring(),
    'shade-blocked-approach': arrangedShelter(chosenShelter(undefined, 'shade'), 2),
    'breeze-blocked-approach': arrangedShelter(chosenShelter(undefined, 'breeze'), 2),
    'screen-on-the-road': gateway(
      galileeAction(chosenShelter(), 'shelter-take-screen'),
      'farm-exit',
    ),
  })) {
    const save = makeSave(state);
    save.savedAt = '2026-09-13T00:00:00.000Z';
    parseSave(save);
    await writeFile(
      folder + '/' + name + '.json',
      await format(JSON.stringify(save), { parser: 'json' }),
    );
    console.log('Validated ' + name);
  }
} finally {
  await server.close();
}
