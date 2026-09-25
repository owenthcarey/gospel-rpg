import { allInteractables } from './region';
import { isActorAsset, type ActorAsset } from './assets';
import type { GameState } from '../game/types';

/** Opening guidance comes from existing progress; there is no tutorial save state. */
export function openingGuidance(state: GameState): string | undefined {
  if (state.region !== 'capernaum' || state.episode.stage !== 'not-started') return;
  if (state.quest === 'not-started') return 'Choose a person’s name to walk over and speak.';
  if (state.quest === 'gathering')
    return state.inventory.length < 2
      ? 'Your satchel keeps what you collect. The map can guide you.'
      : 'The net and bread are ready. Return to Simon when you wish.';
  if (state.quest === 'delivered')
    return 'Conversations wait for you. Read and choose at your own pace.';
  return;
}

/** Identity is derived from authored people; narration never acquires a fictional speaker. */
export function personIdentity(
  idOrName: string,
): { id: string; name: string; asset: ActorAsset } | undefined {
  const alias: Record<string, string> = {
    'home-farm': 'leah',
    'home-table': 'hannah',
    'home-shore': 'miriam',
  };
  const id = alias[idOrName] ?? idOrName;
  const person = allInteractables.find(
    (p) => p.kind === 'person' && (p.id === id || p.name === id),
  );
  if (!person?.asset || !isActorAsset(person.asset)) return;
  return { id: person.id, name: person.name, asset: person.asset };
}
export function portraitUrl(asset: ActorAsset): string {
  return import.meta.env.BASE_URL + 'assets/portraits/' + asset + '.webp';
}
