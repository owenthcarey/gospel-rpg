import { isLakeRegion } from '../../game/lake/types';
import type { GameState } from '../../game/types';
import type { ExplorationRegion } from '../../game/campaign/types';
import { journeyPlaces, knownRegions, travelerRegion } from '../../content/journey';
import { gateways, nextGateway } from '../../content/campaign/places';
import { regions } from '../../content/regions';
import { isRoadRegion } from '../../game/road/types';
import { objectiveTarget } from '../../game/quest';
import { escapeHtml as esc, icon } from '../icons';

const labels: Record<ExplorationRegion, string[]> = {
  capernaum: ['The shore'],
  'capernaum-lanes': ['Capernaum', 'lanes'],
  'gathering-house': ['Gathering', 'house'],
  bakehouse: ['Bakehouse'],
  'galilean-road': ['Galilean road'],
  'roadside-farm': ['Roadside farm'],
  'nain-gate': ['Nain'],
  'galilee-water': ['Lake crossing'],
  'reed-landing': ['Reed shore'],
  'sheltered-cove': ['Sheltered cove'],
};

function placeGlyph(id: ExplorationRegion): string {
  if (isLakeRegion(id)) return '<path d="m-14 4 5 8h18l5-8Z"/><path d="M0 4v-18L11 1H0"/>';
  if (id === 'galilean-road')
    return '<path d="m-8 13 3-25h10l3 25Z"/><path d="M-2-5h5M-3 2h7M-4 8h9"/>';
  return '<path d="m-15-3 15-10 15 10Z"/><path d="M-11-3v16h22V-3M-3 13V3h6v10"/>';
}

export function journeyMap(s: GameState): string {
  const known = knownRegions(s),
    here = travelerRegion(s),
    target = objectiveTarget(s),
    next = gateways.find((g) => g.id === target);
  const visible = Object.keys(journeyPlaces).filter(
    (id) =>
      id === 'capernaum' ||
      (isLakeRegion(id)
        ? s.road.chapter.stage === 'complete'
        : isRoadRegion(id)
          ? s.campaign.roof.stage === 'complete'
          : s.episode.stage === 'complete'),
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
  const points = visible.map((id) => journeyPlaces[id]),
    left = Math.min(...points.map((p) => p.x)),
    right = Math.max(...points.map((p) => p.x)),
    top = Math.min(...points.map((p) => p.y)),
    bottom = Math.max(...points.map((p) => p.y)),
    width = Math.max(270, right - left + 176),
    height = Math.max(225, bottom - top + 129),
    minX = (left + right - width) / 2,
    minY = top - 55 - (height - (bottom - top + 129)) / 2;
  const routes = connections
    .map((g) => {
      const a = journeyPlaces[g.from],
        b = journeyPlaces[g.to],
        tracked = next && (next.id === g.id || (next.from === g.to && next.to === g.from)),
        visited = known.includes(g.from) && known.includes(g.to);
      return `<path class="journey-map-route ${tracked ? 'tracked' : ''}" d="M${a.x} ${a.y}L${b.x} ${b.y}" ${visited ? '' : 'stroke-dasharray="7 6"'}/>`;
    })
    .join('');
  const places = visible
    .map((id, index) => {
      const p = journeyPlaces[id],
        status = id === here ? 'here' : known.includes(id) ? 'visited' : 'unvisited';
      return `<g class="journey-map-place ${status}" transform="translate(${p.x} ${p.y})"><title>${esc(regions[id].title)} · ${id === here ? 'You are here' : known.includes(id) ? 'Visited' : 'Not yet visited'}</title><rect class="journey-map-marker" x="-22" y="-22" width="44" height="44"/>${id === here ? '<rect class="journey-map-current" x="-27" y="-27" width="54" height="54"/>' : ''}<g class="journey-map-glyph">${placeGlyph(id)}</g><rect class="journey-map-number-back" x="13" y="-31" width="23" height="23"/><text class="journey-map-number" x="24.5" y="-14" text-anchor="middle">${index + 1}</text><text class="journey-map-label" text-anchor="middle" y="42">${labels[id].map((line, row) => `<tspan x="0" dy="${row ? '17' : '0'}">${esc(line)}</tspan>`).join('')}</text></g>`;
    })
    .join('');
  return `<section class="journey-atlas-surface" aria-label="Journey map"><div class="journey-guidance"><div>${icon('compass')}<div><strong>You are at ${esc(regions[here].title)}.</strong><p>${next ? 'Next passage for your tracked story: ' + esc(next.name) + '.' : 'Your tracked destination is within this region.'}</p></div></div>${next ? `<button class="primary-button" data-action="travel" data-value="${next.id}">Approach the next passage ${icon('arrow')}</button>` : ''}</div><div class="journey-atlas"><figure class="journey-chart"><div class="journey-chart-title"><span>GALILEE</span><span>${visible.filter((id) => known.includes(id)).length} / ${visible.length} places visited</span></div><svg class="journey-map" viewBox="${minX} ${minY} ${width} ${height}" role="img" aria-label="Connected places. You are at ${esc(regions[here].title)}. ${visible.map((id) => esc(regions[id].title)).join(', ')}."><desc>Solid paths join visited places. Dashed paths lead to places still to discover. Numbers match the destination list.</desc>${routes}${places}</svg><figcaption class="journey-map-legend"><span><i class="journey-key-here" aria-hidden="true"></i>You are here</span><span><i class="journey-key-visited" aria-hidden="true"></i>Visited</span><span><i class="journey-key-unvisited" aria-hidden="true"></i>Not yet visited</span><span class="journey-key-paths">Numbers match the destination list</span></figcaption></figure><div class="journey-destinations" aria-label="Connected destinations">${visible
    .map((id, index) => {
      const p = journeyPlaces[id],
        doorway = nextGateway(here, id);
      return `<article class="journey-destination ${id === here ? 'current' : ''}"><header><span class="journey-destination-number" aria-hidden="true">${index + 1}</span><div><h3>${esc(regions[id].title)}</h3><span class="journey-destination-status">${id === here ? 'You are here' : known.includes(id) ? 'Visited' : 'Not yet visited'}</span></div></header><p>${esc(p.description)}</p>${doorway ? `<p class="journey-next-passage">Next: ${esc(gateways.find((g) => g.id === doorway)!.name)}</p>` : ''}<button class="secondary-button" data-action="travel" data-value="${p.destination}">${id === here ? 'Explore here' : 'Follow the path'} ${icon('arrow')}</button></article>`;
    })
    .join(
      '',
    )}</div></div>${s.road.company.stage !== 'not-started' ? `<aside class="journey-companion"><h3>Neri · ${esc(regions[s.road.company.region].title)}</h3><p>${s.road.company.stage === 'complete' ? 'Resting in the courtyard after your walk.' : 'Waiting or walking at your shared pace. He stays here if you take another exit.'}</p><button class="secondary-button" data-action="travel" data-value="neri">Find Neri</button><button class="secondary-button" data-action="road-company">See your route together</button></aside>` : ''}<p class="content-note">Travel takes place on foot or aboard your ordinary boat. Solid lines join visited places. Dashed lines lead to places still to discover. This is a schematic of the game’s imagined, compressed journey; it does not show historical distances or the exact chronology of the Gospel accounts.</p></section>`;
}
