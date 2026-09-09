import type { GameState } from '../types';
import { nextGateway, placeRegion, WALK_ROUTES } from '../../content/campaign/places';
import { lifeGoal, withHeldGuidance } from '../life/objectives';
export interface StoryGoal {
  title: string;
  text: string;
  target: string;
  done: boolean;
  steps: string[];
}
export function localTarget(s: GameState, target: string): string {
  const region = placeRegion(target) ?? 'capernaum';
  return region === s.region ? target : (nextGateway(s.region, region) ?? target);
}
export function campaignGoal(s: GameState): StoryGoal | undefined {
  if (s.episode.stage !== 'complete' || s.tracking === 'village') return;
  const life = lifeGoal(s);
  if (life) {
    const goal = withHeldGuidance(s, life);
    return { ...goal, target: localTarget(s, goal.target) };
  }
  const c = s.campaign;
  let goal: StoryGoal;
  if (s.tracking === 'neighbors') {
    const w = c.walk;
    let target = 'amos',
      text = 'Offer Amos your company by the water point.';
    if (w.stage === 'invited') {
      text = !w.route
        ? 'Choose a route with Amos.'
        : w.route === 'passage' && !w.gateOpen
          ? c.carrying === 'cart-handle'
            ? 'Move the cart from the narrow passage.'
            : 'Borrow the handcart handle from the bakehouse.'
          : 'Return to Amos and begin the walk.';
      target =
        w.route === 'passage' && !w.gateOpen
          ? c.carrying === 'cart-handle'
            ? 'passage'
            : 'tool-shelf'
          : 'amos';
    }
    if (w.stage === 'walking') {
      target = 'amos-waypoint';
      text = `Stay near Amos and meet at the next turn · ${w.step + 1} / ${WALK_ROUTES[w.route!].length}. He waits if you go too far.`;
    }
    if (w.stage === 'arrived') text = 'Share a final moment with Amos in the courtyard.';
    if (w.stage === 'complete') text = 'A way together remembered. Amos remains in the courtyard.';
    goal = {
      title: 'A way together',
      text,
      target,
      done: w.stage === 'complete',
      steps: [
        'Offer company and choose a route',
        'Walk at Amos’s pace',
        'Remember the walk in the courtyard',
      ],
    };
  } else if (s.tracking === 'table') {
    const t = c.table;
    let text = 'Speak with Hannah in the bakehouse.',
      target = 'hannah';
    if (t.stage === 'preparing') {
      if (!t.location) text = 'Choose a place to welcome neighbors with Hannah.';
      else if (t.delivered.length === 2) text = 'Tell Hannah the table is ready.';
      else if (c.carrying === 'empty-jug') {
        text = 'Fill the jug at the water point.';
        target = 'water-point';
      } else if (c.carrying === 'bread-basket' || c.carrying === 'water-jug') {
        text = 'Set what you carry on the ' + t.location + ' table.';
        target = t.location + '-table';
      } else if (c.carrying === 'cart-handle') {
        text = 'Return the handle or clear the passage to free your hands.';
        target = 'tool-shelf';
      } else {
        const bread = !t.delivered.includes('bread');
        text = bread
          ? 'Carry bread from the bakehouse shelf. Water can come first, if you prefer.'
          : 'Carry the empty jug from the bakehouse shelf.';
        target = bread ? 'bread-shelf' : 'jug-shelf';
      }
    }
    if (t.stage === 'complete') text = 'Bread and water remain on your chosen table.';
    goal = {
      title: 'A table for neighbors',
      text,
      target,
      done: t.stage === 'complete',
      steps: [
        'Choose a table with Hannah',
        'Bring bread and water in either order',
        'Return to Hannah',
      ],
    };
  } else {
    const r = c.roof;
    let text = 'Some days later · Follow the road into the neighborhood.',
      target = 'to-lanes';
    if (r.stage === 'exploring') {
      text = 'Enter the gathering house and witness Mark’s account. Helping neighbors is optional.';
      target = 'house-viewpoint';
    }
    if (r.stage === 'witnessing') {
      text = 'Continue Through the Roof at your own pace.';
      target = 'house-viewpoint';
    }
    if (r.stage === 'aftermath') {
      target = !r.aftermath.includes('ruth')
        ? 'ruth'
        : !r.aftermath.includes('hannah')
          ? 'hannah'
          : 'house-viewpoint';
      text =
        r.aftermath.length === 3
          ? 'Choose a reflection in the gathering house.'
          : 'Spend time with Ruth, Hannah, and the room you remember.';
    }
    if (r.stage === 'complete') {
      text = 'Through the Roof complete. Your neighbors and the shore remain open to explore.';
      target = 'house-viewpoint';
    }
    goal = {
      title: 'Through the Roof',
      text,
      target,
      done: r.stage === 'complete',
      steps: [
        'Visit the gathering house',
        'Witness Mark 2:1–12',
        'Listen, remember, and choose a reflection',
      ],
    };
  }
  goal = withHeldGuidance(s, goal);
  return { ...goal, target: localTarget(s, goal.target) };
}
