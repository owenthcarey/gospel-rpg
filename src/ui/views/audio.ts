import type { GameState, Settings } from '../../game/types';
import { musicTracks } from '../../content/audio/music';
import { cueForState, regionAudio } from '../../content/audio/cues';
import { escapeHtml } from '../icons';

export const volumePercent = (value: number): string => Math.round(value * 100) + '%';

export function audioSettings(
  settings: Settings,
  state?: GameState,
  heard: ReadonlySet<string> = new Set(),
  chosen?: string,
): string {
  const area = (state ? cueForState(state) : regionAudio.capernaum).track;
  const current = chosen && heard.has(chosen) ? chosen : area;
  const track = musicTracks[current as keyof typeof musicTracks];
  // The classic music list: heard scores in green and playable, those still ahead in red.
  const list = Object.entries(musicTracks)
    .map(([id, t]) => {
      const state = `${heard.has(id) ? 'heard' : 'not yet heard'}${id === current ? ', playing' : ''}`;
      const item = heard.has(id)
        ? `<button class="music-track" data-action="music-play" data-value="${id}" aria-pressed="${id === current}">${escapeHtml(t.title)}<span class="sr-only"> · ${state}</span></button>`
        : `${escapeHtml(t.title)}<span class="sr-only"> · ${state}</span>`;
      return `<li class="${heard.has(id) ? 'heard' : 'unheard'}${id === current ? ' current' : ''}">${item}</li>`;
    })
    .join('');
  const areaButton = chosen
    ? `<button class="text-button music-area" data-action="music-area">Return to area music</button>`
    : '';
  const sliders = [
    ['volume', 'Master volume', 'All game audio'],
    ['musicVolume', 'Music volume', 'Original regional scores'],
    ['ambienceVolume', 'Ambience volume', 'Water, wind, and quiet interiors'],
    ['effectsVolume', 'Effects volume', 'Footsteps, rowing, and interactions'],
  ] as const;
  return `<div class="audio-settings"><h3>Music &amp; sound</h3>
    <label class="setting-row"><span>Game audio<small>Original music, ambience, and sound effects</small></span><input type="checkbox" data-setting="sound" ${settings.sound ? 'checked' : ''}></label>
    ${sliders
      .map(([key, title, detail]) => {
        const level = volumePercent(settings[key]);
        return `<label class="setting-row"><span>${title}<small>${detail}</small></span><span class="audio-control"><output for="audio-${key}" aria-hidden="true">${level}</output><input id="audio-${key}" type="range" min="0" max="1" step="0.05" value="${settings[key]}" data-setting="${key}" aria-label="${title}" aria-valuetext="${level}"></span></label>`;
      })
      .join('')}
    <div class="soundtrack-note"><span class="eyebrow">${chosen && heard.has(chosen) ? 'NOW PLAYING · CHOSEN' : 'MUSIC FOR THIS PLACE'}</span><strong>${escapeHtml(track.title)}</strong><p>${escapeHtml(track.description)}</p><small>Nine original compositions follow your journey. Music softens while you read. Set any channel to zero to silence it.</small><ul class="music-list" aria-label="Music heard on this device">${list}</ul>${areaButton}</div>
    </div>`;
}
