import type { GameState, Settings } from '../../game/types';
import type { ExplorationRegion } from '../../game/campaign/types';
import { heldAssets, lifePresentation } from '../../content/life/presentation';
import type { AssetId } from '../../content/assets';
import type { AssetLibrary, Model } from '../assets';
import { Actor } from './actor';

/** Saved story state determines every prop; ambient company never replaces Amos. */
export class LifeActivity {
  private held = new Map<string, Model>();
  private props = new Map<string, Model>();
  private company: Actor[] = [];
  private resting?: Actor;
  private still = false;
  constructor(
    library: AssetLibrary,
    player: Actor,
    private region: ExplorationRegion,
  ) {
    for (const [id, asset] of Object.entries(heldAssets)) {
      const model = library.instantiate(asset, 'held-' + id);
      player.attach(model);
      model.root.scaling.setAll(id === 'sewing-pouch' ? 1 : 0.8);
      model.root.setEnabled(false);
      this.held.set(id, model);
    }
    const prop = (id: string, asset: AssetId, x: number, y: number, z: number, target?: string) => {
      const model = library.instantiate(asset, 'life-' + id, target);
      model.root.position.set(x, y, z);
      this.props.set(id, model);
      return model;
    };
    if (region === 'capernaum') {
      prop('pouch', 'sewing_pouch', 4, 0.05, -10, 'sewing-rest');
      for (const asset of ['bench_loose', 'bench_lashed', 'bench_braced'] as const)
        prop(asset, asset, 3, 0, 7, 'landing-bench');
      prop('pieces', 'bench_pieces', 3, 0.02, 7);
      prop('cord-basket', 'basket_empty', 1, 0, 3, 'cord-basket').root.scaling.setAll(0.7);
      prop('cord', 'lashing_cord', 1, 0.32, 3, 'cord-basket');
      this.resting = new Actor(library.instantiate('villager', 'life-resting-neighbor'));
      this.resting.root.position.set(3.45, 0.08, 7);
      this.resting.root.rotation.y = Math.PI;
      this.resting.pose('Sit');
    }
    if (region === 'capernaum-lanes') {
      prop('pouch', 'sewing_pouch', 6.75, 0.06, 5.3);
      prop('thread', 'thread_clue', -9, 0.03, -2, 'thread-clue');
    }
    if (region === 'bakehouse') {
      prop('cloth', 'mending_cloth', -2, 0.07, -2, 'cloth-clue');
      prop('brace', 'wood_brace', 2, 0.08, -3, 'brace-shelf');
    }
    if (region === 'capernaum-lanes' || region === 'bakehouse') {
      for (let i = 0; i < 2; i++) {
        const actor = new Actor(library.instantiate('villager', 'life-table-neighbor-' + i));
        const outdoor = region === 'capernaum-lanes';
        actor.root.position.set((outdoor ? 6 : 0) + (i ? 0.5 : -0.5), 0.08, outdoor ? 1.7 : 0.6);
        actor.pose('Sit');
        this.company.push(actor);
      }
    }
  }
  update(s: GameState): void {
    const p = lifePresentation(s);
    for (const [id, model] of this.held) model.root.setEnabled(s.campaign.carrying === id);
    for (const model of this.props.values()) model.root.setEnabled(p.active);
    if (this.region === 'capernaum') {
      this.props.get('pouch')!.root.setEnabled(p.active && p.pouchAtShore);
      for (const id of ['bench_loose', 'bench_lashed', 'bench_braced'])
        this.props.get(id)!.root.setEnabled(p.benchAsset === id);
      this.props.get('pieces')!.root.setEnabled(true);
      this.props
        .get('pieces')!
        .root.position.set(p.piecesCleared ? 4.45 : 3, 0.02, p.piecesCleared ? 7.45 : 7);
      this.props
        .get('cord')!
        .root.setEnabled(
          p.active &&
            s.campaign.carrying !== 'lashing-cord' &&
            !(
              s.life.bench.method === 'lashing' &&
              ['fitted', 'complete'].includes(s.life.bench.stage)
            ),
        );
      this.resting!.root.setEnabled(p.active && p.benchOccupied);
    }
    if (this.region === 'capernaum-lanes')
      this.props.get('pouch')!.root.setEnabled(p.pouchWithRuth);
    if (this.region === 'bakehouse')
      this.props
        .get('brace')!
        .root.setEnabled(
          p.active &&
            s.campaign.carrying !== 'wood-brace' &&
            !(
              s.life.bench.method === 'brace' && ['fitted', 'complete'].includes(s.life.bench.stage)
            ),
        );
    const here = p.tableCompany === (this.region === 'capernaum-lanes' ? 'courtyard' : 'bakehouse');
    for (const actor of this.company) actor.root.setEnabled(here);
  }
  settings(s: Settings): void {
    this.still = s.reducedMotion;
  }
  tick(dt: number): void {
    this.resting?.sample('Sit', dt, this.still);
    for (const actor of this.company) actor.sample('Sit', dt, this.still);
  }
}
