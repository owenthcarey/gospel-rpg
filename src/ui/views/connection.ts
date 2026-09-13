import type { GameState } from '../../game/types';
import { ACCOUNTS, HOME_CHOICES, type HomeVisit } from '../../game/connection/types';
import { accounts, isPresenting } from '../../game/connection/accounts';
import { routePlan } from '../../game/connection/routes';
import { chapters, storyStatus, trackedChapter } from '../../content/campaign/chapters';
import { STORY_TRACKS } from '../../game/campaign/types';
import {
  homeAvailable,
  homePlaces,
  homeReady,
  homeChoices,
  homeConversation,
} from '../../content/connection/home';
import { regions } from '../../content/regions';
import { journalEntries } from '../../content/story';
import { heldReturn } from '../../game/life/objectives';
import { distance } from '../../game/pathfinding';
import { escapeHtml as esc } from '../icons';
export const STORY_STATUSES = ['all', 'active', 'available', 'completed'] as const;
export type StoryStatusFilter = (typeof STORY_STATUSES)[number];
const button = (label: string, action: string, value = '') =>
  `<button class="secondary-button" data-action="${action}" data-value="${esc(value)}">${esc(label)}</button>`;
export function statusToolbar(status: StoryStatusFilter): string {
  return `<nav class="story-status-tabs" aria-label="Story status">${STORY_STATUSES.map((id) => `<button class="secondary-button" data-action="journal-status" data-value="${id}" aria-pressed="${id === status}">${id === 'all' ? 'All statuses' : id === 'active' ? 'Active' : id === 'available' ? 'Available' : 'Completed'}</button>`).join('')}</nav>`;
}
export function statusStories(s: GameState, status: StoryStatusFilter, filter: string): string {
  const ids = STORY_TRACKS.filter(
    (id) =>
      (filter === 'all' || filter === id) &&
      (status === 'all' ||
        storyStatus(s, id) ===
          ({ active: 'in-progress', available: 'available', completed: 'complete' } as const)[
            status
          ]),
  );
  return `<section class="connection-stories" aria-label="Stories by status">${ids.map((id) => `<article><span class="eyebrow">${esc(chapters[id].label)}</span><h3>${esc(chapters[id].title)}</h3><span class="status-pill">${esc(storyStatus(s, id).replaceAll('-', ' '))}</span><div class="story-actions">${button('Open story', 'open-story', id)}${chapters[id].available(s) ? button(s.tracking === id ? 'Tracked' : 'Track this story', 'track-story', id) : ''}</div></article>`).join('') || `<p class="connection-empty">${status === 'active' ? 'No stories are in progress. Available stories offer places to begin.' : status === 'completed' ? 'No completed stories match this view. Your journey is still unfolding.' : 'No stories match this view. Choose All statuses to see the whole journey.'}</p>`}</section>`;
}
export function homeSummary(s: GameState): string {
  if (!homeAvailable(s))
    return '<section class="home-summary"><p class="eyebrow">OPTIONAL · ORIGINAL CLOSING INTERLUDE</p><h3>The way home</h3><p>Return visits with Leah, Hannah and Miriam become available after your Chapter IV reflection.</p></section>';
  return `<section class="home-summary"><p class="eyebrow">OPTIONAL · ORIGINAL CLOSING INTERLUDE</p><h3>The way home</h3><p>${s.connection.home.reflection ? esc(homeChoices[s.connection.home.reflection]!.text) : 'Return to Leah, Hannah and Miriam in any order. These visits are complete even if you left earlier work unfinished.'}</p>${button(s.tracking === 'home' ? 'Tracked' : 'Track The way home', 'track-story', 'home')}<div class="connection-stories">${homePlaces.map((p) => `<article><h4>${esc(p.name)}</h4><p>${s.connection.home.visits[p.visit] ? esc(homeChoices[s.connection.home.visits[p.visit]!]!.text) : 'A conversation waiting for your return.'}</p>${button(s.connection.home.visits[p.visit] ? 'Visit again' : 'Follow the path', 'travel', p.id)}</article>`).join('')}</div>${homeReady(s) && !s.connection.home.reflection ? `<p>All three visits are remembered. The familiar landing offers a closing reflection.</p>${button('Return to the familiar landing', 'travel', 'home-shore')}` : ''}</section>`;
}
export function homeContext(id: string, s: GameState): { title: string; body: string } | undefined {
  const place = homePlaces.find((p) => p.id === id && p.region === s.region);
  if (!place || !homeAvailable(s)) return;
  const conversation = homeConversation(s, place.visit);
  const remembered = s.connection.home.visits[place.visit];
  const near = distance(s.position, place) < 2.8;
  const choices = (visit: HomeVisit) =>
    HOME_CHOICES[visit]
      .map(
        (choice) =>
          `<button class="primary-button" data-action="home-remember" data-value="${visit}:${choice}" ${near ? '' : 'disabled'}>${esc(homeChoices[choice]!.title)}</button>`,
      )
      .join('');
  return {
    title: place.name,
    body: `<section class="home-encounter"><p class="caption-source">Original dialogue and traveler narration · ${conversation.speaker}, a fictional neighbor</p>${conversation.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}${remembered ? `<blockquote><strong>Your remembered choice</strong><p>${esc(homeChoices[remembered]!.text)}</p></blockquote>` : `<div class="context-actions">${choices(place.visit)}</div>`}${place.visit === 'shore' && homeReady(s) && !s.connection.home.reflection ? `<h3>What will you carry from this journey?</h3><p>This is a stopping place for the four-chapter journey. All paths and unfinished stories stay open.</p><div class="context-actions">${(['onward', 'remain'] as const).map((choice) => `<button class="primary-button" data-action="home-reflect" data-value="${choice}" ${near ? '' : 'disabled'}>${esc(homeChoices[choice]!.title)}</button>`).join('')}</div>` : ''}${s.connection.home.reflection ? `<p class="closing-memory">${esc(homeChoices[s.connection.home.reflection]!.text)}</p>` : ''}${!near ? '<p>Approach this place to share a memory.</p>' : ''}${button('See the return visits', 'open-story', 'home')}</section>`,
  };
}
export function replayLibrary(s: GameState): string {
  const ordinaryScene = isPresenting(s) && !s.connection.replay;
  return `<p class="panel-lead">Revisit completed Gospel accounts. Your reflections, journal and ordinary journey stay as you left them.</p>${ordinaryScene ? '<p class="held-notice">Return from the current Gospel account before starting a replay. Your unread place will be kept.</p>' : ''}<div class="replay-library">${ACCOUNTS.map(
    (id) => {
      const account = accounts[id],
        complete = account.complete(s);
      return `<section><p class="eyebrow">${esc(account.reference)}</p><h3>${esc(account.title)}</h3>${complete ? `<ol>${account.scenes.map((b) => `<li><button class="secondary-button" data-action="replay-open" data-value="${id}:${b.id}" ${ordinaryScene ? 'disabled' : ''}>${esc(b.title)}</button></li>`).join('')}</ol>` : '<p>Available after completing this chapter. The transcript remains available in the journal.</p>'}</section>`;
    },
  ).join('')}</div>`;
}
export function recap(s: GameState, compact = false): string {
  const chapter = trackedChapter(s),
    last = journalEntries[s.journal.at(-1) ?? 'arrival']!,
    route = routePlan(s);
  const unfinished = STORY_TRACKS.filter((id) => storyStatus(s, id) === 'in-progress');
  const held = heldReturn(s);
  const replay = s.connection.replay;
  const summary = `<p><strong>${esc(regions[s.region].title)}</strong> · ${esc(chapter.title)}</p>${replay ? `<p>Replay: ${esc(accounts[replay.account].title)} · ${esc(accounts[replay.account].scenes.find((b) => b.id === replay.checkpoint)!.title)}</p>` : ''}<p class="recap-memory"><strong>Last remembered: ${esc(last.title)}</strong></p>`;
  const detail = `<p>${esc(last.text)}</p><div class="recap-details">${route ? `<article><h4>Your saved route</h4><p>${esc(route.title)} · ${esc(route.message)}</p>${button('Resume route', 'route-resume')}${button('Cancel route', 'cancel-navigation')}</article>` : ''}${held ? `<article><h4>In your hands</h4><p>${esc(held.text)}</p>${button('Find the return point', 'travel', held.target)}</article>` : s.episode.carrying ? `<article><h4>In your hands</h4><p>The empty basket belongs at the shore landing.</p>${button('Find the landing', 'travel', 'landing')}</article>` : ''}${['walking', 'arrived', 'invited'].includes(s.campaign.walk.stage) ? `<article><h4>Amos · Capernaum lanes</h4><p>Your walk waits where you left it.</p>${button('Find Amos', 'travel', 'amos')}</article>` : ''}${['invited', 'walking', 'arrived'].includes(s.road.company.stage) ? `<article><h4>Neri · ${esc(regions[s.road.company.region].title)}</h4><p>Your companion keeps his place on the road.</p>${button('Find Neri', 'travel', 'neri')}</article>` : ''}</div><h4>Unfinished stories</h4>${unfinished.length ? `<ul>${unfinished.map((id) => `<li>${button(chapters[id].title, 'open-story', id)}</li>`).join('')}</ul>` : '<p>No stories are currently in progress. Choose a story whenever you are ready.</p>'}${homeAvailable(s) && !s.connection.home.reflection ? `<p>The way home offers three return visits after Peace, be still.</p>${button('See The way home', 'open-story', 'home')}` : ''}`;
  // Welcome is informative only: controls requiring a loaded world appear in the in-game recap.
  return compact
    ? `<section class="welcome-recap" aria-label="Saved journey recap">${summary}<details><summary>Where you left off</summary><p>${esc(last.text)}</p>${route ? `<p>Saved route: ${esc(route.title)}. Resume it after continuing.</p>` : ''}${held ? `<p>${esc(held.text)}</p>` : s.episode.carrying ? '<p>Your empty basket belongs at the shore landing.</p>' : ''}${['walking', 'arrived', 'invited'].includes(s.campaign.walk.stage) ? '<p>Amos waits in the Capernaum lanes.</p>' : ''}${['walking', 'arrived', 'invited'].includes(s.road.company.stage) ? `<p>Neri waits at ${esc(regions[s.road.company.region].title)}.</p>` : ''}<p>${unfinished.length} unfinished ${unfinished.length === 1 ? 'story' : 'stories'}. Find your full Journey recap in the journal after continuing.</p></details></section>`
    : `<section class="journey-recap">${summary}${detail}</section>`;
}
