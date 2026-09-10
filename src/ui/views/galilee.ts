import type { GameState } from '../../game/types';
import {
  CHANNEL_IDS,
  REST_SUPPLIES,
  type ChannelId,
  type RestSite,
} from '../../game/galilee/types';
import {
  CHANNEL_CELLS,
  DIRECTIONS,
  ports,
  SPRING_HINTS,
  traceWater,
} from '../../game/galilee/channel';
import { checkArrangement, REST_LAYOUTS } from '../../game/galilee/arrangement';
import {
  galileeActions,
  galileeBlocker,
  canTurnChannel,
  galileeInReach,
} from '../../content/galilee/actions';
import { allGalileePlaces } from '../../content/galilee/places';
import { galileeText } from '../../content/galilee/conversations';
import { galileeGoal } from '../../game/galilee/objectives';
import { heldReturn } from '../../game/life/objectives';
import { chapters, storyStatus } from '../../content/campaign/chapters';
import type { JournalFilter } from './journal';
import { escapeHtml as esc } from '../icons';
const button = (label: string, action: string, value: string, disabled = false) =>
  `<button class="secondary-button" data-action="${action}" data-value="${esc(value)}" ${disabled ? 'disabled' : ''}>${esc(label)}</button>`;

export function channelPlan(s: GameState): string {
  const p = s.galilee.spring,
    flow = traceWater(p.turns);
  const wet = new Set(p.tested ? flow.path : []);
  const cell = (id: ChannelId) => {
    const c = CHANNEL_CELLS[id],
      x = 90 + c.x * 95,
      y = 135 - c.z * 85;
    const delta = [
      [0, -31],
      [31, 0],
      [0, 31],
      [-31, 0],
    ];
    return `<g data-channel="${id}"><rect x="${x - 36}" y="${y - 36}" width="72" height="72" rx="10" fill="#ddd0a3" stroke="#6c6348"/><path d="${ports(
      id,
      p.turns[id],
    )
      .map((d) => `M${x},${y}l${delta[d]![0]},${delta[d]![1]}`)
      .join(
        ' ',
      )}" fill="none" stroke="${wet.has(id) ? '#247784' : '#786e51'}" stroke-width="12"/><text x="${x}" y="${y + 48}" text-anchor="middle">${id}</text></g>`;
  };
  return `<figure class="channel-plan"><svg viewBox="0 0 360 280" role="img" aria-label="Channel plan. Source west of entry; turn east of entry; north and south branches each lead east to a basin."><text x="9" y="125">Source</text><path d="M7 135H54" stroke="#247784" stroke-width="9"/>${CHANNEL_IDS.map(cell).join('')}${(['north', 'south'] as const).map((id) => `<g><rect x="246" y="${id === 'north' ? 26 : 196}" width="67" height="48" rx="12" fill="${p.tested && flow.outlet === id ? '#247784' : '#c6b78c'}"/><text x="279" y="${id === 'north' ? 94 : 264}" text-anchor="middle">${id} basin</text></g>`).join('')}<text x="338" y="18">N ↑</text></svg><figcaption>Open ends must meet. Blue marks the water from your latest test.</figcaption></figure><ul class="channel-directions">${CHANNEL_IDS.map(
    (id) =>
      `<li><strong>${id[0]!.toUpperCase() + id.slice(1)}</strong>: ${ports(id, p.turns[id])
        .map((d) => DIRECTIONS[d])
        .join(' / ')} ${button('Approach ' + id, 'travel', 'channel-' + id)}</li>`,
  ).join('')}</ul>`;
}
function restPlan(s: GameState, site: RestSite): string {
  const r = s.galilee.shelter,
    selected = r.site === site;
  return `<section class="rest-plan" aria-label="Resting place plan"><h3>${esc(REST_LAYOUTS[site].title)}</h3><p>Approach from the south. ${selected && r.placed.includes('screen') ? 'Screen on the ' + DIRECTIONS[r.screen] + ' side.' : 'The screen has not been placed here.'}</p><div class="rest-sockets">${REST_SUPPLIES.map((id) => `<div class="rest-socket ${selected && r.placed.includes(id) ? 'filled' : ''}"><span>${id === 'mat' ? '▧' : id === 'water' ? '◉' : '▥'}</span><strong>${id}</strong><small>${selected && r.placed.includes(id) ? 'Placed' : s.campaign.carrying === 'rest-' + id ? 'In your hands' : 'At the rack'}</small></div>`).join('')}</div>${selected && r.checked ? `<p class="work-result" role="status">${esc(checkArrangement(r).message)}</p>` : ''}</section>`;
}
export function galileeContext(
  id: string,
  s: GameState,
): { title: string; body: string } | undefined {
  const place = allGalileePlaces.find((p) => p.id === id);
  if (!place || s.campaign.roof.stage !== 'complete') return;
  const spring = id.startsWith('spring-') || id.startsWith('channel-'),
    p = s.galilee.spring,
    r = s.galilee.shelter;
  const actions = galileeActions.filter(
    (a) => a.target === id && (a.visible?.(s) ?? a.available(s)),
  );
  const held = heldReturn(s);
  const rotation =
    id.startsWith('channel-') && CHANNEL_IDS.includes(id.slice(8) as ChannelId)
      ? (id.slice(8) as ChannelId)
      : null;
  return {
    title: place.name,
    body: `<div class="galilee-work"><p class="eyebrow">ORIGINAL ${place.kind === 'person' ? 'CONVERSATION' : 'NARRATION'} · ${spring ? 'A SPRING FOR TRAVELERS' : 'ROOM UNDER THE OLIVES'}</p><p class="panel-lead">${esc(galileeText(id, s))}</p>${held ? `<aside class="held-notice"><p>${esc(held.text)}</p>${button('Find the return point', 'travel', held.target)}</aside>` : ''}${spring && p.stage !== 'not-started' ? channelPlan(s) : ''}${id === 'rest-shade' || id === 'rest-breeze' ? restPlan(s, id === 'rest-shade' ? 'shade' : 'breeze') : ''}<div class="context-actions">${actions
      .map((a) => {
        const blocker = galileeBlocker(s, a);
        return `<div>${button(a.label, 'galilee-action', a.id, !!blocker)}${blocker ? `<p class="action-blocker">${esc(blocker)}</p>` : ''}</div>`;
      })
      .join(
        '',
      )}${rotation && p.stage !== 'complete' ? `${button('Turn this section clockwise', 'galilee-turn', rotation + ':' + p.turns[rotation], !canTurnChannel(s, id))}<p>Turn with free hands after inspecting and clearing both ends.</p>` : ''}${(id === 'rest-shade' || id === 'rest-breeze') && r.site === id.slice(5) && r.stage === 'arranging' && r.placed.includes('screen') ? button('Move the screen clockwise', 'galilee-screen', String(r.screen), !!s.campaign.carrying || !galileeInReach(s, id)) : ''}</div>${spring && p.tested ? `<p class="work-result" role="status">${esc(traceWater(p.turns).message)}</p>` : ''}${spring && !['not-started', 'complete'].includes(p.stage) ? `<details class="work-hints"><summary>Help with the channel</summary><p>${esc(SPRING_HINTS[p.hint])}</p>${p.hint < 3 ? button('Show a more specific hint', 'galilee-hint', '') : ''}</details>` : ''}${r.stage === 'ready' && !spring && id !== 'leah' ? button('Return to Leah to remember', 'travel', 'leah') : ''}<p class="content-note">Your work is saved. You can leave, return objects, or follow another story at any time.</p></div>`,
  };
}
export function galileeSummary(s: GameState, filter: JournalFilter): string {
  return `<section class="campaign-stories" aria-label="Living Galilee stories">${(
    ['spring', 'shelter'] as const
  )
    .filter((id) => filter === 'all' || filter === id)
    .map((id) => {
      const goal = galileeGoal({ ...s, tracking: id })!,
        c = chapters[id];
      return `<article><p class="eyebrow">${esc(c.label)}</p><h3>${esc(c.title)}</h3><span class="status-pill">${storyStatus(s, id).replaceAll('-', ' ')}</span><p>${esc(goal.text)}</p>${c.available(s) ? button(s.tracking === id ? 'Tracked' : 'Track this story', 'track-story', id) + button('Find the next stop', 'travel', goal.target) : ''}</article>`;
    })
    .join('')}</section>`;
}
