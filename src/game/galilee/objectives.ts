import type { GameState } from '../types';
import type { StoryGoal } from '../campaign/objectives';
import { checkArrangement } from './arrangement';
import { SPRING_HINTS } from './channel';
import { REST_SUPPLIES } from './types';
export function galileeGoal(s: GameState): StoryGoal | undefined {
  if (s.tracking !== 'spring' && s.tracking !== 'shelter') return;
  const spring = s.tracking === 'spring';
  const title = spring ? 'A spring for travelers' : 'Room under the olives';
  if (s.campaign.roof.stage !== 'complete')
    return {
      title,
      text: 'Complete Through the Roof to reach these original road stories.',
      target: 'house-viewpoint',
      done: false,
      steps: ['Complete Through the Roof', 'Follow the road beyond Capernaum'],
    };
  let text: string, target: string, done: boolean;
  if (spring) {
    const p = s.galilee.spring;
    target = 'spring-source';
    done = p.stage === 'complete';
    text = 'Inspect the small channel east of the Galilean road.';
    if (p.stage === 'working') {
      if (!p.notes.includes('source')) text = 'Inspect the inlet at the spring source.';
      else if (!p.notes.includes('basins')) {
        text = 'Inspect both basins at the east end of the channel.';
        target = 'spring-basins';
      } else if (p.cleared.length < 2) {
        if (s.campaign.carrying === 'channel-scoop') {
          target = p.cleared.includes('inlet') ? 'channel-entry' : 'spring-source';
          text = 'Use the scoop to clear the inlet and entry silt in either order.';
        } else {
          target = 'spring-tools';
          text = 'Borrow the scoop from its rack south of the channel.';
        }
      } else if (s.campaign.carrying === 'channel-scoop') {
        text = 'Return the scoop, then turn the channel sections with free hands.';
        target = 'spring-tools';
      } else {
        text = SPRING_HINTS[p.hint];
        target = p.hint === 3 ? 'channel-entry' : 'spring-source';
      }
    }
    if (p.stage === 'flowing')
      text = 'Water reaches a basin. Choose what to remember at the source.';
    if (done) text = 'Water flows beside the road. Your chosen memory remains in the journal.';
  } else {
    const r = s.galilee.shelter;
    target = 'leah';
    done = r.stage === 'complete';
    text = 'Speak with Leah beside the farm path.';
    if (r.stage === 'planning') {
      target = !r.inspected.includes('shade') ? 'rest-shade' : 'rest-breeze';
      text =
        r.inspected.length === 2
          ? 'Choose either resting place. Both offer a useful welcome.'
          : 'Visit the olive shade and the open resting place before choosing.';
    }
    if (r.stage === 'arranging') {
      target = 'rest-' + r.site;
      if (s.campaign.carrying?.startsWith('rest-'))
        text = 'Place what you carry at the chosen resting place.';
      else if (r.placed.length < 3) {
        target = 'rest-supplies';
        text =
          'Carry the remaining supplies from the farm rack: ' +
          REST_SUPPLIES.filter((id) => !r.placed.includes(id)).join(', ') +
          '.';
      } else
        text = checkArrangement(r).ready
          ? 'Check the resting place and its clear approach.'
          : checkArrangement(r).message;
    }
    if (r.stage === 'ready') text = 'The resting place is ready. Return to Leah to share a memory.';
    if (done) text = 'Travelers use the resting place you prepared. Leah remembers your welcome.';
  }
  return {
    title,
    text,
    target,
    done,
    steps: spring
      ? [
          'Inspect the source and both basins',
          'Clear and connect the channel',
          'Test the water and remember',
        ]
      : [
          'Inspect both resting places',
          'Carry, place and adjust the supplies',
          'Check the approach and return to Leah',
        ],
  };
}
