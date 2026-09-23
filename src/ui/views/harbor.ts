import { harborText } from '../../content/harbor/conversations';
import type { GameState } from '../../game/types';
import { harborActions } from '../../content/harbor/actions';
import { harborPlace, harborPlaces } from '../../content/harbor/places';
import {
  HARBOR_CELLS,
  HARBOR_HINTS,
  harborCellBlocked,
  traceHarbor,
} from '../../game/harbor/arrangement';
import { harborGoal } from '../../game/harbor/objectives';
import { escapeHtml as esc } from '../icons';
import type { JournalFilter } from './journal';
const button = (label: string, action: string, value = '', disabled = false) =>
  `<button class="secondary-button" data-action="${action}" data-value="${esc(value)}" ${disabled ? 'disabled' : ''}>${esc(label)}</button>`;
export function harborPlan(s: GameState): string {
  const h = s.harbor,
    result = traceHarbor(h);
  const cells = HARBOR_CELLS.map((c) => {
    const blocked = harborCellBlocked(h, c),
      onPath = h.tested && result.path.some((p) => p.x === c.x && p.z === c.z);
    const cargo =
      c.x === 0 && c.z === 2 && !h.cargo.nets
        ? 'Net cargo'
        : c.x === 2 && c.z === 0 && !h.cargo.jars
          ? 'Jar cargo'
          : '';
    const label =
      cargo ||
      (c.x === 1
        ? !blocked
          ? 'Plank'
          : 'Wet stone'
        : c.x === 0 && c.z === 1
          ? 'Entrance'
          : c.x === 2 && c.z === 1
            ? 'Landing'
            : 'Dry stone');
    return `<g data-harbor-cell="${c.x},${c.z}"><rect x="${15 + c.x * 104}" y="${38 + (2 - c.z) * 67}" width="96" height="59" rx="6" class="${onPath ? 'traced' : blocked ? 'blocked' : 'dry'}"/><text x="${63 + c.x * 104}" y="${73 + (2 - c.z) * 67}" text-anchor="middle">${label}</text>${onPath ? `<circle cx="${99 + c.x * 104}" cy="${48 + (2 - c.z) * 67}" r="4"/>` : ''}</g>`;
  }).join('');
  return `<figure class="harbor-plan"><svg viewBox="0 0 334 257" role="img" aria-label="Landing plan: enter from the west, cross the wet middle strip on the north or south side, and reach the landing to the east."><text x="167" y="23" text-anchor="middle">North ↑ · West entrance → East landing</text>${cells}<text x="167" y="252" text-anchor="middle">${h.cleared ? 'Entrance rope coiled' : 'Loose rope across the entrance'}</text></svg><figcaption>Plank: ${h.plank === 'rack' ? 'on the rack' : h.plank + ' crossing'} · ${h.turn === 0 ? 'east–west' : 'north–south'}. Net cargo: ${h.cargo.nets ? 'stored' : 'north approach'}. Jar cargo: ${h.cargo.jars ? 'stored' : 'south approach'}.</figcaption></figure>${h.tested ? `<p class="harbor-test-result" role="status">${esc(result.message)}</p>` : ''}`;
}
export function harborHints(s: GameState): string {
  const h = s.harbor;
  if (h.stage === 'not-started' || h.stage === 'complete') return '';
  return `<details class="work-hints"><summary>Help with the landing</summary><p>${esc(HARBOR_HINTS[h.hint])}</p>${h.hint < 3 ? button('Show a more specific hint', 'harbor-action', 'hint') : ''}</details>`;
}
export function harborContext(
  id: string,
  s: GameState,
): { title: string; body: string } | undefined {
  const p = harborPlace(id);
  if (!p) return;
  const actions = harborActions(s).filter((a) => a.target === id);
  return {
    title: p.name,
    body: `<section class="harbor-inspection"><p class="eyebrow">ORIGINAL ${id === 'eliab' ? 'DIALOGUE' : 'NARRATION'} · A CLEAR WAY TO THE WATER</p><p class="panel-lead">${esc(harborText(id, s))}</p>${harborPlan(s)}<div class="context-actions">${actions.map((a) => `<div>${button(a.label, 'harbor-action', a.id + '|' + a.event.expected, !!a.blocker)}${a.blocker ? `<p class="action-blocker">${esc(a.blocker)}</p>` : ''}</div>`).join('')}</div>${harborHints(s)}<details class="work-targets"><summary>Places around the landing</summary><div class="work-target-list">${harborPlaces
      .filter((p) => p.id !== id)
      .map((p) => button('Approach ' + p.name, 'travel', p.id))
      .join(
        '',
      )}</div></details><p class="content-note">An original traveler story. Your arrangements are saved; either crossing is equally useful. This work does not change the Gospel account.</p></section>`,
  };
}
export function harborSummary(s: GameState, filter: JournalFilter): string {
  if (filter !== 'all' && filter !== 'harbor') return '';
  const goal = harborGoal({ ...s, tracking: 'harbor' })!;
  return `<section class="campaign-stories harbor-summary" aria-label="Working landing story"><article><p class="eyebrow">OPTIONAL · ORIGINAL SHORE ADVENTURE</p><h3>${goal.title}</h3><span class="status-pill">${s.harbor.stage === 'not-started' ? 'Available' : s.harbor.stage === 'complete' ? 'Complete' : 'In progress'}</span><p>${esc(goal.text)}</p>${button(s.tracking === 'harbor' ? 'Tracked' : 'Track this story', 'track-story', 'harbor')}${button('Find the next stop', 'travel', goal.target)}${s.harbor.stage !== 'not-started' ? harborPlan(s) : ''}</article></section>`;
}
