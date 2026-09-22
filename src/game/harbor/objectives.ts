import type { GameState } from '../types';
import type { StoryGoal } from '../campaign/objectives';
import { HARBOR_HINTS, traceHarbor } from './arrangement';
export function harborGoal(s: GameState): StoryGoal | undefined {
  if (s.tracking !== 'harbor') return;
  const h = s.harbor;
  let target = 'eliab',
    text = 'Speak with Eliab beside the working landing on the southern shore.';
  if (h.stage === 'working') {
    if (!h.notes.includes('passage')) {
      target = 'harbor-entrance';
      text = 'Inspect the western passage into the working landing.';
    } else if (!h.notes.includes('water')) {
      target = 'harbor-water';
      text = 'Study the marks on the wet stone at the eastern landing.';
    } else {
      target = 'harbor-entrance';
      text = h.tested ? traceHarbor(h).message : HARBOR_HINTS[h.hint];
    }
  }
  if (h.stage === 'ready')
    text = 'The passage is clear. Return to Eliab to choose what to remember.';
  if (h.stage === 'complete')
    text =
      'The ' +
      h.plank +
      ' crossing remains open. Eliab remembers your ' +
      (h.ending === 'patience' ? 'patient work.' : 'care in making room.');
  return {
    title: 'A clear way to the water',
    target,
    text,
    done: h.stage === 'complete',
    steps: [
      'Inspect the passage and water marks',
      'Arrange a dry crossing with open approaches',
      'Test the passage and remember with Eliab',
    ],
  };
}
