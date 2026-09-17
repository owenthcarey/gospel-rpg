import type { GameState, Settings } from '../../game/types';
import { musicTracks } from '../../content/audio/music';
import { cueForState, regionAudio } from '../../content/audio/cues';
import { escapeHtml } from '../icons';

export function audioSettings(settings: Settings, state?: GameState): string {
  const track = musicTracks[(state ? cueForState(state) : regionAudio.capernaum).track];
  const sliders = [
    ['volume', 'Master volume', 'All game audio'],
    ['musicVolume', 'Music volume', 'Original regional scores'],
    ['ambienceVolume', 'Ambience volume', 'Water, wind, and quiet interiors'],
    ['effectsVolume', 'Effects volume', 'Footsteps, rowing, and interactions'],
  ] as const;
  return `<div class="audio-settings"><h3>Music &amp; sound</h3>
    <label class="setting-row"><span>Game audio<small>Original music, ambience, and sound effects</small></span><input type="checkbox" data-setting="sound" ${settings.sound ? 'checked' : ''}></label>
    ${sliders.map(([key, title, detail]) => `<label class="setting-row"><span>${title}<small>${detail}</small></span><input type="range" min="0" max="1" step="0.05" value="${settings[key]}" data-setting="${key}" aria-label="${title}"></label>`).join('')}
    <div class="soundtrack-note"><span class="eyebrow">MUSIC FOR THIS PLACE</span><strong>${escapeHtml(track.title)}</strong><p>${escapeHtml(track.description)}</p><small>Nine original compositions follow your journey. Music softens while you read. Set any channel to zero to silence it.</small></div>
    </div>`;
}
