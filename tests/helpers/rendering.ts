import type { Page } from '@playwright/test';

/** Warm active play after a quality change, then sample a bounded observation window. */
export async function renderingCadence(page: Page) {
  return page.evaluate(async () => {
    const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
    const gl = canvas.getContext('webgl2')!;
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : 'Unavailable';
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const values: number[] = [];
    let previous = 0;
    const started = performance.now();
    await new Promise<void>((resolve) => {
      let frame = 0;
      const finish = () => {
        cancelAnimationFrame(frame);
        clearTimeout(deadline);
        resolve();
      };
      const deadline = setTimeout(finish, 5000);
      const sample = (now: number) => {
        if (previous) values.push(now - previous);
        previous = now;
        if (values.length >= 120) finish();
        else frame = requestAnimationFrame(sample);
      };
      frame = requestAnimationFrame(sample);
    });
    if (values.length < 2) throw new Error('The renderer did not produce enough frames.');
    values.sort((a, b) => a - b);
    return {
      renderer,
      samples: String(values.length),
      elapsedMs: (performance.now() - started).toFixed(1),
      median: values[Math.floor(values.length * 0.5)]!.toFixed(1),
      p95: values[Math.floor(values.length * 0.95)]!.toFixed(1),
      viewport: innerWidth + '×' + innerHeight,
    };
  });
}
