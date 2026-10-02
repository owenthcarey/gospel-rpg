import type { Page } from '@playwright/test';

/** Read the world buffer during a rendered frame, rather than trusting submission counters. */
export async function worldPixels(page: Page) {
  return page.locator('#game-canvas').evaluate(async (node) => {
    const gl = (node as HTMLCanvasElement).getContext('webgl2')!;
    return new Promise<{
      width: number;
      height: number;
      colors: number;
      opaque: number;
      colored: number;
      error: number;
      lost: boolean;
      hash: string;
    }>((resolve) =>
      requestAnimationFrame(() => {
        if (gl.isContextLost()) {
          resolve({
            width: (node as HTMLCanvasElement).width,
            height: (node as HTMLCanvasElement).height,
            colors: 0,
            opaque: 0,
            colored: 0,
            error: gl.CONTEXT_LOST_WEBGL,
            lost: true,
            hash: 'lost',
          });
          return;
        }
        const width = gl.drawingBufferWidth;
        const height = gl.drawingBufferHeight;
        const pixels = new Uint8Array(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        const colors = new Set<number>();
        let opaque = 0;
        let colored = 0;
        let hash = 2166136261;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i + 3]! > 0) opaque++;
          if (pixels[i] !== pixels[i + 1] || pixels[i + 1] !== pixels[i + 2]) colored++;
          colors.add(
            ((pixels[i]! >> 4) << 8) | ((pixels[i + 1]! >> 4) << 4) | (pixels[i + 2]! >> 4),
          );
          for (let channel = 0; channel < 4; channel++)
            hash = Math.imul(hash ^ pixels[i + channel]!, 16777619);
        }
        resolve({
          width,
          height,
          colors: colors.size,
          opaque: opaque / (width * height),
          colored: colored / (width * height),
          error: gl.getError(),
          lost: false,
          hash: (hash >>> 0).toString(16),
        });
      }),
    );
  });
}

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
