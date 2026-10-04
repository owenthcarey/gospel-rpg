import { afterEach, describe, expect, it, vi } from 'vitest';
import { measureHullOptions } from '../helpers/moored-boat-browser';

afterEach(() => vi.unstubAllGlobals());

/** Native DOM-shaped surfaces, independent of the application or pointer event dispatch. */
function studio() {
  class Surface {
    isConnected = true;
    textContent = '';
    disabled = false;
    visible = true;
    transform = 'translate(126.72,107.52)';
    visibility = 'visible';
    children: Surface[] = [];
    box = { left: 50, top: 100, width: 120, height: 44 };
    getBoundingClientRect() {
      return this.visible ? this.box : { ...this.box, width: 0, height: 0 };
    }
    getAttribute() {
      return this.transform;
    }
    querySelectorAll() {
      return this.children;
    }
    contains(node: Surface) {
      return node === this || this.children.includes(node);
    }
    closest() {
      return null;
    }
  }
  const menu = new Surface();
  const visit = new Surface();
  visit.textContent = 'Visit Lake boat';
  const examine = new Surface();
  examine.textContent = 'Examine Lake boat';
  examine.box.top = 144;
  menu.children = [visit, examine];
  const player = new Surface();
  const destination = new Surface();
  destination.visible = false;
  const dialog = new Surface();
  const nodes: Record<string, Surface[]> = {
    '[role="menu"][aria-label="Choose Option"]': [menu],
    '#minimap-player': [player],
    '.minimap-destination': [destination],
    '[role="dialog"]': [],
  };
  const document = {
    activeElement: visit,
    querySelectorAll: (selector: string) => nodes[selector] ?? [],
    elementFromPoint: (_x: number, y: number) => (y < 144 ? visit : examine),
  };
  vi.stubGlobal('HTMLButtonElement', Surface);
  vi.stubGlobal('document', document);
  vi.stubGlobal('getComputedStyle', (node: Surface) => ({ visibility: node.visibility }));
  vi.stubGlobal('innerWidth', 390);
  vi.stubGlobal('innerHeight', 844);
  return { menu, visit, examine, player, destination, dialog, nodes, document };
}

describe('atomic native hull option observation', () => {
  it('retains every visible menu, shore and native-control predicate in one sample', () => {
    studio();
    expect(measureHullOptions({ boatName: 'Lake boat' })).toEqual({
      valid: true,
      menuVisible: true,
      dialogHidden: true,
      destinationHidden: true,
      playerTransform: 'translate(126.72,107.52)',
      visitVisible: true,
      examineVisible: true,
      menuOwnsFocus: true,
      optionsExposed: true,
    });
  });

  it('rejects absent or duplicate observation targets and unparseable standing transforms', () => {
    for (const selector of ['#minimap-player', '.minimap-destination']) {
      const { nodes } = studio();
      const original = nodes[selector]![0]!;
      nodes[selector] = [];
      expect(measureHullOptions({ boatName: 'Lake boat' }).valid).toBe(false);
      nodes[selector] = [original, original];
      expect(measureHullOptions({ boatName: 'Lake boat' }).valid).toBe(false);
    }
    for (const transform of ['translate(NaN,8)', 'translate( ,8)', 'not-a-transform']) {
      const { player } = studio();
      player.transform = transform;
      expect(measureHullOptions({ boatName: 'Lake boat' }).valid).toBe(false);
    }
  });

  it('reports an active route or reading dialogue instead of treating it as a hidden surface', () => {
    const { destination, dialog, nodes } = studio();
    destination.visible = true;
    nodes['[role="dialog"]'] = [dialog];
    expect(measureHullOptions({ boatName: 'Lake boat' })).toMatchObject({
      destinationHidden: false,
      dialogHidden: false,
    });
  });

  it('requires actual exposed controls and menu focus ownership', () => {
    const { document, player } = studio();
    document.elementFromPoint = () => player;
    document.activeElement = player;
    expect(measureHullOptions({ boatName: 'Lake boat' })).toMatchObject({
      menuOwnsFocus: false,
      optionsExposed: false,
    });
  });

  it('rejects invisible or disabled native options even when the menu remains rendered', () => {
    const { visit, examine } = studio();
    visit.disabled = true;
    examine.visibility = 'hidden';
    expect(measureHullOptions({ boatName: 'Lake boat' })).toMatchObject({
      menuVisible: true,
      examineVisible: false,
      optionsExposed: false,
    });
  });
});
