# Music and sound

The Way has nine original instrumental compositions, written specifically for this game. Their palette takes inspiration from early browser RPG soundtracks: clear woodwind melodies, plucked accompaniment, rounded bass, little bell answers, restrained strings, and hand percussion. No RuneScape melodies, arrangements, samples, recordings, soundfonts, or other third-party audio are used. These are new authored scores, not arrangements of existing songs.

Each piece has a four-bar introduction, an eight-bar theme, a changed-instrument reprise, an eight-bar contrasting bridge, a returning theme with bell answers, and a four-bar turnaround. The complete 40-bar loops total about 16 minutes. Timbres are deliberately synthetic and evoke a small old-school instrument bank.

## Soundtrack

| ID                 | Title                      | Primary setting                         | Tempo / meter | Loop |
| ------------------ | -------------------------- | --------------------------------------- | ------------- | ---- |
| `first-light`      | First Light on the Water   | Capernaum shore                         | 98 / 4/4      | 1:38 |
| `lantern-lanes`    | Lanterns in the Lanes      | Village lanes                           | 112 / 4/4     | 1:26 |
| `bread-and-embers` | Bread and Embers           | Bakehouse                               | 88 / 3/4      | 1:22 |
| `olive-path`       | Where the Olives Grow      | Road and farm                           | 102 / 4/4     | 1:34 |
| `small-sails`      | Small Sails, Wide Sky      | Crossing, reeds, evening boats          | 78 / 3/4      | 1:32 |
| `open-door`        | Through an Open Door       | Gathering house and early Gospel scenes | 72 / 4/4      | 2:13 |
| `at-the-gate`      | A Stillness at the Gate    | Nain and the procession                 | 66 / 4/4      | 2:25 |
| `gathering-wind`   | When the Wind Gathers      | Storm and waking                        | 108 / 4/4     | 1:29 |
| `a-great-calm`     | And There Was a Great Calm | Cove, restored life, abundance, calm    | 70 / 4/4      | 2:17 |

Story cues follow the displayed checkpoint, including replay. The storm resolves at the command; Nain resolves at restoration and remains hopeful afterward. Entering another region with the same track leaves its musical position intact. Different tracks crossfade over 1.8 seconds.

## Player experience

Audio starts after a user gesture. New preferences enable it at a modest master volume; an existing saved mute remains muted. Settings offers a master switch and independent master, music, ambience, and effects sliders, plus the title of the current regional composition. Zero silences a channel. Menus and dialogue soften the music without restarting it. Hiding the tab suspends the audio clock and scheduler; returning resumes the same passage. Browser audio failures never prevent gameplay.

Effects accompany actual movement and successful actions: footsteps, oars, pickups, placing objects, repairs, water work, page turns, discoveries, travel, and completion. Motion effects stop with the traveler; teleports do not produce a burst of footsteps. Seven quiet synthesized soundscapes cover shores, open water, village air, country wind, rooms, hearths, and storm wind. No spoken dialogue or voice imitations are generated.

Audio preferences are separate from journey saves. Missing channel settings receive defaults through `parseSettings`, so old preferences and all v10 journey files remain readable without a save-version bump.

## Architecture and extension points

| Module                          | Responsibility                                                         |
| ------------------------------- | ---------------------------------------------------------------------- |
| `src/content/audio/music.ts`    | Original themes, chords, tempo, instrumentation, and titles            |
| `src/content/audio/score.ts`    | Deterministic arrangement of themes into timed score events            |
| `src/content/audio/cues.ts`     | Complete region map and story/replay music direction                   |
| `src/content/audio/effects.ts`  | Named sound-effect recipes                                             |
| `src/content/audio/feedback.ts` | Semantic feedback for accepted game events                             |
| `src/audio/types.ts`            | Small renderer-independent note/track/effect contracts                 |
| `src/audio/synth.ts`            | Shared original instrument recipes, envelopes, noise, room impulse     |
| `src/audio/music-player.ts`     | Audio-clock scheduling, looping, crossfades, voice retirement          |
| `src/audio/ambience.ts`         | Continuously modulated environmental textures                          |
| `src/scene/audio.ts`            | One application-owned audio context, buses, lifecycle, motion feedback |
| `src/ui/views/audio.ts`         | Accessible controls and regional track information                     |

The graph is `track gains → music bus`, `soundscape → ambience bus`, and `one-shots → effects bus`, all feeding a master gain and compressor. A shared short stereo reverb belongs to the music bus, so muting music also mutes its reverb. Music uses a 50 ms scheduler with a 200 ms look-ahead and exact `AudioContext.currentTime` note timestamps. Main-thread stalls skip missed notes rather than playing a catch-up burst. No per-frame oscillator creation occurs. Voices disconnect on completion, each synth limits live voices, and at most three performances overlap during rapid transitions. Hot reload disposes the entire audio graph and gesture listeners.

### Add a track

1. Add a composition to `compositions` in `music.ts`. Choose a unique ID, title, description, tempo, three- or four-beat meter, lead instrument, plucked instrument, and character.
2. Write **eight bars each** for the A and B themes. Each melody token is `pitch/duration`, where duration is in quarter-note beats: `D5/1 F#5/0.5 E5/0.5 A4/2`. Use `-/1` for a one-beat rest. Every bar must total the selected meter; the arranger throws on malformed durations or pitches. Chords are four space-separated pitches, e.g. `D3 F#3 A3 E4`; the first is the bass root. Keep the chord registers similar to existing scores.
3. Assign the track in `regionAudio` or a checkpoint override in `cueForState`. `Record<RegionId, AudioCue>` requires a mapping whenever a region is added. `TrackId` is derived from the catalog, preventing misspelled assignments.
4. Run the tests and render the whole score. Listen to the introduction, bridge, return, loop boundary, and its transition from the neighboring region. Compare levels at the same master setting.

For unusual meters, bespoke orchestration, or a different form, a track can supply its own sorted `MusicTrack.notes` rather than use `arrange`. Keep the scheduler independent of composition rules. For future recorded music, add a separate buffer-backed player at the music bus boundary and retain the same cue resolver and settings; loading/streaming that media would be a new capability, not a change to gameplay reducers.

### Add an effect or instrument

Add an effect ID to `SoundEffect`, then its note recipe to `soundEffects`. Effect beats/durations are seconds. Route it from `feedbackForEvent` for accepted events, or the motion mapping for physical work. Avoid firing both for the same sound. Add an instrument to the `Instrument` union and `timbres` (or a specialized voice branch) without putting musical logic in the scene renderer.

## Render and verify

```sh
npm run check
npx playwright test tests/e2e/audio.spec.ts
npm run audio:render
npm run audio:render -- --track first-light --seconds 30
npm run audio:render -- --track gathering-wind --offset 45 --seconds 25 --out /tmp/the-way-audio
```

The rendering tool starts a temporary local Vite server and headless Chromium, imports the same score and synthesizer, and writes stereo 32 kHz PCM WAVs plus a JSON peak/RMS report to `artifacts/audio/` (ignored by Git). Full exports include a two-second release tail; these are listening renders, not the runtime loop transport. Export gain is fixed for comparison, independent of saved player settings. Excerpt offsets omit notes that began before the excerpt. There are no additional runtime dependencies or audio downloads. Install Chromium with `npx playwright install chromium` if necessary.

Unit coverage checks score bounds, meter validation, all regions, narrative resolution, replay isolation, preference migration, exact scheduler timing, missed-frame recovery, and retirement after rapid changes. Browser tests measure actual Web Audio output, channel silence, gesture unlocking, saved mute, background suspension, footstep effects, scene transitions, and graceful handling of unavailable audio on desktop and phone layouts. Phone tests use browser emulation; physical-device listening and final artistic mix review remain useful before release.

The scheduler follows the browser's [Web Audio scheduling guidance](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Advanced_techniques) and [user-gesture audio guidance](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices).
