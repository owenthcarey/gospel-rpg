import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Matrix } from '@babylonjs/core/Maths/math.vector';
import { AssetLibrary } from '../../src/scene/assets';
import { Actor } from '../../src/scene/actors/actor';
import { EverydayActivity } from '../../src/scene/actors/everyday';
import { NeighborhoodActivity } from '../../src/scene/actors/neighborhood';
import { RoadActivity } from '../../src/scene/actors/road';
import { ContactShadows } from '../../src/scene/environment/contact';
import { newGame } from '../../src/game/types';
import { WalkGrid } from '../../src/game/pathfinding';

vi.mock('@babylonjs/core/Loading/sceneLoader', async (original) => {
  const actual = await original<typeof import('@babylonjs/core/Loading/sceneLoader')>();
  return {
    ...actual,
    LoadAssetContainerAsync: (
      source: string,
      scene: Scene,
      options?: import('@babylonjs/core/Loading/sceneLoader').LoadAssetContainerOptions,
    ) =>
      actual.LoadAssetContainerAsync(
        new Uint8Array(readFileSync('public/assets/models/' + source.split('/').at(-1))),
        scene,
        { ...options, pluginExtension: '.glb' },
      ),
  };
});

let engine: NullEngine;
afterEach(() => engine?.dispose());

function studio() {
  engine = new NullEngine();
  engine.getCaps().maxVertexUniformVectors = 1024;
  const scene = new Scene(engine);
  const contact = new ContactShadows(scene, (x) => x * 0.1);
  return { scene, contact, library: new AssetLibrary(scene, undefined, contact) };
}

it('gives each exploration actor one ground shadow and keeps held props out of the batch', async () => {
  const { scene, contact, library } = studio();
  await library.load(['traveler', 'villager', 'jug', 'boat'], () => {});
  const parent = new TransformNode('traveler-navigation', scene);
  parent.position.set(10, 1, 4);
  parent.rotation.y = Math.PI / 2;
  const actor = new Actor(library.instantiate('traveler', 'contact-traveler'));
  actor.root.parent = parent;
  actor.root.position.set(0, 0, 1);
  const jug = library.instantiate('jug', 'held-water');
  actor.attach(jug);
  actor.sample('Carry', 0, true);
  library.instantiate('boat', 'moored-hull');
  const seated = new Actor(library.instantiate('villager', 'seated-company'));
  seated.root.position.set(4, 0.54, -3);
  seated.sample('Sit', 0, true);
  const uploads = vi.spyOn(engine, 'updateDynamicVertexBuffer');
  // Read the submitted matrix stream. Babylon's debug world-matrix list is cached
  // separately and intentionally does not track direct streaming-buffer updates.
  const centres = () => {
    const data = uploads.mock.calls.at(-1)![1] as Float32Array;
    return Array.from({ length: contact.mesh.thinInstanceCount }, (_, i) =>
      Matrix.FromArray(data, i * 16).getTranslation(),
    );
  };
  contact.add(actor.root);
  contact.update();
  // Both skins export many joints and meshes; each actor still owns only one instance.
  expect(contact.mesh.thinInstanceCount).toBe(2);
  expect(centres()[0]!.x).toBeCloseTo(11);
  expect(centres()[0]!.z).toBeCloseTo(4);
  expect(centres()[0]!.y).toBeCloseTo(1.135);
  expect(centres()[1]!.y).toBeCloseTo(0.435);
  contact.setStrength(0.55);
  contact.update();
  expect(contact.mesh.thinInstanceCount).toBe(2);
  contact.setStrength(1);
  contact.update();
  expect(contact.mesh.thinInstanceCount).toBe(2);

  parent.setEnabled(false);
  contact.update();
  expect(contact.mesh.thinInstanceCount).toBe(1);
  parent.setEnabled(true);
  actor.root.position.x = 2;
  contact.update();
  const moved = centres()[0]!;
  expect(moved.x).toBeCloseTo(11);
  expect(moved.z).toBeCloseTo(2);
  actor.dispose();
  contact.update();
  expect(contact.mesh.thinInstanceCount).toBe(1);
  seated.dispose();
  contact.update();
  expect(contact.mesh.thinInstanceCount).toBe(0);
  expect(contact.mesh.isVisible).toBe(false);
  library.dispose();
  contact.dispose();
});

it('registers ambient and companion actors through their existing shared exploration library', async () => {
  const { contact, library } = studio();
  await library.load(['amos', 'villager', 'bread_basket', 'jug', 'gate', 'handcart'], () => {});
  const state = newGame();
  state.region = 'capernaum-lanes';
  const everyday = new EverydayActivity(library, new Map(), state);
  const neighborhood = new NeighborhoodActivity(
    library,
    new Map(),
    () => new WalkGrid(),
    () => {},
    state.region,
  );
  neighborhood.update(state);
  const road = new RoadActivity(
    library,
    'roadside-farm',
    () => new WalkGrid(),
    () => {},
  );
  road.update(state);
  contact.update();
  // Water tender, three lane neighbors and Neri; inactive table company stays absent.
  expect(contact.mesh.thinInstanceCount).toBe(5);
  everyday.dispose();
  road.conversationActor.dispose();
  contact.update();
  expect(contact.mesh.thinInstanceCount).toBe(3);
  library.dispose();
  contact.dispose();
});

it('keeps water rowers and cinematic libraries free of automatic land shadows', async () => {
  const { scene, contact } = studio();
  const library = new AssetLibrary(scene);
  await library.load(['traveler'], () => {});
  const rower = new Actor(library.instantiate('traveler', 'water-rower'));
  rower.root.position.y = 0.19;
  rower.sampleAt('Row', 0.3);
  contact.update();
  expect(contact.mesh.thinInstanceCount).toBe(0);
  expect(contact.mesh.isVisible).toBe(false);
  rower.dispose();
  library.dispose();
  contact.dispose();
});
