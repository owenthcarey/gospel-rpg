import type { GameState } from '../../game/types';
import type { ActionMotion } from '../campaign/actions';
import { harborActionTarget, harborBlocker } from '../../game/harbor/progress';
import { harborRevision, type HarborEvent } from '../../game/harbor/types';
import { traceHarbor } from '../../game/harbor/arrangement';
import type { PracticalAction } from '../practical';

export interface HarborAction extends PracticalAction {
  notice: string;
  event: HarborEvent;
}
export function harborActions(s: GameState): HarborAction[] {
  const h = s.harbor;
  if (h.stage === 'complete') return [];
  const definitions: { id: string; label: string; notice: string; motion?: ActionMotion }[] = [];
  if (h.stage === 'not-started')
    definitions.push({
      id: 'accept',
      label: 'Help reopen the working landing',
      notice:
        'Eliab’s invitation is recorded. Inspect the passage and water marks in either order.',
    });
  else {
    if (!h.notes.includes('water'))
      definitions.push({
        id: 'observe-water',
        label: 'Study the water marks',
        notice:
          'The middle strip stays wet. The north and south sides both have dry stone to support a plank.',
      });
    if (!h.notes.includes('passage'))
      definitions.push({
        id: 'observe-passage',
        label: 'Inspect the western passage',
        notice:
          'Follow the route from the west to the eastern landing. Rope, cargo and the plank can all be moved.',
      });
    if (!h.cleared)
      definitions.push({
        id: 'clear',
        label: 'Coil the loose rope',
        notice: 'The western entrance is clear. The rope rests beside the work.',
        motion: 'Repair',
      });
    for (const route of ['north', 'south', 'rack'] as const)
      if (h.plank !== route)
        definitions.push({
          id: 'plank-' + route,
          label:
            route === 'rack'
              ? 'Return the plank to its rack'
              : 'Place the plank at the ' + route + ' crossing',
          notice:
            route === 'rack'
              ? 'The plank is back on its rack. You can choose either crossing again.'
              : 'The plank is at the ' + route + ' crossing. Check that its ends meet dry stone.',
          motion: 'PutDown',
        });
    definitions.push({
      id: 'turn',
      label: 'Turn the plank ' + (h.turn === 0 ? 'north–south' : 'east–west'),
      notice: 'The plank now runs ' + (h.turn === 0 ? 'north–south' : 'east–west') + '.',
      motion: 'Repair',
    });
    for (const cargo of ['nets', 'jars'] as const)
      definitions.push({
        id: 'cargo-' + cargo,
        label: h.cargo[cargo]
          ? `Return the ${cargo === 'nets' ? 'net' : 'jar'} cargo to the approach`
          : `Move the ${cargo === 'nets' ? 'net' : 'jar'} cargo into storage`,
        notice: h.cargo[cargo]
          ? 'The cargo is back on the approach. The arrangement can still be changed.'
          : 'The cargo is in its storage bay. Its approach is open.',
        motion: 'Use',
      });
    definitions.push({
      id: 'test',
      label: 'Test the passage to the water',
      notice: traceHarbor(h).message,
      motion: 'Use',
    });
    if (h.stage === 'ready') {
      definitions.push({
        id: 'remember-patience',
        label: 'Remember the patient work',
        notice: 'A clear way to the water · Your memory of patient work is recorded.',
      });
      definitions.push({
        id: 'remember-room',
        label: 'Remember making room',
        notice: 'A clear way to the water · Your memory of making room is recorded.',
      });
    }
  }
  return definitions.map((a) => ({
    ...a,
    target: harborActionTarget(a.id)!,
    blocker: harborBlocker(s, a.id),
    event: { type: 'harbor-action', id: a.id, expected: harborRevision(h) },
  }));
}
export function harborNotice(s: GameState, event: HarborEvent): string {
  if (event.id === 'test') return traceHarbor(s.harbor).message;
  if (event.id.startsWith('remember-'))
    return 'A clear way to the water is remembered. The landing remains open.';
  if (event.id === 'hint') return 'A more specific hint is available in the landing plan.';
  if (event.id === 'turn')
    return 'The plank runs ' + (s.harbor.turn === 0 ? 'east–west' : 'north–south') + '.';
  if (event.id.startsWith('plank-'))
    return s.harbor.plank === 'rack'
      ? 'The plank is on its rack.'
      : `The plank is at the ${s.harbor.plank} crossing. Test it when you are ready.`;
  if (event.id.startsWith('cargo-'))
    return 'The cargo has moved. Check the open approach in the landing plan.';
  return event.id === 'clear'
    ? 'The western entrance is clear.'
    : event.id === 'accept'
      ? 'Inspect the passage and water marks in either order.'
      : 'Your observation is recorded in the landing plan.';
}
