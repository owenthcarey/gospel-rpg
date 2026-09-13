import { createServer } from 'vite';
import { writeFile } from 'node:fs/promises';
import { format } from 'prettier';

const server = await createServer({
  server: { middlewareMode: true, ws: false },
  appType: 'custom',
});
try {
  const { completedJourney, homeAt } = await server.ssrLoadModule('/tests/helpers/connection.ts');
  const { transition } = await server.ssrLoadModule('/src/game/quest.ts');
  const { makeSave, parseSave } = await server.ssrLoadModule('/src/persistence/schema.ts');
  const route = transition(completedJourney(), { type: 'route-select', target: 'home-farm' });
  const replay = transition(route, { type: 'replay-open', account: 'nain', checkpoint: 'command' });
  const partial = transition(homeAt(completedJourney(), 'farm'), {
    type: 'home-remember',
    visit: 'farm',
    choice: 'company',
  });
  let complete = partial;
  for (const [visit, choice] of [
    ['table', 'listening'],
    ['shore', 'beginning'],
  ])
    complete = transition(homeAt(complete, visit), { type: 'home-remember', visit, choice });
  complete = transition(complete, { type: 'home-reflect', choice: 'onward' });
  for (const [name, state] of Object.entries({
    'v10-saved-route': route,
    'v10-interrupted-replay': replay,
    'v10-return-visits': partial,
    'v10-way-home-complete': complete,
  })) {
    const save = makeSave(state);
    save.savedAt = '2026-09-12T00:00:00.000Z';
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
