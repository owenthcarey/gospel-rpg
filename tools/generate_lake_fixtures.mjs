import { createServer } from 'vite';
import { writeFile, readFile } from 'node:fs/promises';
import { format } from 'prettier';
const server = await createServer({
  server: { middlewareMode: true, ws: false },
  appType: 'custom',
});
try {
  const {
    lakeStart,
    sail,
    dock,
    lakeAction,
    lakeAt,
    completedNain,
    coveStart,
    stormStart,
    stormAftermath,
    crossingInterpreted,
  } = await server.ssrLoadModule('/tests/helpers/lake.ts');
  const { chosenShelter, galileeAction } = await server.ssrLoadModule('/tests/helpers/galilee.ts');
  const { makeSave, parseSave } = await server.ssrLoadModule('/src/persistence/schema.ts');
  const { transition } = await server.ssrLoadModule('/src/game/quest.ts');
  const afloat = sail();
  afloat.position = { x: -11.25, z: -8.125 };
  afloat.lake.boat.position = { ...afloat.position };
  afloat.lake.boat.heading = 1.125;
  // Build a valid retry state through the reducer, retaining both observations.
  let evidence = sail(lakeAction(lakeStart(), 'accept', 'joel'));
  for (const id of ['split-rock', 'reeds'])
    evidence = lakeAction(evidence, 'evidence-' + id, 'lake-' + id);
  evidence = transition(evidence, { type: 'lake-interpret', id: 'island' });
  evidence = transition(evidence, { type: 'lake-hint' });
  let checkpoint = stormStart();
  for (const id of ['evening', 'boats', 'storm'])
    checkpoint = transition(checkpoint, { type: 'storm-next', checkpoint: id });
  const waiting = parseSave(
    JSON.parse(await readFile('tests/fixtures/saves/v7-companion-waiting.json', 'utf8')),
  ).state;
  const carried = galileeAction(chosenShelter(waiting), 'shelter-take-screen');
  const cargo = sail(lakeStart(completedNain(carried)));
  let complete = lakeAction(dock(crossingInterpreted(), 'sheltered-cove'), 'arrive', 'cove-shore');
  complete = stormAftermath(stormStart(complete));
  for (const [id, target] of [
    ['landing', 'cove-shore'],
    ['lookout', 'cove-lookout'],
    ['neighbor', 'dalia'],
  ])
    complete = lakeAction(complete, 'after-' + id, target);
  complete = transition(lakeAt(complete, 'storm-viewpoint'), {
    type: 'storm-reflect',
    id: 'wonder',
  });
  complete = transition(lakeAt(dock(sail(complete), 'capernaum'), 'joel'), {
    type: 'lake-ending',
    id: 'welcome',
  });
  for (const [name, state] of Object.entries({
    'v9-ready-to-cross': lakeStart(),
    'v9-afloat': afloat,
    'v9-crossing-evidence': evidence,
    'v9-cove-berthed': coveStart(),
    'v9-storm-waking': checkpoint,
    'v9-afloat-with-supply': cargo,
    'v9-across-the-lake-complete': complete,
  })) {
    const save = makeSave(state);
    delete save.state.connection;
    save.version = 9;
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
