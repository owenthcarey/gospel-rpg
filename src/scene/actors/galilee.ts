import { Color3 } from '@babylonjs/core/Maths/math.color';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Scene } from '@babylonjs/core/scene';
import type { GameState, Settings } from '../../game/types';
import type { ExplorationRegion } from '../../game/campaign/types';
import type { AssetLibrary, Model } from '../assets';
import type { AssetId } from '../../content/assets';
import { groundHeight } from '../../content/campaign/layouts';
import { CHANNEL_IDS, REST_SITES, REST_SUPPLIES } from '../../game/galilee/types';
import { channelPosition, ports, traceWater } from '../../game/galilee/channel';
import { REST_LAYOUTS, supplyPosition } from '../../game/galilee/arrangement';
import { Actor } from './actor';

/** Saved geometry arrangements and decorative company are rebuilt at every checkpoint. */
export class GalileeActivity {
  private models = new Map<string, Model>();
  private water = new Map<string, Mesh>();
  private previews: Mesh[] = [];
  private sockets = new Map<string, Mesh>();
  private company: Actor[] = [];
  private still = false;
  private elapsed = 0;
  private material: StandardMaterial;
  constructor(
    private library: AssetLibrary,
    private scene: Scene,
    private region: ExplorationRegion,
  ) {
    this.material = new StandardMaterial('galilee-water', scene);
    this.material.diffuseColor = Color3.FromHexString('#4a9fa5').toLinearSpace();
    this.material.emissiveColor = Color3.FromHexString('#234f56').toLinearSpace();
    this.material.specularColor = Color3.Black();
    if (region === 'galilean-road') {
      for (const id of CHANNEL_IDS) {
        const p = channelPosition(id);
        this.prop(
          id,
          id === 'entry' ? 'channel_straight' : 'channel_bend',
          p.x,
          p.z,
          'channel-' + id,
        );
        for (let d = 0; d < 4; d++) this.pool(id + '-' + d, p.x, p.z, 0.29, 1.03);
      }
      this.prop('north-basin', 'water_basin', 8, -5, 'spring-basins').root.rotation.y = Math.PI;
      this.prop('south-basin', 'water_basin', 8, -9, 'spring-basins').root.rotation.y = Math.PI;
      this.pool('north-basin', 8, -5, 1.22, 1.22, 0.168);
      this.pool('south-basin', 8, -9, 1.22, 1.22, 0.168);
      this.pool('north-inlet', 7.2, -5, 0.48, 0.29, 0.16);
      this.pool('south-inlet', 7.2, -9, 0.48, 0.29, 0.16);
      this.prop('source', 'spring_marker', 2, -7, 'spring-source');
      this.pool('source-flow', 2.9, -7, 1.25, 0.27, 0.14);
      this.prop('rack', 'supply_rack', 4, -11, 'spring-tools');
      this.prop('scoop', 'channel_scoop', 4, -11, 'spring-tools', 0.69);
      this.prop('inlet-stones', 'rock', 3, -7, 'spring-source').root.scaling.setAll(0.32);
      this.prop('silt', 'rock', 4, -7, 'channel-entry').root.scaling.set(0.4, 0.07, 0.34);
      const actor = new Actor(library.instantiate('villager', 'galilee-water-traveler'));
      actor.pose('Kneel');
      actor.root.setEnabled(false);
      this.company.push(actor);
    }
    if (region === 'roadside-farm') {
      this.prop('rack', 'supply_rack', -3, 0, 'rest-supplies');
      for (const [i, id] of REST_SUPPLIES.entries())
        this.prop(
          'stored-' + id,
          id === 'mat' ? 'resting_mat' : id === 'water' ? 'jug' : 'reed_screen',
          -3 + (i - 1) * 0.45,
          0,
          'rest-supplies',
          0.69,
        ).root.scaling.setAll(id === 'screen' ? 0.45 : 0.4);
      for (const site of REST_SITES) {
        const p = REST_LAYOUTS[site];
        this.prop(site + '-bench', 'bench', p.x, p.z + 0.9, 'rest-' + site).root.scaling.x = 0.72;
        for (const id of REST_SUPPLIES)
          this.prop(
            site + '-' + id,
            id === 'mat' ? 'resting_mat' : id === 'water' ? 'jug' : 'reed_screen',
            p.x,
            p.z,
            'rest-' + site,
          );
        const preview = MeshBuilder.CreateTorus(
          'galilee-' + site + '-placement',
          { diameter: 2.8, thickness: 0.045, tessellation: 32 },
          scene,
        );
        preview.position.set(p.x, groundHeight(region, p) + 0.04, p.z);
        preview.material = this.material;
        preview.isPickable = false;
        this.previews.push(preview);
        for (const id of REST_SUPPLIES) {
          const socket = MeshBuilder.CreateBox(
            'galilee-socket-' + site + '-' + id,
            {
              width: id === 'mat' ? 1.5 : id === 'water' ? 0.42 : 1.6,
              depth: id === 'mat' ? 1.35 : id === 'water' ? 0.42 : 0.15,
              height: 0.025,
            },
            scene,
          );
          socket.material = this.material;
          socket.isPickable = false;
          this.sockets.set(site + '-' + id, socket);
        }
      }
      for (let i = 0; i < 2; i++) {
        const actor = new Actor(library.instantiate('villager', 'galilee-resting-traveler-' + i));
        actor.pose('Sit');
        actor.root.setEnabled(false);
        this.company.push(actor);
      }
    }
  }
  private prop(id: string, asset: AssetId, x: number, z: number, target?: string, y = 0): Model {
    const model = this.library.instantiate(asset, 'galilee-' + id, target);
    model.root.position.set(x, groundHeight(this.region, { x, z }) + y, z);
    this.models.set(id, model);
    return model;
  }
  private pool(id: string, x: number, z: number, width: number, depth: number, y = 0.145): void {
    const mesh = MeshBuilder.CreateBox(
      'galilee-water-' + id,
      { width, depth, height: 0.016 },
      this.scene,
    );
    mesh.position.set(x, groundHeight(this.region, { x, z }) + y, z);
    mesh.material = this.material;
    mesh.isPickable = false;
    mesh.setEnabled(false);
    this.water.set(id, mesh);
  }
  update(s: GameState): void {
    const g = s.galilee;
    if (this.region === 'galilean-road') {
      const flow = traceWater(g.spring.turns);
      for (const mesh of this.water.values()) mesh.setEnabled(false);
      for (const id of CHANNEL_IDS) {
        const p = channelPosition(id),
          rotation = g.spring.turns[id];
        // Imported static GLBs reflect X; rotate the NW bend into the solver's NE basis.
        this.models.get(id)!.root.rotation.y =
          ((rotation + (id === 'entry' ? 0 : 1)) * Math.PI) / 2;
        for (let d = 0; d < 4; d++) {
          const mesh = this.water.get(id + '-' + d)!;
          const delta = [
            { x: 0, z: 0.5 },
            { x: 0.5, z: 0 },
            { x: 0, z: -0.5 },
            { x: -0.5, z: 0 },
          ][d]!;
          mesh.position.set(p.x + delta.x, groundHeight(this.region, p) + 0.145, p.z + delta.z);
          mesh.rotation.y = (d * Math.PI) / 2;
          mesh.setEnabled(
            g.spring.tested &&
              flow.path.includes(id) &&
              ports(id, rotation).includes(d as 0 | 1 | 2 | 3),
          );
        }
      }
      this.water.get('source-flow')!.setEnabled(g.spring.tested);
      if (g.spring.tested && flow.outlet) {
        this.water.get(flow.outlet + '-basin')!.setEnabled(true);
        this.water.get(flow.outlet + '-inlet')!.setEnabled(true);
      }
      for (const id of ['inlet', 'silt'] as const) {
        const model = this.models.get(id === 'inlet' ? 'inlet-stones' : 'silt')!;
        const cleared = g.spring.cleared.includes(id);
        model.root.position.x = cleared ? 2.1 : id === 'inlet' ? 3 : 4;
        model.root.position.z = cleared ? -8.5 - (id === 'silt' ? 0.6 : 0) : -7;
        model.root.position.y = groundHeight(this.region, model.root.position);
      }
      this.models.get('scoop')!.root.setEnabled(s.campaign.carrying !== 'channel-scoop');
      const actor = this.company[0]!;
      actor.root.setEnabled(g.spring.stage === 'complete');
      const pos = { x: 9.3, z: flow.outlet === 'north' ? -5 : -9 };
      actor.root.position.set(pos.x, groundHeight(this.region, pos), pos.z);
      actor.root.rotation.y = Math.PI / 2;
      this.scene.metadata = {
        ...this.scene.metadata,
        galilee: { flow: g.spring.tested ? flow : null, turns: g.spring.turns },
      };
    }
    if (this.region === 'roadside-farm') {
      const r = g.shelter;
      for (const [i, site] of REST_SITES.entries()) {
        const here = r.site === site,
          p = REST_LAYOUTS[site];
        this.previews[i]!.setEnabled(here && r.stage !== 'complete');
        for (const id of REST_SUPPLIES) {
          const model = this.models.get(site + '-' + id)!,
            point = supplyPosition(site, id, r.screen);
          model.root.setEnabled(here && r.placed.includes(id));
          model.root.position.set(point.x, groundHeight(this.region, point) + 0.03, point.z);
          if (id === 'screen') model.root.rotation.y = (r.screen * Math.PI) / 2;
          const socket = this.sockets.get(site + '-' + id)!;
          socket.position.set(point.x, groundHeight(this.region, point) + 0.045, point.z);
          socket.rotation.y = id === 'screen' ? (r.screen * Math.PI) / 2 : 0;
          socket.setEnabled(here && r.stage === 'arranging' && !r.placed.includes(id));
        }
        this.models.get(site + '-bench')!.root.setEnabled(true);
        if (here)
          for (const [n, actor] of this.company.entries()) {
            const point = { x: p.x + (n ? 0.4 : -0.4), z: p.z + 0.9 };
            actor.root.position.set(point.x, groundHeight(this.region, point) + 0.02, point.z);
            actor.root.rotation.y = 0;
          }
      }
      for (const id of REST_SUPPLIES)
        this.models
          .get('stored-' + id)!
          .root.setEnabled(!r.placed.includes(id) && s.campaign.carrying !== 'rest-' + id);
      for (const actor of this.company) actor.root.setEnabled(r.stage === 'complete');
      this.scene.metadata = {
        ...this.scene.metadata,
        galilee: { site: r.site, placed: r.placed, screen: r.screen, stage: r.stage },
      };
    }
  }
  settings(s: Settings): void {
    this.still = s.reducedMotion;
  }
  tick(dt: number): void {
    this.elapsed += dt;
    for (const actor of this.company)
      if (actor.root.isEnabled())
        actor.sample(this.region === 'galilean-road' ? 'Kneel' : 'Sit', dt, this.still);
    this.material.alpha = this.still ? 1 : 0.92 + Math.sin(this.elapsed * 0.7) * 0.05;
  }
}
