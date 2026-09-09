import type { GameState } from '../../game/types';
import { worldActions, actionBlocker, actionMotion } from '../../content/campaign/actions';
import { localNeighborhoodPlaces } from '../../content/campaign/places';
import { activeInteractables } from '../../content/region';
import { episodeActions, actionAvailable } from '../../content/episode/interactions';
import { distance } from '../../game/pathfinding';
import { escapeHtml as esc } from '../icons';

export function nearbyActions(s: GameState): string {
  const places = localNeighborhoodPlaces(s)
    .filter((p) => distance(s.position, p) < 2.6)
    .sort((a, b) => distance(s.position, a) - distance(s.position, b));
  const choices = places.flatMap((p) =>
    worldActions
      .filter((a) => a.target === p.id && actionMotion(a) && (a.visible?.(s) ?? a.available(s)))
      .map((action) => ({
        id: action.id,
        label: action.label,
        blocker: actionBlocker(action, s),
        place: p,
      })),
  );
  choices.push(
    ...activeInteractables(s)
      .filter((p) => distance(s.position, p) < 2.6)
      .flatMap((place) =>
        episodeActions
          .filter((a) => a.destination === place.id && a.motion && actionAvailable(s, a.id))
          .map((a) => ({ id: 'episode:' + a.id, label: a.label, blocker: undefined, place })),
      ),
  );
  choices.sort((a, b) => distance(s.position, a.place) - distance(s.position, b.place));
  if (!choices.length) return '';
  return `<span class="eyebrow">WITHIN REACH</span><div class="nearby-choices">${choices
    .slice(0, 3)
    .map(({ id, label, blocker, place }) => {
      return `<div><button data-action="quick-action" data-value="${id}" class="secondary-button" ${blocker ? 'disabled' : ''} ${blocker ? `aria-describedby="block-${id}"` : ''}>${esc(label)}<small>${esc(place.name)}</small></button>${blocker ? `<p id="block-${id}">${esc(blocker)}</p>` : ''}</div>`;
    })
    .join('')}</div>`;
}
