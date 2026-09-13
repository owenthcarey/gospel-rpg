import type { GameState } from '../../game/types';
import { journeySuggestions, type StorySuggestion } from '../../content/exploration/suggestions';
import {
  workTarget,
  previewDescription,
  screenCanMove,
  type WorkAction,
  type ScreenPreview,
} from '../../content/exploration/work';
import { DIRECTIONS, SPRING_HINTS } from '../../game/galilee/channel';
import { REST_SUPPLIES } from '../../game/galilee/types';
import { regions } from '../../content/regions';
import { escapeHtml as esc, icon } from '../icons';

const button = (label: string, action: string, value = '', disabled = false, extra = '') =>
  `<button class="secondary-button" data-action="${action}" data-value="${esc(value)}" ${disabled ? 'disabled' : ''} ${extra}>${esc(label)}</button>`;

function suggestionCard(s: StorySuggestion, current = false): string {
  return `<article class="opportunity ${current ? 'current-opportunity' : ''}" data-story="${s.id}"><p class="eyebrow">${current ? 'YOUR SELECTED STORY' : esc(s.label)}</p><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p><p class="opportunity-place">${icon('pin')} ${esc(regions[s.region as keyof typeof regions].title)} · ${esc(s.destination)}</p><div class="story-actions">${button('Follow the path', 'follow-story', s.id, !s.available)}${button('Open story', 'open-story', s.id)}</div></article>`;
}
export function journeyOverview(s: GameState): string {
  const suggestions = journeySuggestions(s);
  return `<section class="journey-overview" aria-label="Your journey now"><div class="overview-intro"><p class="eyebrow">AT YOUR OWN PACE</p><h3>Your journey now</h3><p>Continue a story or see what is nearby. Every invitation can wait.</p></div>${suggestions.replay ? `<aside class="overview-notice"><strong>Replaying ${esc(suggestions.replay)}</strong><p>Your ordinary traveler is waiting at ${esc(regions[s.region].title)}. Return to explore or continue reading.</p>${button('Return to your traveler', 'scene-leave')}</aside>` : ''}${suggestions.held ? `<aside class="overview-notice"><h4>In your hands</h4><p>${esc(suggestions.held.text)}</p>${button('Find the return point', 'travel', suggestions.held.target)}</aside>` : ''}${suggestions.current ? suggestionCard(suggestions.current, true) : '<p class="overview-notice">Your selected story is remembered. Choose an available invitation below, or revisit your memories.</p>'}<section aria-label="Nearby opportunities"><h3>Here and nearby</h3><div class="opportunity-list">${suggestions.nearby.map((a) => suggestionCard(a)).join('') || '<p>No unfinished invitations begin here. There is still room to explore or return to a familiar face.</p>'}</div></section>${suggestions.elsewhere.length ? `<details class="elsewhere-stories"><summary>Elsewhere on your journey · ${suggestions.elsewhere.length} invitations</summary><div class="opportunity-list">${suggestions.elsewhere.map((a) => suggestionCard(a)).join('')}</div></details>` : ''}<p class="overview-footnote">${suggestions.completed} stories remembered. Stories keeps the complete journey, including later chapters and every Gospel transcript.</p>${button('Browse all stories', 'journal-category', 'stories')}</section>`;
}

/** Keep stable authored command names for readable and focused alternatives. */
export function workCommand(action: WorkAction): { name: string; value: string } {
  const e = action.event;
  if (e.type === 'galilee-turn') return { name: e.type, value: e.id + ':' + e.expected };
  if (e.type === 'galilee-screen') return { name: e.type, value: String(e.expected) };
  if (e.type === 'galilee-action' || e.type === 'campaign-action' || e.type === 'lake-action')
    return { name: e.type, value: e.id };
  if (e.type === 'journey') return { name: e.type, value: e.gateway };
  return { name: 'work-act', value: action.id };
}
export function workSurface(
  s: GameState,
  targetId: string,
  feedback = '',
  preview?: ScreenPreview,
): string {
  const target = workTarget(s, targetId);
  if (!target) return '';
  const spring = s.galilee.spring,
    shelter = s.galilee.shelter;
  const actionButtons = target.actions
    .map((a) => {
      const command = workCommand(a);
      return `<div class="work-action">${button(a.label, command.name, command.value, !!a.blocker, `data-work-id="${esc(a.id)}"`)}${a.blocker ? `<p class="action-blocker">${esc(a.blocker)}</p>` : ''}</div>`;
    })
    .join('');
  const hint =
    target.family === 'spring' && spring.stage !== 'not-started' && spring.stage !== 'complete'
      ? `<details class="work-hints"><summary>Help with the channel</summary><p>${esc(SPRING_HINTS[spring.hint])}</p>${spring.hint < 3 ? button('Show a more specific hint', 'galilee-hint') : ''}</details>`
      : '';
  const screen =
    target.site && screenCanMove(s, target.id)
      ? `<details class="screen-preview-controls" ${preview ? 'open' : ''}><summary>Preview a screen position</summary><p>A dotted frame shows the proposal. Your placed screen stays where it is until you apply it.</p><div class="screen-directions" role="group" aria-label="Preview direction">${DIRECTIONS.map((direction, i) => button(direction[0]!.toUpperCase() + direction.slice(1), 'work-preview', String(i), false, `aria-pressed="${preview?.direction === i}"`)).join('')}</div>${preview ? `<p class="preview-description" role="status">${esc(previewDescription(s, preview))}</p><div class="preview-choices">${button('Use this position', 'work-preview-apply', '', preview.direction === shelter.screen)}${button('Discard preview', 'work-preview-cancel')}</div>` : ''}</details>`
      : '';
  const supplies = target.site
    ? `<div class="work-supplies" aria-label="Supplies at this site">${REST_SUPPLIES.map((id) => `<span class="rest-socket"><strong>${id}</strong> ${shelter.site === target.site && shelter.placed.includes(id) ? 'Placed' : s.campaign.carrying === 'rest-' + id ? 'In your hands' : 'At the rack'}</span>`).join('')}</div>`
    : '';
  const related = target.related.length
    ? `<details class="work-targets"><summary>Choose a nearby work target</summary><p>Select a target to approach it. Actions become available within reach.</p><div class="work-target-list">${target.related.map((p) => button(p.title + (p.status ? ' · ' + p.status : ''), 'work-visit', p.id, p.id === targetId)).join('')}</div></details>`
    : '';
  return `<section class="work-panel" role="dialog" aria-modal="false" aria-labelledby="work-title" data-work-target="${esc(target.id)}"><header class="work-header"><div><p class="eyebrow">${target.family === 'spring' ? 'A SPRING FOR TRAVELERS' : target.family === 'shelter' ? 'ROOM UNDER THE OLIVES' : 'WITHIN REACH'}</p><h2 id="work-title">${esc(target.title)}</h2></div><button class="icon-button" data-action="close" aria-label="Close menu">${icon('close')}</button></header><div class="work-body"><p class="work-state">${esc(target.status)}</p>${supplies}<div class="work-actions">${actionButtons || '<p>The work here is remembered. You can look closely or continue exploring.</p>'}</div><p class="work-result" role="status" aria-live="polite">${esc(feedback)}</p>${screen}${hint}${related}</div><footer class="work-footer">${button('Read the full inspection', 'work-inspect', target.id)}${button('Frame the work', 'work-frame', target.id)}<span>Walk away or press Escape to leave. Progress is saved.</span></footer></section>`;
}
