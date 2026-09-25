import type { GameState, Settings } from '../../game/types';
import { passageMarkers, HOME_COMPANY } from '../../content/connection/presentation';
import { groundHeight } from '../../content/campaign/layouts';
import type { AssetLibrary, Model } from '../assets';
import { Actor } from './actor';

/** Saved completion reveals ambient neighbors; it never completes their earlier stories. */
export class ConnectionActivity {
  private markers = new Map<string, Model>();
  private company: Actor[] = [];
  private settingsValue?: Settings;
  private complete = false;
  constructor(library: AssetLibrary, s: GameState) {
    for (const p of passageMarkers(s)) {
      const marker = library.instantiate('passage_marker', 'passage-marker-' + p.id, p.id);
      marker.root.position.set(p.x, groundHeight(s.region, p), p.z);
      this.markers.set(p.id, marker);
    }
    if (s.region === 'capernaum')
      for (const [i, p] of HOME_COMPANY.entries()) {
        const actor = new Actor(library.instantiate('villager', 'home-company-' + i), true);
        actor.root.position.set(p.x, 0, p.z);
        actor.root.rotation.y = p.rotation;
        actor.pose('Idle');
        this.company.push(actor);
      }
    this.update(s);
  }
  update(s: GameState): void {
    for (const p of passageMarkers(s)) this.markers.get(p.id)?.root.setEnabled(p.available);
    this.complete = !!s.connection.home.reflection;
    this.visibility();
  }
  settings(s: Settings): void {
    this.settingsValue = s;
    this.visibility();
  }
  private visibility(): void {
    this.company.forEach((actor, i) =>
      actor.root.setEnabled(this.complete && (i === 0 || this.settingsValue?.quality !== 'low')),
    );
  }
  tick(dt: number): void {
    for (const actor of this.company)
      actor.sample('Idle', dt, this.settingsValue?.reducedMotion ?? false);
  }
}
