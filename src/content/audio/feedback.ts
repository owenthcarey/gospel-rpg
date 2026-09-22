import type { GameEvent } from '../../game/types';
import type { SoundEffect } from '../../audio/types';
/** Called only after a game transition succeeds; rejected actions stay silent. */
export function feedbackForEvent(event: GameEvent): SoundEffect | undefined {
  if (
    event.type.endsWith('reflect') ||
    ['lake-ending', 'road-ending', 'finish-village-story', 'listen', 'remember-village'].includes(
      event.type,
    )
  )
    return 'complete';
  if (event.type === 'harbor-action')
    return event.id.startsWith('remember-')
      ? 'complete'
      : event.id.startsWith('observe-')
        ? 'discovery'
        : event.id === 'test'
          ? 'place'
          : undefined;
  if (event.type === 'journey') return 'travel';
  if (event.type === 'collect') return 'pickup';
  if (event.type === 'deliver') return 'place';
  if (event.type === 'galilee-action' && event.id === 'spring-test') return 'water';
  if (
    [
      'discover',
      'episode-note',
      'neighbor-note',
      'road-evidence',
      'lake-action',
      'home-remember',
    ].includes(event.type)
  )
    return 'discovery';
  if (
    [
      'advance-scene',
      'roof-next',
      'nain-next',
      'storm-next',
      'replay-next',
      'replay-previous',
    ].includes(event.type)
  )
    return 'page';
  return undefined;
}
