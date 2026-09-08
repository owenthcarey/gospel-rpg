import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { episodePlaces } from '../../content/region';
import type { ActorAsset } from '../../content/assets';
import type { GameState, Settings } from '../../game/types';
import { findPath, type WalkGrid } from '../../game/pathfinding';
import { villagePresentation } from '../../game/episode/presentation';
import type { AssetLibrary, Model } from '../assets';
import { Actor } from './actor';

export class VillageActivity {
  private actors = new Map<string, Actor>();
  private crowd: Actor[] = [];
  private props = new Map<string, Model>();
  private looseRope: AbstractMesh;
  private lastState = '';
  private gathered = false;
  private highQuality = true;
  private reduced = false;
  private returned = false;
  private gesture = 0;
  private boatOrigins: Vector3[];
  private crowdOrigins: Vector3[] = [];
  constructor(
    library: AssetLibrary,
    scene: Scene,
    private grid: WalkGrid,
    private player: Actor,
    private originalPeople: Map<string, TransformNode>,
    private boats: TransformNode[],
  ) {
    this.boatOrigins = boats.map((boat) => boat.position.clone());
    for (const person of episodePlaces.filter((p) => p.asset)) {
      const actor = new Actor(
        library.instantiate(person.asset as ActorAsset, person.id, person.id),
      );
      actor.root.position.set(person.x, 0, person.z);
      actor.face({ x: 8, z: 2 });
      this.actors.set(person.id, actor);
    }
    const crowdSpots = [
      { x: 1, z: 8 },
      { x: 2, z: 10 },
      { x: 3, z: 7 },
      { x: 4, z: 10 },
      { x: 1, z: 11 },
      { x: 4, z: 6 },
    ];
    for (let i = 0; i < crowdSpots.length; i++) {
      const actor = new Actor(
        library.instantiate(i % 3 === 0 ? 'miriam' : 'villager', 'neighbor-' + i),
      );
      actor.root.position.set(crowdSpots[i]!.x, 0, crowdSpots[i]!.z);
      actor.root.scaling.setAll(0.93 + (i % 3) * 0.035);
      actor.face({ x: 9, z: 7 });
      this.crowdOrigins.push(actor.root.position.clone());
      this.crowd.push(actor);
    }
    const prop = (
      key: string,
      asset: Parameters<AssetLibrary['instantiate']>[0],
      x: number,
      z: number,
      y = 0,
      interaction?: string,
    ) => {
      const model = library.instantiate(asset, key, interaction);
      model.root.position.set(x, y, z);
      this.props.set(key, model);
      return model;
    };
    prop('market-basket', 'basket_empty', -4.5, 0.5, 0, 'supply-basket');
    prop('landing-basket', 'basket_empty', 6.3, -1, 0, 'landing');
    prop('landing-full', 'basket_fish', 6.3, -1, 0, 'landing');
    prop('carried', 'basket_empty', 0, 0);
    this.player.attach(this.props.get('carried')!);
    prop('delivered-bread', 'bread_bundle', 6.2, 0.2, 0.74);
    prop('delivered-net', 'net_folded', 7.2, 0.5, 0.59);
    prop('rack-net', 'net_folded', 4, -6.5, 0.15, 'nets');
    prop('rope-coil', 'mooring', 7, 3, 0, 'mooring');
    prop('place-mat', 'landing_mat', 3, 9, 0.02, 'gathering');
    for (let i = 0; i < 4; i++) {
      prop('catch-' + i, 'basket_fish', 9.8 + (i % 2) * 0.65, 1 + Math.floor(i / 2) * 0.6, 0.14);
    }
    const ropeMaterial = new StandardMaterial('loose-rope-material', scene);
    ropeMaterial.diffuseColor = Color3.FromHexString('#ad9164');
    ropeMaterial.specularColor = Color3.Black();
    this.looseRope = MeshBuilder.CreateTube(
      'loose-rope',
      {
        path: [
          new Vector3(7, 0.06, 3),
          new Vector3(6.1, 0.06, 2.5),
          new Vector3(5.4, 0.06, 3.2),
          new Vector3(5, 0.06, 2.7),
        ],
        radius: 0.025,
        tessellation: 5,
      },
      scene,
    );
    this.looseRope.material = ropeMaterial;
    this.looseRope.metadata = { interactionId: 'mooring' };
  }
  update(state: GameState): void {
    const p = villagePresentation(state);
    const key = JSON.stringify(p);
    if (key === this.lastState) return;
    this.lastState = key;
    const enabled = (id: string, value: boolean) => this.props.get(id)!.root.setEnabled(value);
    enabled('market-basket', p.episodeStarted && !p.basketPlaced && !p.carrying);
    enabled('landing-basket', p.basketPlaced && !p.returned);
    enabled('landing-full', p.returned && p.basketReceived);
    enabled('carried', p.carrying);
    enabled('delivered-bread', p.delivered);
    enabled('delivered-net', p.delivered);
    enabled('rack-net', !p.tookNet);
    enabled('rope-coil', p.episodeStarted);
    enabled('place-mat', p.gathering);
    this.looseRope.setEnabled(p.episodeStarted && !p.ropeCoiled);
    for (let i = 0; i < 4; i++) enabled('catch-' + i, p.returned);
    for (const id of ['simon', 'jesus']) this.originalPeople.get(id)?.setEnabled(!p.returned);
    for (const actor of this.actors.values())
      actor.root.setEnabled(p.episodeStarted && !p.returned);
    this.returned = p.returned;
    if (p.gathering && !this.gathered) {
      // Short authored routes use the same collision grid as the traveler.
      this.crowd.forEach((actor, i) => {
        const to = this.crowdOrigins[i]!;
        const from = this.grid.nearest({ x: -3 + (i % 2), z: i - 1 }) ?? to;
        actor.root.position.set(from.x, 0, from.z);
        actor.walk(findPath(this.grid, from, to));
      });
    }
    this.gathered = p.gathering;
    this.crowd.forEach((actor, i) =>
      actor.root.setEnabled(p.gathering && !p.returned && (this.highQuality || i < 3)),
    );
    // Both boats remain visible after the fishermen leave.
    this.boats.forEach((boat, i) => {
      if (p.returned) {
        boat.position.x = 10.5 + i * 1.4;
        boat.position.z = 1.3 + i * 3.2;
      } else {
        boat.position.x = this.boatOrigins[i]!.x;
        boat.position.z = this.boatOrigins[i]!.z;
      }
    });
  }
  perform(): void {
    this.gesture = 1.6;
  }
  playerClip(moving: boolean, carrying: boolean): 'Idle' | 'Walk' | 'Carry' | 'Haul' {
    if (this.gesture > 0) return 'Haul';
    if (carrying) return 'Carry';
    return moving ? 'Walk' : 'Idle';
  }
  tick(dt: number, paused: boolean): void {
    if (paused) return;
    this.gesture = Math.max(0, this.gesture - dt);
    for (const actor of [...this.actors.values(), ...this.crowd]) {
      if (actor.root.isEnabled()) actor.tick(dt, this.reduced);
    }
  }
  settings(settings: Settings): void {
    this.highQuality = settings.quality === 'high';
    this.reduced = settings.reducedMotion;
    this.crowd.forEach((actor, i) =>
      actor.root.setEnabled(this.gathered && !this.returned && (this.highQuality || i < 3)),
    );
  }
  dispose(): void {
    // The region scene owns mesh disposal; these release animation groups explicitly.
    for (const actor of [...this.actors.values(), ...this.crowd]) actor.dispose();
  }
}
