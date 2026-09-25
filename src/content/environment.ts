import type { RegionId } from '../game/episode/types';

export type AmbientParticles = 'motes' | 'pollen' | 'insects' | 'spray' | 'rain' | 'glints';
export type Flock = 'gulls' | 'sparrows';

/** Declarative look of one stage. Presentation only; never saved and never read by reducers. */
export interface EnvironmentProfile {
  /** HUD line describing the hour and weather. */
  label: string;
  sky: { zenith: string; horizon: string; glow: string };
  /** Azimuth/elevation in radians. Azimuth 0 points the light toward +Z. */
  sun: { azimuth: number; elevation: number; color: string; intensity: number; disc: number };
  fill: { sky: string; ground: string; intensity: number };
  fog: { color: string; density: number };
  grade: {
    exposure: number;
    contrast: number;
    saturation: number;
    /** Positive warms highlights and cools shadows; negative the reverse. */
    warmth: number;
    vignette: number;
  };
  bloom: number;
  /** Strength of the sun shadow (0 none, 1 full) and half-width of its sharp volume. */
  shadow: { darkness: number; extent: number };
  wind: number;
  clouds: number;
  /** Colors from nearest to farthest horizon ring; null for enclosed rooms. */
  horizon: readonly [string, string, string] | null;
  interior: boolean;
  particles: readonly AmbientParticles[];
  flock: Flock | null;
}

const morning: EnvironmentProfile = {
  label: 'A clear morning',
  sky: { zenith: '#6f9fc0', horizon: '#dfe6d8', glow: '#f7dfae' },
  sun: { azimuth: 2.35, elevation: 0.72, color: '#ffe7bf', intensity: 1.05, disc: 1 },
  fill: { sky: '#cfe0ee', ground: '#7a6a4c', intensity: 0.52 },
  fog: { color: '#cfdcd4', density: 0.0085 },
  grade: { exposure: 1.02, contrast: 1.08, saturation: 1.02, warmth: 0.2, vignette: 0.32 },
  bloom: 0.22,
  shadow: { darkness: 0.82, extent: 26 },
  wind: 0.45,
  clouds: 0.35,
  horizon: ['#8d9f78', '#9fae93', '#b8c3b6'],
  interior: false,
  particles: ['pollen', 'glints'],
  flock: 'gulls',
};

export const environmentProfiles: Record<RegionId | 'title', EnvironmentProfile> = {
  title: {
    ...morning,
    label: 'Dawn over the lake',
    sky: { zenith: '#51789a', horizon: '#f0cfa2', glow: '#ffc98a' },
    sun: { azimuth: 1.6, elevation: 0.12, color: '#ffc58c', intensity: 1.05, disc: 1.6 },
    fill: { sky: '#b9c9dc', ground: '#6d5a44', intensity: 0.55 },
    fog: { color: '#e4d2b9', density: 0.006 },
    grade: { exposure: 1.04, contrast: 1.1, saturation: 1.02, warmth: 0.36, vignette: 0.42 },
    bloom: 0.4,
    clouds: 0.5,
    horizon: ['#6f7568', '#8e8d80', '#b7a996'],
    particles: ['glints'],
  },
  capernaum: morning,
  'lake-gennesaret': {
    ...morning,
    label: 'Morning on the lake',
    fog: { color: '#cfdcd6', density: 0.007 },
    particles: ['glints'],
  },
  'capernaum-lanes': {
    ...morning,
    label: 'Late morning in the lanes',
    sun: { ...morning.sun, azimuth: 2.7, elevation: 0.95, intensity: 1.08 },
    grade: { ...morning.grade, warmth: 0.24 },
    particles: ['pollen'],
    flock: 'sparrows',
  },
  'gathering-house': {
    ...morning,
    label: 'Inside the gathering house',
    sun: { azimuth: 2.6, elevation: 0.9, color: '#ffe2b0', intensity: 0.85, disc: 0 },
    fill: { sky: '#f0dfc2', ground: '#8a6a45', intensity: 0.72 },
    fog: { color: '#2d261e', density: 0 },
    grade: { exposure: 1.04, contrast: 1.07, saturation: 1.04, warmth: 0.32, vignette: 0.45 },
    bloom: 0.16,
    shadow: { darkness: 0.72, extent: 10 },
    wind: 0,
    clouds: 0,
    horizon: null,
    interior: true,
    particles: ['motes'],
    flock: null,
  },
  bakehouse: {
    ...morning,
    label: 'The warmth of the bakehouse',
    sun: { azimuth: 2.9, elevation: 0.85, color: '#ffd9a0', intensity: 0.82, disc: 0 },
    fill: { sky: '#f3d9b6', ground: '#8d6641', intensity: 0.75 },
    fog: { color: '#2d261e', density: 0 },
    grade: { exposure: 1.05, contrast: 1.07, saturation: 1.02, warmth: 0.4, vignette: 0.45 },
    bloom: 0.2,
    shadow: { darkness: 0.72, extent: 10 },
    wind: 0,
    clouds: 0,
    horizon: null,
    interior: true,
    particles: ['motes'],
    flock: null,
  },
  'roof-account': {
    ...morning,
    label: 'A crowded house',
    sun: { azimuth: 2.5, elevation: 1.05, color: '#ffe3b4', intensity: 0.95, disc: 0 },
    fill: { sky: '#eedfc6', ground: '#86674a', intensity: 0.68 },
    fog: { color: '#cfc3a8', density: 0.004 },
    grade: { exposure: 1.03, contrast: 1.08, saturation: 1.04, warmth: 0.32, vignette: 0.42 },
    shadow: { darkness: 0.74, extent: 14 },
    wind: 0.15,
    horizon: ['#a39b7b', '#b3ae94', '#c9c4b2'],
    particles: ['motes'],
    flock: 'sparrows',
  },
  'galilean-road': {
    ...morning,
    label: 'Afternoon on the road',
    sky: { zenith: '#7aa5c4', horizon: '#ece2c8', glow: '#fbd9a2' },
    sun: { azimuth: -2.3, elevation: 0.62, color: '#ffe0b0', intensity: 1.1, disc: 1 },
    fill: { sky: '#d6e2ea', ground: '#86704a', intensity: 0.5 },
    fog: { color: '#dcdcc6', density: 0.007 },
    grade: { exposure: 1.02, contrast: 1.09, saturation: 1.02, warmth: 0.28, vignette: 0.32 },
    wind: 0.55,
    horizon: ['#9aa27a', '#aeb38f', '#c7c6ae'],
    particles: ['pollen', 'insects'],
    flock: 'sparrows',
  },
  'roadside-farm': {
    ...morning,
    label: 'Afternoon in the olive shade',
    sky: { zenith: '#7aa5c4', horizon: '#ece2c8', glow: '#fbd9a2' },
    sun: { azimuth: -2.2, elevation: 0.6, color: '#ffe0b0', intensity: 1.08, disc: 1 },
    fill: { sky: '#d6e2ea', ground: '#86704a', intensity: 0.52 },
    fog: { color: '#dcdcc6', density: 0.007 },
    grade: { exposure: 1.02, contrast: 1.08, saturation: 1.02, warmth: 0.28, vignette: 0.32 },
    wind: 0.5,
    horizon: ['#95a077', '#aab28d', '#c5c5ac'],
    particles: ['pollen', 'insects'],
    flock: 'sparrows',
  },
  'nain-gate': {
    ...morning,
    label: 'A warm afternoon at the gate',
    sky: { zenith: '#80a6c0', horizon: '#f0dfbf', glow: '#fccf92' },
    sun: { azimuth: -2, elevation: 0.5, color: '#ffd8a2', intensity: 1.1, disc: 1.1 },
    fill: { sky: '#dde2e2', ground: '#8a6f47', intensity: 0.5 },
    fog: { color: '#e2d8bf', density: 0.007 },
    grade: { exposure: 1.02, contrast: 1.1, saturation: 1.02, warmth: 0.36, vignette: 0.34 },
    wind: 0.4,
    horizon: ['#a39b75', '#b6ac8a', '#cdc2a8'],
    particles: ['insects'],
    flock: 'sparrows',
  },
  'nain-account': {
    ...morning,
    label: 'At the gate of Nain',
    sky: { zenith: '#80a6c0', horizon: '#f0dfbf', glow: '#fccf92' },
    sun: { azimuth: -2, elevation: 0.5, color: '#ffd8a2', intensity: 1.1, disc: 1.1 },
    fill: { sky: '#dde2e2', ground: '#8a6f47', intensity: 0.5 },
    fog: { color: '#e2d8bf', density: 0.007 },
    grade: { exposure: 1.02, contrast: 1.1, saturation: 1.04, warmth: 0.36, vignette: 0.38 },
    wind: 0.3,
    horizon: ['#a39b75', '#b6ac8a', '#cdc2a8'],
    particles: [],
    flock: null,
  },
  'galilee-water': {
    ...morning,
    label: 'A light wind on open water',
    sky: { zenith: '#6c9fc4', horizon: '#e6ecdf', glow: '#f7e2b8' },
    sun: { azimuth: 2.2, elevation: 0.8, color: '#fff0cf', intensity: 1.08, disc: 1 },
    fog: { color: '#d7e2dc', density: 0.0065 },
    grade: { exposure: 1.03, contrast: 1.07, saturation: 1.02, warmth: 0.16, vignette: 0.3 },
    wind: 0.6,
    particles: ['glints'],
  },
  'reed-landing': {
    ...morning,
    label: 'A bright haze over the reeds',
    fog: { color: '#d7e2dc', density: 0.008 },
    wind: 0.6,
    particles: ['insects', 'glints'],
    flock: 'gulls',
  },
  'sheltered-cove': {
    ...morning,
    label: 'Evening light in the cove',
    sky: { zenith: '#5f86ab', horizon: '#ecd3b0', glow: '#ffc58e' },
    sun: { azimuth: -1.9, elevation: 0.34, color: '#ffc995', intensity: 1.02, disc: 1.3 },
    fill: { sky: '#bccbdc', ground: '#6d5a44', intensity: 0.55 },
    fog: { color: '#e0d2bf', density: 0.0075 },
    grade: { exposure: 1.03, contrast: 1.1, saturation: 1.02, warmth: 0.4, vignette: 0.36 },
    bloom: 0.3,
    wind: 0.35,
    particles: ['glints'],
  },
  'storm-account': {
    ...morning,
    label: 'Evening on the lake',
    sky: { zenith: '#5a7d9e', horizon: '#e0cfb3', glow: '#f5bf8c' },
    sun: { azimuth: -1.9, elevation: 0.3, color: '#ffcf9f', intensity: 0.98, disc: 1.2 },
    fill: { sky: '#bccbdc', ground: '#5f5244', intensity: 0.55 },
    fog: { color: '#d8cdbd', density: 0.008 },
    grade: { exposure: 1.02, contrast: 1.09, saturation: 1.02, warmth: 0.32, vignette: 0.4 },
    bloom: 0.28,
    wind: 0.4,
    clouds: 0.45,
    particles: ['glints'],
    flock: null,
  },
};

/** The storm variant that `storm-account` blends toward while the wind rises. */
export const stormProfile: EnvironmentProfile = {
  ...environmentProfiles['storm-account'],
  label: 'A great storm of wind',
  sky: { zenith: '#27323d', horizon: '#56626a', glow: '#6d7478' },
  sun: { azimuth: -1.9, elevation: 0.5, color: '#aebccb', intensity: 0.55, disc: 0 },
  fill: { sky: '#8595a5', ground: '#2c3032', intensity: 0.62 },
  fog: { color: '#46525a', density: 0.02 },
  grade: { exposure: 0.98, contrast: 1.12, saturation: 0.82, warmth: -0.24, vignette: 0.55 },
  bloom: 0.12,
  shadow: { darkness: 0.35, extent: 20 },
  wind: 1,
  clouds: 1,
  horizon: ['#39444a', '#46525a', '#566268'],
  particles: ['rain', 'spray'],
};

export function environmentFor(region: RegionId | 'title'): EnvironmentProfile {
  return environmentProfiles[region];
}

function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16),
    pb = parseInt(b.slice(1), 16);
  const channel = (shift: number) => {
    const x = (pa >> shift) & 255,
      y = (pb >> shift) & 255;
    return Math.round(x + (y - x) * t);
  };
  return '#' + [16, 8, 0].map((s) => channel(s).toString(16).padStart(2, '0')).join('');
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Continuous blend for checkpoint variants. Lists and labels switch at the midpoint. */
export function blendProfiles(
  a: EnvironmentProfile,
  b: EnvironmentProfile,
  amount: number,
): EnvironmentProfile {
  const t = Math.max(0, Math.min(1, Number.isFinite(amount) ? amount : 0));
  if (t === 0) return a;
  if (t === 1) return b;
  const late = t >= 0.5 ? b : a;
  return {
    label: late.label,
    sky: {
      zenith: mixHex(a.sky.zenith, b.sky.zenith, t),
      horizon: mixHex(a.sky.horizon, b.sky.horizon, t),
      glow: mixHex(a.sky.glow, b.sky.glow, t),
    },
    sun: {
      azimuth: mix(a.sun.azimuth, b.sun.azimuth, t),
      elevation: mix(a.sun.elevation, b.sun.elevation, t),
      color: mixHex(a.sun.color, b.sun.color, t),
      intensity: mix(a.sun.intensity, b.sun.intensity, t),
      disc: mix(a.sun.disc, b.sun.disc, t),
    },
    fill: {
      sky: mixHex(a.fill.sky, b.fill.sky, t),
      ground: mixHex(a.fill.ground, b.fill.ground, t),
      intensity: mix(a.fill.intensity, b.fill.intensity, t),
    },
    fog: {
      color: mixHex(a.fog.color, b.fog.color, t),
      density: mix(a.fog.density, b.fog.density, t),
    },
    grade: {
      exposure: mix(a.grade.exposure, b.grade.exposure, t),
      contrast: mix(a.grade.contrast, b.grade.contrast, t),
      saturation: mix(a.grade.saturation, b.grade.saturation, t),
      warmth: mix(a.grade.warmth, b.grade.warmth, t),
      vignette: mix(a.grade.vignette, b.grade.vignette, t),
    },
    bloom: mix(a.bloom, b.bloom, t),
    shadow: {
      darkness: mix(a.shadow.darkness, b.shadow.darkness, t),
      extent: mix(a.shadow.extent, b.shadow.extent, t),
    },
    wind: mix(a.wind, b.wind, t),
    clouds: mix(a.clouds, b.clouds, t),
    horizon:
      a.horizon && b.horizon
        ? [
            mixHex(a.horizon[0], b.horizon[0], t),
            mixHex(a.horizon[1], b.horizon[1], t),
            mixHex(a.horizon[2], b.horizon[2], t),
          ]
        : late.horizon,
    interior: late.interior,
    particles: late.particles,
    flock: late.flock,
  };
}
