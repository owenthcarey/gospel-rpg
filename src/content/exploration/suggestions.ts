import type { GameState } from '../../game/types';
import { STORY_TRACKS, type StoryTrack } from '../../game/campaign/types';
import { chapters, storyStatus, trackedChapter } from '../campaign/chapters';
import { campaignGoal } from '../../game/campaign/objectives';
import { mainObjective, mainTarget } from '../../game/episode/objectives';
import { villageObjective, villageTarget } from '../../game/quest';
import { routeDestination, routePlan } from '../../game/connection/routes';
import { heldReturn } from '../../game/life/objectives';
import { regions } from '../regions';
import { accounts } from '../../game/connection/accounts';

export interface StorySuggestion {
  id: StoryTrack;
  title: string;
  label: string;
  text: string;
  target: string;
  destination: string;
  region: string;
  available: boolean;
  status: 'available' | 'in-progress';
  local: boolean;
}

/** Uses each story's existing objective; suggestions never mutate tracking or progress. */
export function suggestStory(s: GameState, id: StoryTrack): StorySuggestion | undefined {
  const status = storyStatus(s, id);
  if (status === 'complete' || status === 'unavailable') return;
  const view = { ...s, tracking: id };
  const goal = campaignGoal(view);
  const target =
    goal?.destination ??
    goal?.target ??
    (id === 'village' ? villageTarget(view) : mainTarget(view));
  const route = routePlan(s, target);
  const destination = routeDestination(s, target);
  const here =
    regions[s.region].returnRegion && regions[s.region].mode === 'presentation'
      ? regions[s.region].returnRegion
      : s.region;
  return {
    id,
    title: chapters[id].title,
    label: chapters[id].label,
    text: goal?.text ?? (id === 'village' ? villageObjective(view) : mainObjective(view)),
    target,
    destination: route?.title ?? chapters[id].title,
    region: destination?.region ?? chapters[id].region,
    available: !!route?.available,
    status,
    local: (destination?.region ?? chapters[id].region) === here,
  };
}

export function journeySuggestions(s: GameState) {
  const all = STORY_TRACKS.flatMap((id) => {
    const suggestion = suggestStory(s, id);
    return suggestion ? [suggestion] : [];
  });
  const tracked = trackedChapter(s).id;
  const current = all.find((a) => a.id === tracked);
  const rest = all.filter((a) => a !== current);
  // Keep the authored order within each status, so this list never jumps as the player walks.
  const byProgress = (a: StorySuggestion, b: StorySuggestion) =>
    Number(b.status === 'in-progress') - Number(a.status === 'in-progress');
  return {
    current,
    nearby: rest.filter((a) => a.local).sort(byProgress),
    elsewhere: rest.filter((a) => !a.local).sort(byProgress),
    held:
      heldReturn(s) ??
      (s.episode.carrying
        ? {
            text: 'The empty basket is in your hands. Set it at the shore landing.',
            target: 'landing',
          }
        : undefined),
    replay: s.connection.replay ? accounts[s.connection.replay.account].title : undefined,
    completed: STORY_TRACKS.filter((id) => storyStatus(s, id) === 'complete').length,
  };
}
