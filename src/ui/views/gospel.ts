import { escapeHtml as esc, icon } from '../icons';
export interface GospelReading {
  id: string;
  chapter: string;
  title: string;
  index: number;
  total: number;
  captions: { label: string; text: string; scripture?: boolean }[];
  description?: string;
  observation: string;
  noticeLabel?: string;
  continueLabel: string;
  nextAction: string;
  returnLabel: string;
  transcriptLabel?: string;
  summaryLabel?: string;
}
/** One keyboard-scrollable, user-paced reading surface for every Gospel account. */
export function gospelControls(reading: GospelReading, paused: boolean): string {
  return `<header class="scene-heading"><div><p class="eyebrow">${esc(reading.chapter.toUpperCase())} · SCENE ${reading.index + 1} OF ${reading.total}</p><h1 id="scene-title">${esc(reading.title)}</h1></div><button class="scene-pause" data-action="scene-pause" aria-pressed="${paused}">${paused ? 'Resume motion' : 'Pause motion'}</button></header><div class="scene-progress" aria-label="Scene ${reading.index + 1} of ${reading.total}">${Array.from({ length: reading.total }, (_, i) => `<span class="${i <= reading.index ? 'reached' : ''}"></span>`).join('')}</div><div class="scene-reading" tabindex="0" aria-label="Scene text">${reading.captions.map((c) => `<article class="scene-caption ${c.scripture ? 'scripture-caption' : ''}"><p class="caption-source">${esc(c.label)}</p><p class="${c.scripture ? 'scene-scripture' : 'scene-narration'}">${esc(c.text)}</p></article>`).join('')}<details class="scene-observation"><summary>${esc(reading.noticeLabel ?? 'Describe this scene')}</summary>${reading.description ? `<p>${esc(reading.description)}</p>` : ''}<p>${esc(reading.observation)}</p></details></div><footer class="scene-footer"><button class="primary-button scene-continue" data-action="${reading.nextAction}" data-value="${esc(reading.id)}">${esc(reading.continueLabel)} ${icon('arrow')}</button><div class="scene-secondary"><button class="text-button" data-action="transcript">${esc(reading.transcriptLabel ?? 'Read all scenes')}</button><button class="text-button" data-action="scene-summary">${esc(reading.summaryLabel ?? 'Finish with summary')}</button><button class="text-button" data-action="scene-leave">${esc(reading.returnLabel)}</button></div><p class="scene-save-note">Your place is saved at each scene. Continue whenever you are ready.</p></footer>`;
}
