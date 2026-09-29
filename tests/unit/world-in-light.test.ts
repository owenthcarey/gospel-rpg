import { describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { ShotDirector } from '../../src/scene/presentation/shots';
import {
  blendProfiles,
  environmentProfiles,
  stormProfile,
  environmentFor,
} from '../../src/content/environment';
import { coverPlacements } from '../../src/scene/environment/cover';
import { GROUND_COVER } from '../../src/content/assets';
import { regions } from '../../src/content/regions';
import { placeLines, openingCards, accountCards } from '../../src/content/opening';

function studio() {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const camera = new ArcRotateCamera('shot-test', 0, 1, 10, Vector3.Zero(), scene);
  return { engine, scene, camera };
}
const pose = (alpha: number, radius: number, x = 0) => ({
  alpha,
  beta: 0.9,
  radius,
  target: new Vector3(x, 1, 0),
});

describe('RFC-011 shot director', () => {
  it('establishes the first and restored compositions immediately', () => {
    const { engine, camera } = studio();
    const shots = new ShotDirector(camera);
    shots.shot('approach', pose(-1, 20));
    expect(camera.alpha).toBe(-1);
    expect(camera.radius).toBe(20);
    expect(shots.moving).toBe(false);
    engine.dispose();
  });
  it('eases to a new checkpoint, and retargets from the current pose when Continue interrupts', () => {
    const { engine, camera } = studio();
    const shots = new ShotDirector(camera);
    shots.shot('a', pose(0, 20), { instant: true });
    shots.shot('b', pose(1, 10), { duration: 2 });
    expect(shots.moving).toBe(true);
    shots.tick(1, { running: true, reduced: false, drift: 0 });
    const mid = camera.alpha;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    // A third checkpoint starts from the camera's actual mid-move pose, not from 'a' or 'b'.
    shots.shot('c', pose(-0.5, 12), { duration: 2 });
    shots.tick(0, { running: true, reduced: false, drift: 0 });
    expect(camera.alpha).toBeCloseTo(mid, 5);
    shots.tick(5, { running: true, reduced: false, drift: 0 });
    expect(camera.alpha).toBeCloseTo(-0.5, 5);
    expect(camera.radius).toBeCloseTo(12, 5);
    engine.dispose();
  });
  it('holds while paused, is immediate under reduced motion and bounds every move', () => {
    const { engine, camera } = studio();
    const shots = new ShotDirector(camera);
    shots.shot('a', pose(0, 20), { instant: true });
    shots.shot('b', pose(1, 10), { duration: 60 });
    shots.tick(10, { running: false, reduced: false, drift: 0 });
    expect(camera.alpha).toBe(0);
    shots.tick(3.3, { running: true, reduced: false, drift: 0 });
    expect(camera.alpha).toBeCloseTo(1, 5);
    shots.shot('c', pose(2, 8));
    shots.tick(0, { running: true, reduced: true });
    expect(camera.alpha).toBe(2);
    expect(camera.radius).toBe(8);
    engine.dispose();
  });
  it('updates the same shot in place when the reading panel resizes', () => {
    const { engine, camera } = studio();
    const shots = new ShotDirector(camera);
    shots.shot('a', pose(0, 20), { instant: true });
    shots.shot('a', pose(0, 24, 2));
    expect(camera.radius).toBe(24);
    expect(camera.target.x).toBe(2);
    engine.dispose();
  });
});

describe('RFC-011 environment profiles', () => {
  it('defines a complete look for every region and the title', () => {
    for (const id of [...Object.keys(regions), 'title'] as const) {
      const p = environmentFor(id as keyof typeof environmentProfiles);
      expect(p, id).toBeDefined();
      expect(p.label.length, id).toBeGreaterThan(3);
      expect(p.fog.density).toBeGreaterThanOrEqual(0);
      expect(p.shadow.darkness).toBeGreaterThan(0);
      expect(p.shadow.darkness).toBeLessThanOrEqual(1);
      expect(p.interior || p.horizon !== null, id).toBe(true);
    }
  });
  it('blends continuously toward the storm and returns exact endpoints', () => {
    const calm = environmentProfiles['storm-account'];
    expect(blendProfiles(calm, stormProfile, 0)).toBe(calm);
    expect(blendProfiles(calm, stormProfile, 1)).toBe(stormProfile);
    expect(blendProfiles(calm, stormProfile, Number.NaN)).toBe(calm);
    const mid = blendProfiles(calm, stormProfile, 0.5);
    expect(mid.wind).toBeCloseTo((calm.wind + stormProfile.wind) / 2);
    expect(mid.fog.color).toMatch(/^#[0-9a-f]{6}$/);
    expect(mid.particles).toEqual(stormProfile.particles);
    expect(blendProfiles(calm, stormProfile, 0.4).particles).toEqual(calm.particles);
  });
});

describe('RFC-011 ground cover', () => {
  const options = {
    radius: 12,
    height: () => 0,
    allowed: (p: { x: number; z: number }) => p.x > -8,
    pathDistance: (p: { x: number; z: number }) => Math.abs(p.z) - 1.5,
  };
  it('is deterministic, stays off paths and blocked ground, and respects quality caps', () => {
    const high = coverPlacements(options, 'high');
    const arrays = (placements: typeof high) =>
      GROUND_COVER.map((id) => placements[id].map((m) => Array.from(m.asArray())));
    expect(arrays(coverPlacements(options, 'high'))).toEqual(arrays(high));
    let total = 0;
    for (const id of GROUND_COVER)
      for (const m of high[id]) {
        const at = m.getTranslation();
        expect(at.x).toBeGreaterThan(-8);
        // Never on the path; at least 0.9 m past its edge.
        expect(Math.abs(at.z) - 1.5).toBeGreaterThanOrEqual(0.9);
        total++;
      }
    expect(total).toBeGreaterThan(20);
    const low = coverPlacements(options, 'low');
    const lowTotal = GROUND_COVER.reduce((n, id) => n + low[id].length, 0);
    expect(lowTotal).toBeLessThan(total);
    expect(lowTotal).toBeLessThanOrEqual(800);
  });
});

describe('RFC-011 opening content', () => {
  it('describes every place and keeps the cold open as original narration', () => {
    for (const id of Object.keys(regions))
      expect(placeLines[id as keyof typeof placeLines]).toBeTruthy();
    expect(openingCards.length).toBeGreaterThanOrEqual(3);
    for (const card of openingCards) expect(card.text).not.toMatch(/[“"]/);
    for (const card of Object.values(accountCards)) expect(card!.reference).toMatch(/\d+:\d+–\d+/);
  });
});
