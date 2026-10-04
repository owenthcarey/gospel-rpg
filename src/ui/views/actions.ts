import type { GameState } from '../../game/types';
import { activeInteractables } from '../../content/region';
import { practicalActions } from '../../content/practical';
import { distance } from '../../game/pathfinding';
import type { HeldItem } from '../../game/campaign/types';
import { heldItems } from '../../game/life/objectives';
import { escapeHtml as esc, icon } from '../icons';

const heldAcquisitions: Partial<Record<HeldItem, string>> = {
  'channel-scoop': 'galilee:spring-borrow',
  'rest-mat': 'galilee:shelter-take-mat',
  'rest-water': 'galilee:shelter-take-water',
  'rest-screen': 'galilee:shelter-take-screen',
};

export function nearbyActions(s: GameState): string {
  const places = activeInteractables(s).filter((p) => distance(s.position, p) < 2.6);
  const nearby = practicalActions(s).flatMap((a) => {
    const place = places.find((p) => p.id === a.target);
    return place ? [{ ...a, place }] : [];
  });
  const held = s.campaign.carrying;
  const pickup = held && heldAcquisitions[held];
  const returnTarget = held && heldItems[held].target;
  const canReturn = nearby.some(
    (a) => a.target === returnTarget && a.motion === 'PutDown' && !a.blocker,
  );
  // The usable return already explains this held object. Keep other blocked choices.
  const choices = nearby
    .filter((a) => !(canReturn && a.id === pickup && a.target === returnTarget && a.blocker))
    .sort(
      (a, b) =>
        Number(!!a.blocker) - Number(!!b.blocker) ||
        distance(s.position, a.place) - distance(s.position, b.place),
    );
  if (!choices.length) return '';
  const moreTargets = [...new Map(choices.slice(3).map((a) => [a.target, a.place])).values()];
  return `<span class="eyebrow">WITHIN REACH</span><div class="nearby-choices">${choices
    .slice(0, 3)
    .map(
      (a) =>
        `<div><button data-action="quick-action" data-value="${a.id}" data-target="${a.target}" class="secondary-button" ${a.blocker ? `disabled aria-describedby="block-${a.id}"` : ''}>${esc(a.label)}<small>${esc(a.place.name)}</small></button>${a.blocker ? `<p id="block-${a.id}">${esc(a.blocker)}</p>` : ''}</div>`,
    )
    .join(
      '',
    )}</div>${moreTargets.length ? `<div class="nearby-more-actions">${moreTargets.map((p) => `<button data-action="navigate" data-value="${p.id}" data-target="${p.id}" class="text-button"><span>More actions at ${esc(p.name)}</span>${icon('arrow')}</button>`).join('')}</div>` : ''}`;
}
