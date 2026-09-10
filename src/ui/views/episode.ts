import { campaignQuest } from './campaign';
import { gospelControls } from './gospel';
import { sceneBeats, beatFor } from '../../content/episode/scenes';
import { SCRIPTURE_SOURCE } from '../../content/episode/scripture';
import { reflectionEntries } from '../../content/episode/journal';
import {
  episodeRows,
  mainObjective,
  mainTarget,
  mainTitle,
  preludeRows,
} from '../../game/episode/objectives';
import { SCENE_IDS } from '../../game/episode/types';
import { villageObjective, villageTarget, discoveryOrder } from '../../game/quest';
import type { GameState } from '../../game/types';
import { escapeHtml as esc, icon } from '../icons';

export function questView(state: GameState): string {
  const campaign = campaignQuest(state);
  if (campaign) return campaign;
  const village = state.tracking === 'village';
  const title = village ? 'An ordinary morning' : mainTitle(state);
  const objective = village ? villageObjective(state) : mainObjective(state);
  const target = village ? villageTarget(state) : mainTarget(state);
  const done = village ? state.villageStory === 'complete' : state.episode.stage === 'complete';
  const rows = village
    ? [
        {
          id: 'invitation',
          label: 'Speak with Ezra',
          target: 'ezra',
          done: state.villageStory !== 'not-started',
        },
        ...discoveryOrder.map((id) => ({
          id,
          label: {
            well: 'Remember the well',
            olive: 'Rest beneath the olives',
            shore: 'Look across the lake',
          }[id],
          target: id,
          done: state.discoveries.includes(id),
        })),
        { id: 'return', label: 'Return to Ezra', target: 'ezra', done },
      ]
    : state.quest === 'complete'
      ? episodeRows(state)
      : preludeRows(state);
  const count = rows.filter((row) => row.done).length;
  const current = rows.find((row) => !row.done)?.id;
  return [
    '<div class="quest-eyebrow"><span class="quest-diamond">✧</span><span>' +
      (village ? 'VILLAGE STORY' : 'CHAPTER I') +
      '</span><span class="quest-count">' +
      (done ? 'COMPLETE' : count + ' / ' + rows.length) +
      '</span></div>',
    '<h1>' + esc(title) + '</h1>',
    '<p class="current-objective">' + esc(objective) + '</p>',
    '<div class="quest-details"><ol class="quest-steps">',
    ...rows.map(
      (row) =>
        '<li class="' +
        (row.done ? 'done' : row.id === current ? 'current' : '') +
        '"><span class="step-mark">' +
        (row.done ? icon('check') : '') +
        '</span>' +
        esc(row.label) +
        '</li>',
    ),
    '</ol></div>',
    '<button class="quest-track" data-action="' +
      (done ? 'journal' : 'navigate') +
      '" data-value="' +
      esc(done ? 'memories' : target) +
      '">' +
      icon(done ? 'journal' : 'compass') +
      '<span>' +
      (done ? 'Read your memories' : 'Follow the path') +
      '</span>' +
      icon('arrow') +
      '</button>',
    '<button class="compact-journal text-button" data-action="journal" data-value="stories">Open full journal</button>',
    '<div class="quest-details"><div class="quest-reference">' +
      (village
        ? 'An optional story · Your own pace'
        : state.quest === 'complete'
          ? 'PRELUDE COMPLETE · Luke 5:1–11'
          : 'Inspired by Luke 5:1–11') +
      '</div>',
    '<button class="village-shortcut" data-action="track-story" data-value="' +
      (village ? 'main' : 'village') +
      '">' +
      icon('leaf') +
      '<span>' +
      (village ? 'Track the main story' : 'An ordinary morning') +
      '<small>' +
      (village ? 'Into the Deep' : 'Track Ezra’s optional village story') +
      '</small>' +
      icon('arrow') +
      '</button></div>',
  ].join('');
}
export function episodeSummary(state: GameState): string {
  const e = state.episode;
  return (
    '<section class="episode-summary" aria-label="Into the Deep">' +
    '<div class="episode-summary-heading"><span class="chapter-icon">' +
    icon('compass') +
    '</span><div><span class="eyebrow">CHAPTER I · LUKE 5:1–11</span><h3>Into the Deep</h3></div><span class="status-pill">' +
    (e.stage === 'complete'
      ? 'Complete'
      : e.stage === 'witnessing'
        ? 'In progress'
        : e.stage === 'aftermath'
          ? 'Back on shore'
          : e.stage === 'preparing'
            ? 'Preparing the shore'
            : state.quest === 'complete'
              ? 'Available'
              : 'After the first errand') +
    '</span></div>' +
    '<p>' +
    esc(mainObjective(state)) +
    '</p>' +
    '<ol class="episode-objectives">' +
    episodeRows(state)
      .map(
        (row) =>
          '<li class="' +
          (row.done ? 'done' : '') +
          '">' +
          icon(row.done ? 'check' : 'pin') +
          '<span>' +
          esc(row.label) +
          '</span></li>',
      )
      .join('') +
    '</ol>' +
    (e.reflection
      ? '<blockquote class="saved-reflection"><strong>' +
        esc(reflectionEntries[e.reflection].title) +
        '</strong><p>' +
        esc(reflectionEntries[e.reflection].text) +
        '</p></blockquote>'
      : '') +
    '<div class="story-actions"><button class="secondary-button" data-action="track-story" data-value="main">' +
    icon('compass') +
    (state.tracking === 'main' ? 'Main story tracked' : 'Track main story') +
    '</button>' +
    (state.region === 'capernaum' && e.stage !== 'complete'
      ? '<button class="secondary-button" data-action="travel" data-value="' +
        mainTarget(state) +
        '">Go to the next stop ' +
        icon('arrow') +
        '</button>'
      : '') +
    '<button class="secondary-button" data-action="transcript" data-value="lake">' +
    icon('journal') +
    'Read the Gospel scenes</button></div></section>'
  );
}
export function sceneControls(state: GameState, paused: boolean): string {
  if (state.region !== 'lake-gennesaret' || !state.episode.checkpoint) return '';
  const b = beatFor(state.episode.checkpoint);
  return gospelControls(
    {
      ...b,
      chapter: 'Into the Deep',
      index: SCENE_IDS.indexOf(b.id),
      total: SCENE_IDS.length,
      captions: b.captions.map((c) => ({
        label: c.speaker + ' · ' + c.provenance + (c.reference ? ' · ' + c.reference : ''),
        text: c.text,
        scripture: c.provenance === 'Scripture · WEB',
      })),
      description: b.journal.text,
      noticeLabel: 'Pause and notice',
      nextAction: 'scene-next',
      returnLabel: 'Return to village',
    },
    paused,
  );
}
export function transcriptView(state: GameState): string {
  return (
    '<p class="panel-lead">The account of the catch and calling, with the same scripture and original narration used in the lake scenes. Your traveler remains a shore-side witness. Reading this transcript does not advance the episode.</p>' +
    '<a class="source-link" href="' +
    SCRIPTURE_SOURCE.url +
    '" target="_blank" rel="noopener noreferrer">Luke 5:1–11 · World English Bible ' +
    icon('arrow') +
    '</a>' +
    '<div class="transcript">' +
    sceneBeats
      .map(
        (beat, i) =>
          '<article id="transcript-' +
          beat.id +
          '" class="transcript-beat ' +
          (state.episode.checkpoint === beat.id ? 'current-beat' : '') +
          '"><span class="eyebrow">SCENE ' +
          (i + 1) +
          '</span><h3>' +
          esc(beat.title) +
          '</h3>' +
          beat.captions
            .map(
              (caption) =>
                '<p class="caption-source">' +
                esc(caption.speaker) +
                ' · ' +
                esc(caption.provenance) +
                (caption.reference ? ' · ' + esc(caption.reference) : '') +
                '</p><p>' +
                esc(caption.text) +
                '</p>',
            )
            .join('') +
          '<p class="transcript-notice">' +
          esc(beat.observation) +
          '</p></article>',
      )
      .join('') +
    '</div>'
  );
}
export function sceneSummaryView(state: GameState): string {
  return (
    '<p class="panel-lead">Finish the lake presentation at your own pace. This action records the remaining scenes and returns your traveler to the village aftermath.</p>' +
    '<div class="summary-account"><p class="caption-source">Original narration · Summary of Luke 5:1–11</p>' +
    '<p>Jesus taught from Simon’s boat, then asked him to put out into the deep and lower the nets. After a night without a catch, Simon answered that he would do so at Jesus’ word.</p>' +
    '<p>The catch was so great that the net began to break. Their partners came to help, and both boats filled. Simon responded in astonishment. Jesus told him not to be afraid and spoke of his calling.</p>' +
    '<p>When they brought their boats to land, they left everything and followed him. Your imagined traveler now returns to the shore, where there is time to help, speak with neighbors, and reflect.</p></div>' +
    '<p>The complete words and scene narration remain available in <strong>Read all scenes</strong>.</p>' +
    '<div class="story-actions"><button class="primary-button" data-action="scene-skip" data-value="' +
    esc(state.episode.checkpoint ?? '') +
    '">Return to the aftermath ' +
    icon('arrow') +
    '</button>' +
    '<button class="secondary-button" data-action="close">Keep reading this scene</button></div>'
  );
}
