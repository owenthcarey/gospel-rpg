/** Render the same authored scores and synth as the game, for listening and audio QA. */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const { values } = parseArgs({
  options: {
    out: { type: 'string', default: 'artifacts/audio' },
    track: { type: 'string' },
    seconds: { type: 'string' },
    offset: { type: 'string', default: '0' },
  },
});
const seconds = values.seconds === undefined ? undefined : Number(values.seconds);
const offset = Number(values.offset);
if (
  (seconds !== undefined && (!Number.isFinite(seconds) || seconds <= 0 || seconds > 600)) ||
  !Number.isFinite(offset) ||
  offset < 0
)
  throw new Error('Use an offset >= 0 and a duration between 0 and 600 seconds.');
const output = resolve(values.out);
await mkdir(output, { recursive: true });
const server = await createServer({
  logLevel: 'error',
  server: { host: '127.0.0.1', port: 0, open: false },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(server.resolvedUrls.local[0]);
  const ids = await page.evaluate(async () =>
    Object.keys((await import('/src/content/audio/music.ts')).musicTracks),
  );
  if (values.track && !ids.includes(values.track))
    throw new Error('Unknown track: ' + values.track + '. Choose ' + ids.join(', '));
  const reports = [];
  for (const id of values.track ? [values.track] : ids) {
    const rendered = await page.evaluate(
      async ({ id, seconds, offset }) => {
        const { musicTracks } = await import('/src/content/audio/music.ts');
        const { Synth, roomImpulse } = await import('/src/audio/synth.ts');
        const track = musicTracks[id];
        const beatSeconds = 60 / track.bpm;
        const loopSeconds = track.bars * track.beatsPerBar * beatSeconds;
        const duration = seconds ?? loopSeconds + 2;
        const sampleRate = 32000;
        const context = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);
        const input = context.createGain();
        const master = context.createGain();
        master.gain.value = 0.7;
        const compressor = context.createDynamicsCompressor();
        compressor.threshold.value = -10;
        compressor.knee.value = 8;
        compressor.ratio.value = 6;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.2;
        input.connect(master).connect(compressor).connect(context.destination);
        const reverb = context.createConvolver();
        reverb.buffer = roomImpulse(context);
        const wet = context.createGain();
        wet.gain.value = 0.16;
        input.connect(reverb).connect(wet).connect(master);
        // Offline scheduling queues the entire score before rendering, rather than 200ms at a time.
        const synth = new Synth(context, Infinity);
        for (const note of track.notes) {
          const start = note.beat * beatSeconds - offset;
          if (start >= 0 && start < duration) synth.note(note, start, beatSeconds, input);
        }
        const audio = await context.startRendering();
        const left = audio.getChannelData(0),
          right = audio.getChannelData(1);
        const bytes = new ArrayBuffer(44 + audio.length * 4),
          view = new DataView(bytes);
        const ascii = (at, text) =>
          [...text].forEach((c, index) => view.setUint8(at + index, c.charCodeAt(0)));
        ascii(0, 'RIFF');
        view.setUint32(4, bytes.byteLength - 8, true);
        ascii(8, 'WAVE');
        ascii(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 2, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 4, true);
        view.setUint16(32, 4, true);
        view.setUint16(34, 16, true);
        ascii(36, 'data');
        view.setUint32(40, audio.length * 4, true);
        let peak = 0,
          squareSum = 0;
        for (let i = 0; i < audio.length; i++)
          for (let channel = 0; channel < 2; channel++) {
            const value = (channel ? right : left)[i];
            peak = Math.max(peak, Math.abs(value));
            squareSum += value * value;
            view.setInt16(
              44 + i * 4 + channel * 2,
              Math.round(Math.max(-1, Math.min(1, value)) * 32767),
              true,
            );
          }
        let binary = '';
        const array = new Uint8Array(bytes);
        for (let i = 0; i < array.length; i += 32768)
          binary += String.fromCharCode(...array.subarray(i, i + 32768));
        return {
          wav: btoa(binary),
          report: {
            id,
            title: track.title,
            bpm: track.bpm,
            bars: track.bars,
            loopSeconds,
            renderedSeconds: duration,
            peak,
            rms: Math.sqrt(squareSum / (audio.length * 2)),
          },
        };
      },
      { id, seconds, offset },
    );
    if (
      !Number.isFinite(rendered.report.peak) ||
      rendered.report.peak >= 0.99 ||
      rendered.report.rms < 0.001
    )
      throw new Error(`Audio quality check failed: ${JSON.stringify(rendered.report)}`);
    await writeFile(resolve(output, id + '.wav'), Buffer.from(rendered.wav, 'base64'));
    reports.push(rendered.report);
    console.log(
      `${rendered.report.title}: ${rendered.report.renderedSeconds.toFixed(1)}s, peak ${rendered.report.peak.toFixed(3)}, RMS ${rendered.report.rms.toFixed(3)}`,
    );
  }
  await writeFile(resolve(output, 'render-report.json'), JSON.stringify(reports, null, 2) + '\n');
  console.log('Audio written to ' + output);
} finally {
  await browser?.close();
  await server.close();
}
