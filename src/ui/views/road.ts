import { galileeAcknowledgement } from '../../content/galilee/conversations';
import type { GameState } from '../../game/types';
import {
  NAIN_SCENES,
  NAIN_REFLECTIONS,
  TRAIL_EVIDENCE,
  TRAIL_INTERPRETATIONS,
  TRAIL_ENDINGS,
  COMPANY_ROUTES,
  type TrailEvidence,
} from '../../game/road/types';
import { roadActions } from '../../content/road/actions';
import { localRoadPlaces } from '../../content/road/places';
import { COMPANY_PATHS, companyMeeting } from '../../content/road/routes';
import {
  tamarRecollection,
  trailEvidence,
  interpretationText,
  nainReflections,
} from '../../content/road/journal';
import { nainBeat, nainBeats, nainScripture } from '../../content/road/scenes';
import { NAIN_SOURCE } from '../../content/road/scripture';
import { chapters, roadChapters, storyStatus } from '../../content/campaign/chapters';
import { roadGoal, trailHint, trailTarget } from '../../game/road/objectives';
import { nainReadyReflection } from '../../game/road/progress';
import { regions } from '../../content/regions';
import type { JournalFilter } from './journal';
import { gospelControls } from './gospel';
import { escapeHtml as esc, icon } from '../icons';
const button = (label: string, action: string, value = '', primary = false) =>
  `<button class="${primary ? 'primary-button' : 'secondary-button'}" data-action="${action}" data-value="${esc(value)}">${esc(label)} ${icon('arrow')}</button>`;

/** A readable detail study of the same water, stones and branch marks modeled in the GLB. */
export function markerStudy(id: TrailEvidence): string {
  const spring = id === 'spring';
  return `<figure class="marker-study"><svg viewBox="0 0 360 180" role="img" aria-label="${esc(trailEvidence[id].detail)}"><rect width="360" height="180" rx="12" fill="#c2b58d"/><path d="M15 155Q170 120 345 157" stroke="#a99a76" stroke-width="12" fill="none"/>${spring ? '<ellipse cx="195" cy="142" rx="108" ry="22" fill="#72745d"/><ellipse cx="187" cy="136" rx="75" ry="15" fill="#629b98"/><path d="M145 123L143 38 202 24 218 121Z" fill="#505b53"/><path d="M195 69H158l14-13m-14 13 14 13" stroke="#eee4bc" stroke-width="5" fill="none"/>' : '<path d="M109 140L108 28 161 21 176 140Z" fill="#e5dabe"/><path d="M193 141L198 64 245 53 260 141Z" fill="#d7cbaf"/><path d="M155 73H123l12-12m-12 12 12 12" stroke="#69573b" stroke-width="5" fill="none"/>'}<text x="20" y="25" fill="#35443c" font-size="12">WEST ←</text></svg><figcaption>Detail study · ${esc(trailEvidence[id].title)}. Readable description below.</figcaption></figure>`;
}
export function trailEvidenceView(s: GameState): string {
  const t = s.road.trail;
  if (t.stage === 'not-started') return '';
  return `<section class="road-evidence" aria-label="Tamar’s recollection and evidence"><h3>A way remembered · Your observations</h3><blockquote>${esc(tamarRecollection)}</blockquote><div class="evidence-cards">${TRAIL_EVIDENCE.map((id) => `<article><h4>${esc(trailEvidence[id].title)}</h4><p>${t.evidence.includes(id) ? esc(trailEvidence[id].detail) : 'Not yet examined. You may inspect either marker first.'}</p><span class="status-pill">${t.evidence.includes(id) ? 'Recorded' : 'To observe'}</span></article>`).join('')}</div>${t.interpretation ? `<p class="interpretation-feedback" role="status">${esc(interpretationText[t.interpretation].response)}</p>` : ''}<div class="road-hint"><h4>Guidance · ${t.hint === 0 ? 'A direction' : `Hint ${t.hint} of 3`}</h4><p>${esc(trailHint(s))}</p>${t.stage !== 'complete' && t.hint < 3 ? button('Show a more specific hint', 'road-hint') : ''}${t.hint === 3 || ['arrived', 'complete'].includes(t.stage) || (t.evidence.length === 2 && t.stage === 'exploring') ? button(t.stage === 'exploring' && t.evidence.length === 2 ? 'Compare with Tamar' : 'Find the next detail', 'travel', trailTarget(s)) : ''}</div></section>`;
}
export function companyOverview(s: GameState): string {
  const c = s.road.company,
    meeting = companyMeeting(c);
  return `<section class="company-overview" aria-label="Company on the road"><h3>Neri · ${esc(regions[c.region].title)}</h3><p>${c.stage === 'complete' ? 'Your walk is remembered. Neri rests beside the courtyard bench.' : 'Neri waits when you stop, leave the region, or go too far ahead. A doorway brings him with you only after you have reached its meeting point together.'}</p>${button('Find Neri', 'travel', 'neri')}${meeting ? button('Walk to the next meeting place', 'travel', 'neri-meeting') : ''}${c.route ? `<ol class="company-route">${COMPANY_PATHS[c.route].map((p, i) => `<li class="${i < c.step ? 'done' : i === c.step ? 'current' : ''}" ${i === c.step ? 'aria-current="step"' : ''}><strong>${esc(p.name)}</strong><span>${esc(regions[p.region].title)} · ${i < c.step ? 'Reached together' : esc(p.description)}</span></li>`).join('')}</ol>` : '<p>Choose the shaded way or the open terraces with Neri at the farm.</p>'}</section>`;
}
export function roadSummary(s: GameState, filter: JournalFilter): string {
  return `<section class="campaign-stories road-stories" aria-label="Beyond Capernaum">${roadChapters
    .filter((id) => filter === 'all' || filter === id)
    .map((id) => {
      const ch = chapters[id],
        available = ch.available(s);
      return `<article><span class="eyebrow">${esc(ch.label)}</span><h3>${esc(ch.title)}</h3><span class="status-pill">${storyStatus(s, id).replaceAll('-', ' ')}</span><p>${available ? esc(roadGoal({ ...s, tracking: id })!.text) : 'Available after your reflection in Through the Roof.'}</p>${available ? button(s.tracking === id ? 'Tracked' : 'Track this story', 'track-story', id) : ''}</article>`;
    })
    .join(
      '',
    )}</section>${s.campaign.roof.stage === 'complete' && (filter === 'all' || filter === 'nain') ? `<div class="context-actions">${button('Read At the gate transcript', 'transcript', 'nain')}${button('Open the journey map', 'journey-map')}</div><p class="content-note">The road and farm compress an imagined journey at a later time. They do not establish a precise route or chronology between Gospel accounts. Tamar, Neri and Adina are fictional travelers and neighbors.</p>` : ''}${filter === 'all' || filter === 'trail' ? trailEvidenceView(s) : ''}${(filter === 'all' || filter === 'company') && s.road.company.stage !== 'not-started' ? companyOverview(s) : ''}`;
}
function roadProse(id: string, s: GameState): string {
  const t = s.road.trail,
    c = s.road.company;
  if (id === 'tamar')
    return t.stage === 'complete'
      ? 'Tamar smiles at the shared recollection. “Now the place has a way leading to it again. Thank you for taking time to look.”'
      : t.stage === 'arrived'
        ? '“The split olive, and the two pale stones! That is the place.” Tamar makes room beside her. “What shall we remember about finding it again?”'
        : tamarRecollection;
  if (id === 'neri')
    return c.stage === 'complete'
      ? `“I am glad we shared the ${c.route === 'shade' ? 'shade beneath the olives' : 'view across the terraces'}.” Neri remains seated in the courtyard. “There is still room for company here.”`
      : c.stage === 'arrived'
        ? '“Here we are, together.” Neri looks toward the quiet bench. “The road feels different when someone remembers it with you.”'
        : c.stage === 'walking'
          ? '“I will wait here whenever you need to leave. We can continue from the same place.” Neri’s next meeting point is marked on the road and in your journal.'
          : '“I am going to Nain. Would you care to walk together? We can follow the olives or take the open terraces. Either road will bring us to the gate.”';
  if (id === 'farm-landmark')
    return 'The shelter stands on dry ground. An olive trunk divides into two branches beside it. Two pale stones mark the approach. These are the details Tamar remembers.';
  if (id === 'lake-view')
    return 'The low land opens behind the road. A distant blue glimmer recalls the lake. This view and the compressed route are artistic interpretations, not a surveyed landscape or a precise travel itinerary.';
  if (id === 'adina')
    return ['aftermath', 'complete'].includes(s.road.chapter.stage)
      ? 'Adina makes room beside her. “You may stay a while. There is no need to have words ready.” This fictional neighbor offers company after the account; she does not supply testimony or dialogue for Luke’s unnamed people.'
      : '“There is room by the gate.” Adina points toward the open way. “You can come and go at your own pace.” Adina is a fictional neighbor in the traveler’s story.';
  if (id === 'nain-courtyard')
    return 'A bench, a little shade and room beside the wall. This courtyard belongs to the original traveler’s setting. You may rest here before or after reading the account.';
  if (id === 'nain-viewpoint')
    return s.road.chapter.stage === 'complete'
      ? 'Your reflection is kept in the journal. The complete Gospel transcript remains available, and the road is still open.'
      : s.road.chapter.stage === 'witnessing'
        ? 'Your place in Luke’s account is kept. Resume the presentation at the same checkpoint.'
        : s.road.chapter.stage === 'aftermath'
          ? 'The account is complete. Return to the gate, spend a moment in the courtyard, and listen to Adina. Then choose what stays with you; all three reflections are welcome.'
          : 'At this gate, a narrated presentation follows Luke 7:11–17. You remain an observer. Optional work on the road is never a condition for the account. The scene includes a funeral procession and a mother’s grief, without graphic imagery. You may leave or read a summary at any time.';
  return '';
}
export function roadContext(id: string, s: GameState): { title: string; body: string } | undefined {
  const p = localRoadPlaces(s).find((p) => p.id === id);
  if (!p) return;
  const evidence = id === 'road-spring' ? 'spring' : id === 'road-terrace' ? 'terrace' : undefined;
  const t = s.road.trail,
    c = s.road.company;
  let body = `<p class="eyebrow">ORIGINAL ${p.kind === 'person' ? 'CONVERSATION' : 'NARRATION'} · ARTISTIC INTERPRETATION</p>`;
  if (evidence) {
    body += `${markerStudy(evidence)}<p class="panel-lead">${esc(trailEvidence[evidence].detail)}</p>${t.evidence.includes(evidence) ? '<p class="remembered-detail">Recorded in your journal.</p>' : t.stage === 'exploring' ? button('Record this observation', 'road-evidence', evidence, true) : '<p>These details may help someone remember a place along the road. Tamar is nearby.</p>'}`;
  } else
    body += `<p class="panel-lead">${esc(roadProse(id, s))} ${esc(galileeAcknowledgement(id, s))}</p>`;
  body += `<div class="context-actions">${roadActions
    .filter((a) => a.target === id && a.available(s))
    .map((a) =>
      button(
        a.id === 'nain-enter' && s.road.chapter.stage === 'witnessing'
          ? 'Resume Luke’s account'
          : a.label,
        'road-action',
        a.id,
        true,
      ),
    )
    .join('')}</div>`;
  if (id === 'tamar' && t.stage === 'exploring' && t.evidence.length === 2)
    body += `<section class="route-interpretation"><h3>Which way matches both details?</h3><p>Choose a route using the observations you recorded. A mismatch leaves your evidence intact.</p>${TRAIL_INTERPRETATIONS.map((choice) => button(interpretationText[choice].label, 'road-interpret', choice)).join('')}${t.interpretation ? `<p class="interpretation-feedback" role="status">${esc(interpretationText[t.interpretation].response)}</p>` : ''}</section>`;
  if (id === 'tamar' && t.stage === 'arrived')
    body += `<div class="context-actions">${TRAIL_ENDINGS.map((ending) => button(ending === 'observation' ? 'Remember looking closely' : 'Remember the company', 'road-ending', ending, true)).join('')}</div>`;
  if (id === 'tamar' && t.stage !== 'not-started' && t.stage !== 'complete')
    body += trailEvidenceView(s);
  if (id === 'neri' && c.stage === 'invited' && !c.route)
    body += `<div class="context-actions">${COMPANY_ROUTES.map((route) => button(route === 'shade' ? 'Walk beneath the olives' : 'Walk across the open terraces', 'road-route', route, true)).join('')}</div>`;
  if (id === 'neri' && c.stage !== 'not-started') body += companyOverview(s);
  if (id === 'nain-viewpoint' && s.road.chapter.stage === 'aftermath' && nainReadyReflection(s))
    body += `<h3>What stays with you?</h3><div class="context-actions">${NAIN_REFLECTIONS.map((reflection) => button(nainReflections[reflection].title, 'nain-reflect', reflection, true)).join('')}</div>`;
  if (id === 'nain-viewpoint') body += button('Read the complete transcript', 'transcript', 'nain');
  return { title: p.name, body };
}
export function nainControls(s: GameState, paused: boolean): string {
  const b = nainBeat(s.road.chapter.checkpoint ?? 'approach');
  return gospelControls(
    {
      ...b,
      chapter: 'At the gate',
      index: NAIN_SCENES.indexOf(b.id),
      total: NAIN_SCENES.length,
      captions: [
        { label: 'Original narration · Visual interpretation', text: b.narration },
        { label: 'Scripture · WEB · ' + b.reference, text: nainScripture(b), scripture: true },
      ],
      nextAction: 'nain-next',
      returnLabel: 'Return to the gate',
    },
    paused,
  );
}
export function nainTranscript(): string {
  return `<p class="panel-lead">Luke 7:11–17 · World English Bible, public domain. Scripture is quoted separately from the original narration and scene descriptions. Reading here does not change your checkpoint.</p>${nainBeats.map((b) => `<article class="transcript-beat"><span class="eyebrow">${esc(b.reference)}</span><h3>${esc(b.title)}</h3><p class="caption-source">Original narration</p><p>${esc(b.narration)}</p><p class="caption-source">Scripture · WEB</p><blockquote>${esc(nainScripture(b))}</blockquote><p><strong>Scene description:</strong> ${esc(b.description)}</p><p>${esc(b.observation)}</p></article>`).join('')}<p><a href="${NAIN_SOURCE.url}" target="_blank" rel="noopener noreferrer">Read Luke 7:11–17 · World English Bible</a></p><p class="content-note">The publisher notes that “only born” in verse 12 is also translated “only begotten” or “one and only”. The gate, carrying frame, clothing and movements are artistic interpretations. Luke does not record the son’s speech; the presentation supplies none.</p>`;
}
export function nainSummary(s: GameState): string {
  return `<p class="caption-source">Original summary of Luke 7:11–17</p><p class="panel-lead">Jesus approaches Nain with his disciples and a multitude. At the gate, a dead young man is being carried out. He is his mother’s only son, and she is a widow. Jesus has compassion on her, touches the coffin, and tells the young man to arise. He sits up and begins to speak; Jesus gives him to his mother. The people glorify God, and the report spreads.</p><p>All six scene memories and the complete transcript remain in the journal. Return to the gate and courtyard, listen to Adina, then choose a reflection. Optional traveler stories remain available.</p>${button('Return to the aftermath', 'nain-summary', s.road.chapter.checkpoint ?? '', true)}`;
}
