import { lakePracticalActions } from '../../content/lake/actions';
import type { GameState } from '../../game/types';
import { chapters, storyStatus } from '../../content/campaign/chapters';
import { lakeGateways, localLakePlaces } from '../../content/lake/places';
import { lakeGateAllowed } from '../../game/lake/progress';
import {
  LAKE_EVIDENCE,
  LAKE_INTERPRETATIONS,
  LAKE_ENDINGS,
  STORM_SCENES,
  STORM_REFLECTIONS,
} from '../../game/lake/types';
import { lakeGoal } from '../../game/lake/objectives';
import {
  joelRecollection,
  lakeEvidence,
  interpretations,
  crossingHints,
  stormReflections,
} from '../../content/lake/journal';
import { stormBeat, stormBeats } from '../../content/lake/scenes';
import { STORM_SOURCE, stormVerses } from '../../content/lake/scripture';
import { gospelControls } from './gospel';
import type { JournalFilter } from './journal';
import { escapeHtml as esc } from '../icons';
const button = (label: string, action: string, value = '', primary = false) =>
  `<button class="${primary ? 'primary-button' : 'secondary-button'}" data-action="${action}" data-value="${esc(value)}">${esc(label)}</button>`;

export function crossingEvidence(s: GameState): string {
  const t = s.lake.trail;
  if (t.stage === 'not-started') return '';
  return `<section class="crossing-evidence" aria-label="Lake navigation evidence"><h3>Joel’s recollection</h3><p>${esc(joelRecollection)}</p><div class="crossing-observations">${LAKE_EVIDENCE.map((id) => `<article><h4>${esc(lakeEvidence[id].title)}</h4><p>${t.evidence.includes(id) ? esc(lakeEvidence[id].text) : 'Not yet studied. Approach this landmark by boat.'}</p>${button('Navigate to ' + (id === 'reeds' ? 'the reed bank' : 'the split rock'), 'travel', 'lake-' + id)}</article>`).join('')}</div>${t.evidence.length === 2 && t.stage === 'exploring' ? `<h3>Which landing fits both observations?</h3><div class="context-actions">${LAKE_INTERPRETATIONS.map((id) => button(interpretations[id].label, 'lake-interpret', id)).join('')}</div>` : ''}${t.interpretation ? `<p class="crossing-feedback" role="status">${esc(interpretations[t.interpretation].text)}</p>` : ''}${t.stage !== 'complete' ? `<details class="crossing-hints"><summary>Optional navigation hints</summary><p>${esc(crossingHints[t.hint] ?? crossingHints[0]!)}</p>${t.hint < 3 ? button('Show a more specific hint', 'lake-hint') : '<p>The map can guide the boat along a clear route.</p>'}</details>` : ''}</section>`;
}
export function lakeSummary(s: GameState, filter: JournalFilter = 'all'): string {
  if (filter !== 'all' && !['storm', 'crossing'].includes(filter)) return '';
  if (s.road.chapter.stage !== 'complete')
    return '<p class="content-note">Across the Lake opens after your reflection at Nain.</p>';
  return `<section class="campaign-stories" aria-label="Across the Lake stories">${(
    ['storm', 'crossing'] as const
  )
    .filter((id) => filter === 'all' || filter === id)
    .map(
      (id) =>
        `<article><span class="eyebrow">${esc(chapters[id].label)}</span><h3>${esc(chapters[id].title)}</h3><span class="status-pill">${storyStatus(s, id).replaceAll('-', ' ')}</span><p>${esc(lakeGoal({ ...s, tracking: id })!.text)}</p>${button(s.tracking === id ? 'Tracked' : 'Track this story', 'track-story', id)}</article>`,
    )
    .join(
      '',
    )}</section>${filter === 'all' || filter === 'storm' ? button('Read Peace, be still transcript', 'transcript', 'storm') : ''}${filter === 'all' || filter === 'crossing' ? crossingEvidence(s) : ''}<p class="content-note">Ordinary boating and the navigation story are original fiction. The Gospel viewpoint follows Mark 4:35–41 separately. Your boat and supplies stay at the cove.</p>`;
}
export function lakeContext(id: string, s: GameState): { title: string; body: string } | undefined {
  if (s.road.chapter.stage !== 'complete') return;
  const gate = lakeGateways.find((g) => g.id === id && g.from === s.region);
  if (gate) {
    const boarding = gate.to === 'galilee-water';
    return {
      title: boarding ? 'An ordinary crossing' : gate.name,
      body: `<p class="caption-source">Original traveler journey · Compressed, imagined geography</p><p class="panel-lead">${boarding ? 'Steer with WASD or arrow keys, or click/tap clear water. Choose a named destination on the map to follow a safe route around rocks. At a landing, approach and choose Dock and step ashore. You can always return to Capernaum.' : 'The boat rests beside the landing. Step ashore to explore; your boat will wait here for your return.'}</p><p>Menus pause the crossing. Cancel walk also stops the boat. Nothing is lost by taking another route. ${s.campaign.carrying ? 'Your carried supply stays with you, stowed aboard while you row.' : 'There is no timer or damage.'}</p>${lakeGateAllowed(s, gate) ? button(boarding ? 'Board the boat' : 'Dock and step ashore', 'journey', gate.id, true) : '<p class="held-notice">Approach this landing with your boat before continuing.</p>'}${button('See connected places', 'journey-map')}`,
    };
  }
  const p = localLakePlaces(s).find((p) => p.id === id);
  if (!p) return;
  const t = s.lake.trail,
    c = s.lake.chapter;
  const text: Record<string, string> = {
    joel:
      t.stage === 'complete'
        ? t.ending === 'attention'
          ? '“You took time to look. The same water can seem a different place when its landmarks become familiar.”'
          : '“I am glad there was a welcome at the far landing. You are welcome here again, too.”'
        : '“There is a boat you may use at the landing. Two shores lie across this stretch of water. I remember a sheltered place beyond the stone headland. Would you look for it?”',
    'lake-reeds': lakeEvidence.reeds.text,
    'lake-split-rock': lakeEvidence['split-rock'].text,
    'reed-shore':
      'Reeds stand beside an open sweep of water. The low resting bench offers a view of the crossing. This landing faces outward, with no headland in front of it.',
    'cove-shore':
      'The wooden berth faces inward behind the long stone headland. The open lake is visible through its entrance. This is the sheltered landing Joel remembered.',
    'storm-viewpoint':
      c.stage === 'complete'
        ? 'Your chosen reflection remains in the journal. The full account is available to read again.'
        : 'From this quiet cove, follow a narrated view of Mark 4:35–41. Your traveler does not steer the Gospel boat or change the account. Storm motion is restrained, without flashing imagery; pause, reduced motion and a summary are available.',
    'cove-lookout':
      'The rock headland lies below the lookout. Beyond its shelter, open water catches the light. You can stay a moment without a task to finish.',
    dalia:
      c.stage === 'aftermath' || c.stage === 'complete'
        ? '“Welcome back. There is room beside the shelter if you would like to rest. I am glad you found your way here.”'
        : '“The landing is tucked behind the stone. Boats find a quiet place here. The path to the lookout stays open.”',
  };
  let body = `<p class="caption-source">${p.kind === 'person' ? 'Original dialogue' : 'Original narration'} · An imagined shore</p><p class="panel-lead">${esc(text[id] ?? 'A place along the crossing.')}</p>`;
  body += `<div class="context-actions">${lakePracticalActions(s)
    .filter((a) => a.target === id)
    .map(
      (a) =>
        `<button class="primary-button" data-action="lake-action" data-value="${esc(a.id.slice(5))}" ${a.blocker ? 'disabled' : ''}>${esc(a.label)}</button>${a.blocker ? `<p class="held-notice">${esc(a.blocker)}</p>` : ''}`,
    )
    .join('')}</div>`;
  if (id === 'joel' && t.stage === 'arrived')
    body += `<div class="context-actions">${LAKE_ENDINGS.map((ending) => button(ending === 'attention' ? 'Remember looking closely' : 'Remember the welcome', 'lake-ending', ending, true)).join('')}</div>`;
  if (id === 'joel' && t.stage !== 'not-started') body += crossingEvidence(s);
  if (id === 'storm-viewpoint') {
    if (c.stage === 'aftermath' && c.aftermath.length === 3)
      body += `<h3>What stays with you?</h3><div class="context-actions">${STORM_REFLECTIONS.map((id) => button(stormReflections[id].title, 'storm-reflect', id, true)).join('')}</div>`;
    body += button('Read the complete transcript', 'transcript', 'storm');
  }
  return { title: p.name, body };
}
export function stormControls(s: GameState, paused: boolean): string {
  const b = stormBeat(s.lake.chapter.checkpoint ?? 'evening');
  return gospelControls(
    {
      ...b,
      chapter: 'Peace, be still',
      index: STORM_SCENES.indexOf(b.id),
      total: STORM_SCENES.length,
      captions: [
        { label: 'Original narration · Visual interpretation', text: b.narration },
        { label: 'Scripture · WEB · Mark ' + b.verse, text: stormVerses[b.verse], scripture: true },
      ],
      nextAction: 'storm-next',
      returnLabel: 'Return to the cove',
    },
    paused,
    s.connection.replay?.account,
  );
}
export function stormTranscript(): string {
  return `<p class="panel-lead">Mark 4:35–41 · World English Bible. The traveler’s boating is an original interlude. Reading this transcript does not advance the chapter.</p>${stormBeats.map((b) => `<article class="transcript-scene"><h3>${esc(b.title)}</h3><p class="caption-source">Original narration</p><p>${esc(b.narration)}</p><p class="caption-source">Scripture · WEB · Mark ${b.verse}</p><blockquote>${esc(stormVerses[b.verse])}</blockquote><details><summary>Describe this scene</summary><p>${esc(b.description)}</p></details></article>`).join('')}<p><a href="${STORM_SOURCE.url}" target="_blank" rel="noopener noreferrer">Read the public-domain source · Mark 4</a></p>`;
}
export function stormSummary(s: GameState): string {
  return `<p class="caption-source">Original summary of Mark 4:35–41</p><p class="panel-lead">At evening Jesus and the disciples cross the sea, with other small boats. A storm fills their boat with water while Jesus sleeps at the stern. The disciples wake him. He rebukes the wind and commands the sea to be still; a great calm follows. He questions their fear and faith, and they ask who he is, that even the wind and sea obey him.</p><p>All seven scenes and the complete words remain in the journal. Return to your ordinary boat and the cove’s aftermath.</p>${button('Return to the aftermath', 'storm-summary', s.lake.chapter.checkpoint ?? '', true)}`;
}
