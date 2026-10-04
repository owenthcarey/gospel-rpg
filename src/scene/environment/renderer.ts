import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';

/** Missing renderer information keeps the existing hardware rendering policy. */
export function isSoftwareEngine(engine: AbstractEngine): boolean {
  const graphics = engine as AbstractEngine & {
    getGlInfo?: () => { renderer: string };
  };
  return /swiftshader|llvmpipe|software/i.test(graphics.getGlInfo?.().renderer ?? '');
}
