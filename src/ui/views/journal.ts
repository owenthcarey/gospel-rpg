import type { GameState } from '../../game/types';
import type { StoryTrack } from '../../game/campaign/types';
import { STORY_TRACKS } from '../../game/campaign/types';
import { chapters } from '../../content/campaign/chapters';
import { journalEntries } from '../../content/story';
import { lifeJournal } from '../../content/life/journal';
import { hasReturned } from '../../game/episode/progress';
import { allInteractables } from '../../content/region';
import { placeRegion } from '../../content/campaign/places';
import { regions } from '../../content/regions';
import { knownRegions, journeyPlaces } from '../../content/journey';
import { escapeHtml as esc } from '../icons';

export const JOURNAL_CATEGORIES = ['stories', 'people', 'places', 'memories'] as const;
export type JournalCategory = (typeof JOURNAL_CATEGORIES)[number];
export type JournalFilter = 'all' | StoryTrack;
export function journalToolbar(category: JournalCategory, filter: JournalFilter): string {
  return `<nav class="journal-categories" aria-label="Journal categories">${JOURNAL_CATEGORIES.map((id) => `<button class="secondary-button" aria-pressed="${category === id}" data-action="journal-category" data-value="${id}">${id[0]!.toUpperCase() + id.slice(1)}</button>`).join('')}</nav>${category === 'stories' || category === 'memories' ? `<label class="journal-filter">Story <select data-journal-filter aria-label="Filter journal by story"><option value="all" ${filter === 'all' ? 'selected' : ''}>All stories</option>${STORY_TRACKS.map((id) => `<option value="${id}" ${filter === id ? 'selected' : ''}>${esc(chapters[id].title)}</option>`).join('')}</select></label>` : ''}`;
}
export function journalTrack(id: string): StoryTrack {
  if (id.startsWith('trail-')) return 'trail';
  if (id.startsWith('company-')) return 'company';
  if (id.startsWith('nain-')) return 'nain';
  if (id.startsWith('thread-')) return 'belonging';
  if (id.startsWith('bench-')) return 'rest';
  if (id.startsWith('walk-')) return 'neighbors';
  if (id.startsWith('table-')) return 'table';
  if (id.startsWith('roof-') || id.startsWith('neighbor-note-')) return 'roof';
  if (id.startsWith('ezra-') || ['well', 'olive', 'shore'].includes(id)) return 'village';
  return 'main';
}
export function memoryEntries(s: GameState, filter: JournalFilter = 'all', limit?: number): string {
  const ids = [...s.journal]
    .reverse()
    .filter((id) => filter === 'all' || journalTrack(id) === filter)
    .slice(0, limit);
  return `<div class="journal-entries">${
    ids
      .map((id) => {
        const entry = journalEntries[id]!;
        return `<article class="journal-entry" data-memory="${id}"><span class="entry-number">${String(s.journal.indexOf(id) + 1).padStart(2, '0')}</span><div><p class="eyebrow">${esc(chapters[journalTrack(id)].title)}</p><h3>${esc(entry.title)}</h3><p>${esc(entry.text)}</p><span class="reference-tag">${esc(entry.reference ?? 'Original traveler memory')}</span></div></article>`;
      })
      .join('') || '<p>No memories recorded for this story yet.</p>'
  }</div>`;
}
export function threadEvidence(s: GameState): string {
  if (s.life.thread.stage === 'not-started') return '';
  return `<section class="thread-evidence" aria-label="Investigation evidence"><h3>Ruth’s pouch · Evidence</h3><p>Ruth remembers blue edging and two short stitches together. Compare both details before claiming the pouch.</p>${(['water', 'cloth'] as const).map((id) => `<article><h4>${id === 'water' ? 'Color · Water point' : 'Stitch · Bakehouse cloth'}</h4><p>${s.life.thread.clues.includes(id) ? esc(lifeJournal['thread-clue-' + id]!.text) : 'Not yet examined.'}</p><button class="text-button" data-action="travel" data-value="${id === 'water' ? 'thread-clue' : 'cloth-clue'}">${s.life.thread.clues.includes(id) ? 'Return to' : 'Find'} this clue</button></article>`).join('')}<button class="secondary-button" data-action="travel" data-value="sewing-rest">Find the shore resting place</button></section>`;
}
export function journalPeople(s: GameState): string {
  const seen = new Set<string>();
  return `<p class="panel-lead">People in the places you know. Their destinations follow the paths between regions.</p><div class="journal-directory">${allInteractables
    .filter((p) => {
      if (p.kind !== 'person' || seen.has(p.id)) return false;
      seen.add(p.id);
      const region = placeRegion(p.id, s) ?? 'capernaum';
      return region === 'capernaum' || knownRegions(s).some((id) => id === region);
    })
    .map((p) => {
      const departed = hasReturned(s.episode) && ['simon', 'jesus', 'james', 'john'].includes(p.id);
      const detail =
        p.id === 'ruth' && s.life.thread.stage === 'complete'
          ? 'Her pouch is safe beside her. Your shared memory is kept.'
          : p.id === 'miriam' && s.life.bench.stage === 'complete'
            ? 'Miriam remembers the useful seat beside the landing.'
            : p.id === 'amos' && s.campaign.walk.stage === 'complete'
              ? 'Your walk is remembered. Amos remains in the courtyard.'
              : p.role;
      return `<article><h3>${esc(p.name)}</h3><p>${esc(detail)}</p><p class="content-note">${['simon', 'jesus', 'james', 'john'].includes(p.id) ? 'Gospel figure · Traveler conversations are dramatized.' : 'Original fictional neighbor.'}</p>${departed ? '<p>The fishermen have followed Jesus. Their account remains in the transcripts.</p>' : `<button class="secondary-button" data-action="travel" data-value="${p.id}">Find ${esc(p.name)}</button>`}</article>`;
    })
    .join('')}</div>`;
}
export function journalPlaces(s: GameState): string {
  return `<p class="panel-lead">Places you have reached in this artistic interpretation of Galilee. Each destination offers a walk from your current region.</p><button class="secondary-button" data-action="journey-map">See the connected journey map</button><div class="journal-directory">${knownRegions(
    s,
  )
    .map(
      (id) =>
        `<article><h3>${esc(regions[id].title)}</h3><p>${esc(journeyPlaces[id].description)}</p><button class="secondary-button" data-action="travel" data-value="${journeyPlaces[id].destination}">Walk to this place</button></article>`,
    )
    .join('')}</div>`;
}
