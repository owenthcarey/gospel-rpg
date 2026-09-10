import type { GameState } from '../../game/types';
import type { ExplorationRegion } from '../../game/campaign/types';
import { journeyPlaces, knownRegions, travelerRegion } from '../../content/journey';
import { gateways, nextGateway } from '../../content/campaign/places';
import { regions } from '../../content/regions';
import { isRoadRegion } from '../../game/road/types';
import { objectiveTarget } from '../../game/quest';
import { escapeHtml as esc } from '../icons';
export function journeyMap(s: GameState): string {
  const known = knownRegions(s),
    here = travelerRegion(s),
    target = objectiveTarget(s),
    next = gateways.find((g) => g.id === target);
  const visible = Object.keys(journeyPlaces).filter(
    (id) =>
      id === 'capernaum' ||
      (isRoadRegion(id) ? s.campaign.roof.stage === 'complete' : s.episode.stage === 'complete'),
  ) as ExplorationRegion[];
  const connections = gateways
    .filter((g) => visible.includes(g.from) && visible.includes(g.to))
    .filter(
      (g, i, all) =>
        all.findIndex(
          (other) =>
            (other.from === g.from && other.to === g.to) ||
            (other.to === g.from && other.from === g.to),
        ) === i,
    );
  return `<p class="panel-lead">Your journey through the places you know. Lines show connected paths; travel still takes place on foot. This is a schematic of the game’s imagined, compressed journey.</p><div class="journey-guidance"><strong>You are at ${esc(regions[here].title)}.</strong><p>${next ? 'Next doorway for your tracked story: ' + esc(next.name) + '.' : 'Your tracked destination is within this region.'}</p>${next ? `<button class="primary-button" data-action="travel" data-value="${next.id}">Walk to the next doorway</button>` : ''}</div><svg class="journey-map" viewBox="0 0 620 410" role="img" aria-label="Connected places: the shore leads to Capernaum lanes, with the house and bakehouse nearby. After Chapter II, the Galilean road connects Capernaum to the roadside farm and Nain."><rect width="620" height="410" rx="20" fill="#ede5d0"/>${connections
    .map((g) => {
      const a = journeyPlaces[g.from],
        b = journeyPlaces[g.to];
      return `<path d="M${a.x} ${a.y}L${b.x} ${b.y}" stroke="${next && (next.id === g.id || (next.from === g.to && next.to === g.from)) ? '#a76c2c' : '#b8b29c'}" stroke-width="5" ${known.includes(g.from) && known.includes(g.to) ? '' : 'stroke-dasharray="8 8"'}/>`;
    })
    .join('')}${visible
    .map((id) => {
      const p = journeyPlaces[id];
      return `<g transform="translate(${p.x} ${p.y})"><circle r="${id === here ? 17 : 12}" fill="${id === here ? '#314f46' : known.includes(id) ? '#b28a44' : '#e0d5b9'}" stroke="#667767" stroke-width="2"/>${id === here ? '<path d="m0-8 5 14-5-3-5 3z" fill="#fff4cf"/>' : ''}<text text-anchor="middle" y="35" fill="#34453c" font-size="13">${esc(id === 'capernaum' ? 'The shore' : id === 'capernaum-lanes' ? 'Capernaum lanes' : id === 'gathering-house' ? 'Gathering house' : id === 'roadside-farm' ? 'Roadside farm' : id === 'galilean-road' ? 'Galilean road' : id === 'nain-gate' ? 'Nain' : 'Bakehouse')}</text></g>`;
    })
    .join('')}</svg><div class="journey-destinations">${visible
    .map((id) => {
      const p = journeyPlaces[id],
        doorway = nextGateway(here, id);
      return `<article><h3>${esc(regions[id].title)}</h3><span class="status-pill">${id === here ? 'You are here' : known.includes(id) ? 'Visited' : 'Not yet visited'}</span><p>${esc(p.description)}</p>${doorway ? `<p class="content-note">Next: ${esc(gateways.find((g) => g.id === doorway)!.name)}</p>` : ''}<button class="secondary-button" data-action="travel" data-value="${p.destination}">${id === here ? 'Explore here' : 'Follow the path'}</button></article>`;
    })
    .join(
      '',
    )}</div>${s.road.company.stage !== 'not-started' ? `<aside class="journey-companion"><h3>Neri · ${esc(regions[s.road.company.region].title)}</h3><p>${s.road.company.stage === 'complete' ? 'Resting in the courtyard after your walk.' : 'Waiting or walking at your shared pace. He stays here if you take another exit.'}</p><button class="secondary-button" data-action="travel" data-value="neri">Find Neri</button><button class="secondary-button" data-action="road-company">See your route together</button></aside>` : ''}<p class="content-note">Solid lines join visited places. Dashed lines lead to places still to discover. The map does not show historical distances or the exact chronology of the Gospel accounts.</p>`;
}
