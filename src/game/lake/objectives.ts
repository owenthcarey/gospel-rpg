import type { GameState } from '../types';
import type { StoryGoal } from '../campaign/objectives';
export function lakeGoal(s: GameState): StoryGoal | undefined {
  if (
    s.road.chapter.stage !== 'complete' ||
    !['main', 'nain', 'storm', 'crossing'].includes(s.tracking)
  )
    return;
  const t = s.lake.trail,
    c = s.lake.chapter;
  if (s.tracking === 'crossing') {
    let text = 'Speak with Joel at Capernaum’s landing.',
      target = 'joel';
    if (t.stage === 'exploring') {
      target = !t.evidence.includes('reeds')
        ? 'lake-reeds'
        : !t.evidence.includes('split-rock')
          ? 'lake-split-rock'
          : 'joel';
      text =
        t.evidence.length === 2
          ? 'Compare the two observations in A sheltered way in your journal.'
          : 'Board and study the reed bank and split rock, in either order.';
    }
    if (t.stage === 'interpreted') {
      target = 'cove-shore';
      text = 'Dock at the sheltered cove and confirm its inward-facing landing.';
    }
    if (t.stage === 'arrived') text = 'Return by boat to Joel and share a memory of the crossing.';
    if (t.stage === 'complete') text = 'A sheltered way remembered. Both shores remain open.';
    return {
      title: 'A sheltered way',
      text,
      target,
      done: t.stage === 'complete',
      steps: [
        'Listen to Joel',
        'Observe both landmarks and compare',
        'Find the cove and return with a memory',
      ],
    };
  }
  let text = 'Return to Capernaum’s landing and board for the sheltered cove.',
    target = 'storm-viewpoint';
  if (c.stage === 'exploring')
    text =
      s.region === 'sheltered-cove'
        ? 'Approach the view over the lake to witness Mark 4:35–41.'
        : 'Dock at the sheltered cove to witness Mark 4:35–41. The navigation adventure is optional.';
  if (c.stage === 'witnessing') text = 'Resume Peace, be still at the cove’s viewpoint.';
  if (c.stage === 'aftermath') {
    target = !c.aftermath.includes('landing')
      ? 'cove-shore'
      : !c.aftermath.includes('lookout')
        ? 'cove-lookout'
        : !c.aftermath.includes('neighbor')
          ? 'dalia'
          : 'storm-viewpoint';
    text =
      c.aftermath.length === 3
        ? 'Choose a reflection at the viewpoint.'
        : 'Visit the landing, quiet lookout and Dalia after the account.';
  }
  if (c.stage === 'complete')
    text = 'Peace, be still complete. Explore the shores or return to an earlier story.';
  return {
    title: 'Peace, be still',
    text,
    target,
    done: c.stage === 'complete',
    steps: [
      'Cross to the sheltered cove',
      'Witness Mark 4:35–41',
      'Return, listen and choose a reflection',
    ],
  };
}
