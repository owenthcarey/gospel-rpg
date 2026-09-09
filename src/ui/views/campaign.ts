import { chapters, neighborhoodChapters, storyStatus } from '../../content/campaign/chapters';
import type { GameState, Point } from '../../game/types';
import { campaignGoal, localTarget } from '../../game/campaign/objectives';
import { ROOF_SCENES, ROOF_REFLECTIONS } from '../../game/campaign/types';
import { roofReadyReflection } from '../../game/campaign/progress';
import { worldActions, noteTargets } from '../../content/campaign/actions';
import { allNeighborhoodPlaces, gateways } from '../../content/campaign/places';
import { neighborhoodText } from '../../content/campaign/conversations';
import { neighborNotes, roofReflections } from '../../content/campaign/journal';
import { roofBeat, roofBeats, roofScripture } from '../../content/campaign/scenes';
import { ROOF_SOURCE } from '../../content/campaign/scripture';
import { campaignLayout } from '../../content/campaign/layouts';
import { regions } from '../../content/regions';
import { activeInteractables } from '../../content/region';
import { escapeHtml as esc, icon } from '../icons';
const button = (label: string, action: string, value = '', primary = false) =>
  `<button class="${primary ? 'primary-button' : 'secondary-button'}" data-action="${action}" data-value="${esc(value)}">${esc(label)} ${icon('arrow')}</button>`;
export function campaignQuest(s: GameState): string | undefined {
  const goal = campaignGoal(s);
  if (!goal) return;
  return `<div class="quest-eyebrow">✧ ${s.tracking === 'table' || s.tracking === 'neighbors' ? 'NEIGHBORHOOD STORY' : 'CHAPTER II'} <span class="quest-count">${goal.done ? 'COMPLETE' : 'YOUR PACE'}</span></div><h1>${esc(goal.title)}</h1><p class="current-objective">${esc(goal.text)}</p><div class="quest-details"><ol class="quest-steps">${goal.steps.map((t) => `<li>${esc(t)}</li>`).join('')}</ol></div>${button(goal.done ? 'Read your memories' : 'Follow the path', goal.done ? 'journal' : 'navigate', goal.target)}<button class="compact-journal text-button" data-action="journal">Choose a story</button><div class="quest-details"><p class="quest-reference">${s.tracking === 'table' || s.tracking === 'neighbors' ? 'Optional · Original neighborhood story' : 'Mark 2:1–12 · World English Bible'}</p></div>`;
}
export function campaignSummary(s: GameState): string {
  if (s.episode.stage !== 'complete')
    return '<p class="content-note">Chapter II opens after your reflection in Into the Deep.</p>';
  return `<section class="campaign-stories" aria-label="Neighborhood stories">${neighborhoodChapters
    .map((id) => {
      const chapter = chapters[id];
      const status = storyStatus(s, id);
      return `<article><span class="eyebrow">${chapter.label}</span><h3>${chapter.title}</h3><span class="status-pill">${status.replaceAll('-', ' ')}</span><p>${chapter.complete(s) ? 'Complete · Your choices are remembered.' : esc(campaignGoal({ ...s, tracking: id })!.text)}</p>${button(s.tracking === id ? 'Tracked' : 'Track this story', 'track-story', id)}</article>`;
    })
    .join(
      '',
    )}</section><div class="context-actions">${button('Read Into the Deep transcript', 'transcript', 'lake')}${button('Read Through the Roof transcript', 'transcript', 'roof')}</div><p class="content-note">Some days later, the traveler’s imagined journey continues in Capernaum. Amos, Hannah and Ruth are fictional neighbors. Their stories can be completed before or after witnessing the account.</p>`;
}
export function contextView(id: string, s: GameState): { title: string; body: string } | undefined {
  const place = allNeighborhoodPlaces.find((p) => p.id === id);
  if (!place) return;
  const gateway = gateways.find((g) => g.id === id && g.from === s.region);
  if (gateway)
    return {
      title: place.name,
      body: `<p class="panel-lead">${gateway.id === 'to-lanes' && s.campaign.roof.stage === 'not-started' ? 'Some days later, your imagined journey continues into the neighborhood. Your shore memories remain in the journal.' : 'Continue to ' + esc(regions[gateway.to].title) + '. Your place here will be remembered.'}</p>${button('Continue to ' + regions[gateway.to].title, 'journey', id, true)}`,
    };
  const actions = worldActions.filter((a) => a.target === id);
  const available = actions.filter((a) => a.available(s));
  const note = noteTargets[id];
  const reflection =
    id === 'house-viewpoint' && s.campaign.roof.stage === 'aftermath' && roofReadyReflection(s);
  const noteText = note ? neighborNotes[note] : undefined;
  return {
    title: place.name,
    body: `<p class="eyebrow">ORIGINAL ${place.kind === 'person' ? 'CONVERSATION' : 'NARRATION'}</p><p class="panel-lead">${esc(neighborhoodText(id, s))}</p>${s.campaign.carrying ? `<p class="held-notice">In your hands: ${esc(s.campaign.carrying.replaceAll('-', ' '))}</p>` : ''}<div class="context-actions">${available.map((a) => button(a.label, 'campaign-action', a.id, true)).join('')}${reflection ? ROOF_REFLECTIONS.map((id) => button(roofReflections[id].title, 'roof-reflect', id, true)).join('') : ''}</div>${noteText ? `<article class="context-note"><h3>${esc(noteText.title)}</h3><p>${esc(noteText.text)}</p>${noteText.reference ? `<p class="reference-tag">${esc(noteText.reference)}</p>` : ''}${s.campaign.notes.includes(note!) ? '<p>Remembered in your journal.</p>' : button('Remember this place', 'neighbor-note', note)}</article>` : ''}${!available.length && !reflection && actions.length ? `<p class="content-note">${esc(actions[0]!.requirement)}</p>` : ''}`,
  };
}
export function roofControls(s: GameState, paused: boolean): string {
  const beat = roofBeat(s.campaign.roof.checkpoint ?? 'house');
  return `<header class="scene-heading"><div><p class="eyebrow">THROUGH THE ROOF · ${ROOF_SCENES.indexOf(beat.id) + 1} / ${ROOF_SCENES.length}</p><h1 id="scene-title">${esc(beat.title)}</h1></div><button class="scene-pause" data-action="scene-pause" aria-pressed="${paused}">${paused ? 'Resume motion' : 'Pause motion'}</button></header><div class="scene-progress" aria-hidden="true">${ROOF_SCENES.map((id) => `<span class="${ROOF_SCENES.indexOf(id) <= ROOF_SCENES.indexOf(beat.id) ? 'reached' : ''}"></span>`).join('')}</div><div class="scene-reading"><div class="scene-caption"><p class="caption-source">Original narration · Visual interpretation</p><p class="scene-narration">${esc(beat.narration)}</p></div><div class="scene-caption scripture-caption"><p class="caption-source">Scripture · WEB · ${esc(beat.reference)}</p><p class="scene-scripture">${esc(roofScripture(beat))}</p></div><details class="scene-observation"><summary>Describe this scene</summary><p>${esc(beat.description)}</p><p>${esc(beat.observation)}</p></details></div><footer class="scene-footer"><button class="primary-button scene-continue" data-action="roof-next" data-value="${beat.id}">${esc(beat.continueLabel)} ${icon('arrow')}</button><div class="scene-secondary">${button('Read transcript', 'transcript')}${button('Finish with a summary', 'scene-summary')}${button('Return to the house', 'scene-leave')}</div><p class="scene-save-note">Your place is saved after each scene. Take your time.</p></footer>`;
}
export function roofTranscript(): string {
  return `<p class="panel-lead">Mark 2:1–12 · World English Bible. Scripture is public domain. Scene descriptions and traveler observations are original.</p>${roofBeats.map((b) => `<article class="transcript-beat"><span class="eyebrow">${b.reference}</span><h3>${esc(b.title)}</h3><p>${esc(b.narration)}</p><blockquote>${esc(roofScripture(b))}</blockquote><p><strong>Scene description:</strong> ${esc(b.description)}</p><p>${esc(b.observation)}</p></article>`).join('')}<p><a href="${ROOF_SOURCE.url}" target="_blank" rel="noopener noreferrer">Read Mark 2:1–12 · WEB</a></p><p>Parallel account, separately attributed: <a href="${ROOF_SOURCE.parallel}" target="_blank" rel="noopener noreferrer">Luke 5:17–26 · WEB</a>. Mark describes opening the roof; Luke mentions tiles. The game does not combine their wording into a new quotation.</p>`;
}
export function roofSummary(s: GameState): string {
  return `<p class="panel-lead">Four people bring a man to Jesus. Unable to reach him through the crowd, they open the roof and lower the man on his mat. Jesus speaks forgiveness, answers the scribes’ question about authority, and tells the man to rise and go home. The man rises, takes his mat, and goes out. The people are amazed and glorify God.</p><p>Original summary of Mark 2:1–12. All scene memories will be available in your journal; the full transcript stays available.</p>${button('Return to the aftermath', 'roof-summary', s.campaign.roof.checkpoint ?? '', true)}`;
}
export function neighborhoodMap(
  s: GameState,
  large: boolean,
  position?: Point,
): string | undefined {
  const layout = campaignLayout(s.region);
  if (!layout) return;
  const min = layout.bounds.min,
    max = layout.bounds.max,
    scale = 192 / (max - min);
  const x = (v: number) => (v - min) * scale,
    z = (v: number) => (max - v) * scale;
  const p = position ?? s.position;
  return `<svg class="map-svg" viewBox="0 0 192 192" aria-label="Map of ${esc(regions[s.region].title)}"><rect width="192" height="192" fill="${layout.inside ? '#b7a27d' : '#a1ac7b'}"/>${layout.paths.map(([a, b, w]) => `<path d="M${x(a.x)},${z(a.z)}L${x(b.x)},${z(b.z)}" stroke="#ded1a8" stroke-width="${w * scale}"/>`).join('')}${layout.obstacles.map((o) => `<rect x="${x(o.x - o.width / 2)}" y="${z(o.z + o.depth / 2)}" width="${o.width * scale}" height="${o.depth * scale}" fill="#786b53"/>`).join('')}${activeInteractables(
    s,
  )
    .map(
      (p) =>
        `<circle data-map-place="${p.id}" cx="${x(p.x)}" cy="${z(p.z)}" r="${large ? 3 : 2}" fill="#f1d58e" stroke="#4b584a"/>`,
    )
    .join(
      '',
    )}<g id="${large ? 'large' : 'mini'}map-player" transform="translate(${x(p.x)},${z(p.z)})"><circle r="5" fill="#29443e" stroke="#fff1c4"/><path d="m0-3 2 5-2-1-2 1z" fill="#fff1c4"/></g></svg>`;
}
export function carriedView(s: GameState): string {
  if (!s.campaign.carrying) return '';
  return `<article class="carried-object"><span class="item-art">${icon('bag')}</span><div><span class="eyebrow">IN YOUR HANDS</span><h3>${esc(s.campaign.carrying.replaceAll('-', ' '))}</h3><p>Carry one object at a time. You can return this to its bakehouse shelf and continue later.</p>${button('Find the next stop', 'travel', campaignGoal(s)?.target ?? localTarget(s, 'hannah'))}</div></article>`;
}
