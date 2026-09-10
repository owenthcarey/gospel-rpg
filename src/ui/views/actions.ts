import type { GameState } from '../../game/types';
import { activeInteractables } from '../../content/region';
import { practicalActions } from '../../content/practical';
import { distance } from '../../game/pathfinding';
import { escapeHtml as esc } from '../icons';

export function nearbyActions(s: GameState): string {
  const places = activeInteractables(s).filter((p) => distance(s.position, p) < 2.6);
  const choices = practicalActions(s)
    .flatMap((a) => {
      const place = places.find((p) => p.id === a.target);
      return place ? [{ ...a, place }] : [];
    })
    .sort(
      (a, b) =>
        Number(!!a.blocker) - Number(!!b.blocker) ||
        distance(s.position, a.place) - distance(s.position, b.place),
    );
  if (!choices.length) return '';
  return `<span class="eyebrow">WITHIN REACH</span><div class="nearby-choices">${choices
    .slice(0, 3)
    .map(
      (a) =>
        `<div><button data-action="quick-action" data-value="${a.id}" class="secondary-button" ${a.blocker ? `disabled aria-describedby="block-${a.id}"` : ''}>${esc(a.label)}<small>${esc(a.place.name)}</small></button>${a.blocker ? `<p id="block-${a.id}">${esc(a.blocker)}</p>` : ''}</div>`,
    )
    .join('')}</div>`;
}
