import type { GameState } from '../types';
import type { StoryGoal } from '../campaign/objectives';
import { companyMeeting, COMPANY_PATHS } from '../../content/road/routes';
import { regions } from '../../content/regions';
export function trailTarget(s: GameState): string {
  const t = s.road.trail;
  if (t.stage === 'interpreted') return 'farm-landmark';
  if (t.stage !== 'exploring' || t.evidence.length === 2) return 'tamar';
  return t.evidence.includes('spring') ? 'road-terrace' : 'road-spring';
}
export function trailHint(s: GameState): string {
  const t = s.road.trail;
  if (t.stage === 'interpreted')
    return [
      'Follow the direction in the marks. The resting place is dry.',
      'The branching marks point west, away from the exposed ridge.',
      'Take the western fork to the farm. Look for the split olive beside the shelter.',
      'Use Find the next detail to approach the resting shelter at the roadside farm.',
    ][t.hint]!;
  if (['arrived', 'complete'].includes(t.stage))
    return 'Tamar is waiting beside the southern part of the Galilean road. Return to share your memory.';
  return [
    'Look at the road itself. Water, stones and a branching mark may help you remember.',
    'There are two markers: one near water, another where the path turns across the terraces.',
    'The spring is west of the fork. The paired terrace stones are on the eastern rise. You can inspect either first.',
    'Use Find the next detail to approach the next unrecorded marker, then return to Tamar to compare both details.',
  ][t.hint]!;
}
export function roadGoal(s: GameState): StoryGoal | undefined {
  if (
    !['nain', 'trail', 'company'].includes(s.tracking) &&
    !(s.tracking === 'main' && s.campaign.roof.stage === 'complete')
  )
    return;
  if (s.campaign.roof.stage !== 'complete')
    return {
      title: 'The Road to Nain',
      text: 'Complete your reflection in Through the Roof to continue beyond Capernaum.',
      target: 'house-viewpoint',
      done: false,
      steps: ['Complete Through the Roof', 'Continue to the road beyond Capernaum'],
    };
  if (s.tracking === 'trail') {
    const t = s.road.trail;
    const text =
      t.stage === 'not-started'
        ? 'Listen to Tamar beside the Galilean road.'
        : t.stage === 'complete'
          ? 'Tamar’s resting place is found. Your chosen memory is in the journal.'
          : t.stage === 'arrived'
            ? 'Return to Tamar and choose what to remember together.'
            : t.stage === 'exploring' && t.evidence.length === 2
              ? 'Compare both observations with Tamar’s recollection. An unsupported route can be tried again.'
              : trailHint(s);
    return {
      title: 'A way remembered',
      text,
      target: trailTarget(s),
      done: t.stage === 'complete',
      steps: [
        'Listen to Tamar’s recollection',
        'Inspect two markers in either order and interpret the route',
        'Find the shelter and share a memory',
      ],
    };
  }
  if (s.tracking === 'company') {
    const c = s.road.company,
      meeting = companyMeeting(c);
    const text =
      c.stage === 'not-started'
        ? 'Offer Neri company at the roadside farm.'
        : c.stage === 'invited'
          ? c.route
            ? 'Begin the walk with Neri at the farm.'
            : 'Choose shade or the open terraces with Neri. Both routes reach Nain.'
          : c.stage === 'complete'
            ? 'Your walk is remembered. Neri rests in the courtyard at Nain.'
            : c.stage === 'arrived'
              ? 'Share a final moment with Neri beside the courtyard bench.'
              : c.region !== s.region
                ? `Neri is waiting in ${regions[c.region].title}. Return to him to continue together.`
                : `${meeting!.description} Stop ${c.step + 1} / ${COMPANY_PATHS[c.route!].length}. Neri waits if you go too far.`;
    return {
      title: 'Company on the road',
      text,
      target: c.stage === 'walking' && c.region === s.region ? 'neri-meeting' : 'neri',
      done: c.stage === 'complete',
      steps: [
        'Choose a route with Neri',
        'Meet at each turn and doorway together',
        'Remember the walk in Nain’s courtyard',
      ],
    };
  }
  const c = s.road.chapter;
  const target =
    c.stage === 'aftermath' && !c.aftermath.includes('courtyard')
      ? 'nain-courtyard'
      : c.stage === 'aftermath' && !c.aftermath.includes('neighbor')
        ? 'adina'
        : 'nain-viewpoint';
  const text =
    c.stage === 'not-started'
      ? 'Later in your imagined journey · Take the road beyond Capernaum’s lanes.'
      : c.stage === 'exploring'
        ? 'Follow the Galilean road to Nain and witness Luke’s account. The farm and travelers are optional.'
        : c.stage === 'witnessing'
          ? 'Continue At the gate at your own pace.'
          : c.stage === 'aftermath'
            ? c.aftermath.length === 3
              ? 'Choose a reflection at the gate.'
              : 'Remember the gate and courtyard, and listen to Adina.'
            : 'At the gate complete. The road, farm and Capernaum remain open.';
  return {
    title: 'At the gate',
    text,
    target,
    done: c.stage === 'complete',
    steps: [
      'Follow the road to Nain',
      'Witness Luke 7:11–17',
      'Return, listen and choose a reflection',
    ],
  };
}
