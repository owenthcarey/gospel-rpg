import { afterEach, describe, expect, it, vi } from 'vitest';
import { Interface } from '../../src/ui/interface';
import { newGame, type Point } from '../../src/game/types';
import { routePlan, type RoutePlan } from '../../src/game/connection/routes';

afterEach(() => vi.unstubAllGlobals());

/** Exercise the actual frame and pause handoffs with only the unrelated layout surfaces stubbed. */
function studio(plan?: RoutePlan) {
  const resume = { hidden: true, disabled: false, dataset: {} as Record<string, string> };
  const cancel = { hidden: false, disabled: false, textContent: 'Cancel walk' };
  const travel = {
    hidden: true,
    querySelector: (selector: string) => (selector.includes('route-resume') ? resume : cancel),
  };
  const guidance = { textContent: '', title: '', scrollTop: 0 };
  const minimap = { update: vi.fn(), setPaused: vi.fn(), clearDestination: vi.fn() };
  const nearby = { hidden: true };
  const fixture = Object.assign(Object.create(Interface.prototype), {
    root: {
      dataset: {},
      clientHeight: 900,
      clientWidth: 1440,
      querySelector: (selector: string) =>
        selector === '#travel-status' ? travel : selector === '#nearby-action' ? nearby : null,
    },
    routeGuidance: guidance,
    travelPlan: plan,
    labelNodes: new Map(),
    hudReservations: [],
    toastNode: { hidden: true },
    trayTargets: new Set(),
    lastNearest: null,
    labels: { inert: false },
    hud: { querySelectorAll: () => [] },
    minimap,
    worldPaused: false,
    graphicsPaused: false,
    hints: { move: () => false },
    setHintsFaded: vi.fn(),
    updateTray: vi.fn(),
    setNoticeClearance: vi.fn(),
    reserveQuestNoticeSpace: vi.fn(),
    pauseWorldControls: vi.fn(),
  });
  vi.stubGlobal('document', { activeElement: null });
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1),
  );
  const ui = fixture as Interface;
  const frame = (target?: Point, destination?: string) =>
    ui.frame({ x: -1, z: -3 }, [], -Math.PI / 2, null, destination, target);
  return { ui, frame, fixture, resume, cancel, travel, guidance, minimap };
}

const savedRoute = () => {
  const state = newGame();
  state.connection.route = { target: 'olive' };
  return routePlan(state)!;
};

describe('active walk status', () => {
  it('describes an anonymous water course and its actual cancellation as steering', () => {
    const { frame, fixture, travel, resume, cancel, guidance, minimap } = studio();
    fixture.currentState = { ...newGame(), region: 'galilee-water' };
    const target = { x: 16, z: 12 };
    frame(target);
    expect(travel.hidden).toBe(false);
    expect(guidance.textContent).toBe('Steering to chosen point');
    expect(resume.hidden).toBe(true);
    expect(cancel).toEqual({ hidden: false, disabled: false, textContent: 'Cancel course' });
    expect(minimap.update.mock.calls.at(-1)?.at(-1)).toEqual(target);
  });

  it('shows an ordinary chosen point and Cancel only while an actual walk target exists', () => {
    const { frame, travel, resume, cancel, guidance, minimap } = studio();
    frame();
    expect(travel.hidden).toBe(true);
    const target = { x: -12, z: -3 };
    frame(target);
    expect(travel.hidden).toBe(false);
    expect(guidance.textContent).toBe('Walking to chosen point');
    expect(resume.hidden).toBe(true);
    expect(cancel).toEqual({ hidden: false, disabled: false, textContent: 'Cancel walk' });
    expect(minimap.update.mock.calls.at(-1)?.at(-1)).toEqual(target);
    // Both arrival and manual cancellation report an empty path through the next frame.
    frame();
    expect(travel.hidden).toBe(true);
    expect(guidance.textContent).toBe('');
    expect(minimap.update.mock.calls.at(-1)?.at(-1)).toBeUndefined();
  });

  it('clears an anonymous walk on pause before another world frame can arrive', () => {
    const { ui, frame, travel, resume, guidance, minimap, fixture } = studio();
    frame({ x: -12, z: -3 });
    ui.setWorldPaused(true);
    expect(fixture.activeWalkTarget).toBeUndefined();
    expect(travel.hidden).toBe(true);
    expect(guidance.textContent).toBe('');
    expect(resume.hidden).toBe(true);
    expect(minimap.clearDestination).toHaveBeenCalledOnce();
    ui.setWorldPaused(false);
    frame();
    expect(travel.hidden).toBe(true);
  });

  it('keeps the same cancellation control across land, lake, and landing frame handoffs', () => {
    const { frame, fixture, travel, cancel, guidance } = studio();
    fixture.currentState = newGame();
    const landState = fixture.currentState;
    frame({ x: -12, z: -3 });
    expect(cancel.textContent).toBe('Cancel walk');
    expect(travel.querySelector('[data-action="cancel-navigation"]')).toBe(cancel);
    fixture.currentState = { ...landState, region: 'galilee-water' };
    frame({ x: 16, z: 12 });
    expect(guidance.textContent).toBe('Steering to chosen point');
    expect(cancel.textContent).toBe('Cancel course');
    expect(travel.querySelector('[data-action="cancel-navigation"]')).toBe(cancel);
    fixture.currentState = { ...landState, region: 'reed-landing' };
    frame({ x: 4, z: 3 });
    expect(guidance.textContent).toBe('Walking to chosen point');
    expect(cancel.textContent).toBe('Cancel walk');
    expect(cancel.hidden).toBe(false);
    expect(cancel.disabled).toBe(false);
    expect(travel.querySelector('[data-action="cancel-navigation"]')).toBe(cancel);
  });

  it('retains the saved route and water cancellation name across pause and resume', () => {
    const plan = savedRoute();
    const { ui, frame, fixture, travel, cancel, resume, minimap } = studio(plan);
    fixture.currentState = { ...newGame(), region: 'galilee-water' };
    frame({ x: 16, z: 12 });
    ui.setWorldPaused(true);
    expect(cancel.textContent).toBe('Cancel course');
    expect(fixture.travelPlan).toBe(plan);
    expect(travel.hidden).toBe(false);
    expect(resume.hidden).toBe(false);
    expect(minimap.clearDestination).toHaveBeenCalledOnce();
    ui.setWorldPaused(false);
    frame({ x: 17, z: 12 });
    expect(cancel.textContent).toBe('Cancel course');
    expect(cancel.hidden).toBe(false);
    expect(cancel.disabled).toBe(false);
    expect(fixture.travelPlan).toBe(plan);
  });

  it('does not describe a stale target as active while graphics are paused', () => {
    const { ui, frame, travel, guidance, fixture } = studio();
    frame({ x: -12, z: -3 });
    ui.setGraphicsPaused(true);
    expect(fixture.activeWalkTarget).toBeUndefined();
    expect(travel.hidden).toBe(true);
    expect(guidance.textContent).toBe('');
    frame({ x: -12, z: -3 });
    expect(fixture.activeWalkTarget).toBeUndefined();
    ui.setGraphicsPaused(false);
    expect(travel.hidden).toBe(true);
  });

  it('retains named approach text and hides Resume while approaching its saved destination', () => {
    const { frame, travel, resume, guidance } = studio(savedRoute());
    frame({ x: -7, z: -5 }, 'olive');
    expect(travel.hidden).toBe(false);
    expect(guidance.textContent).toBe('Approaching Olive grove');
    expect(resume.hidden).toBe(true);
    frame();
    expect(travel.hidden).toBe(false);
    expect(guidance.textContent).toBe('Olive grove · Your destination is in this region.');
    expect(resume.hidden).toBe(false);
    expect(resume.disabled).toBe(false);
  });

  it('keeps a saved destination resumable during an anonymous walk and after its interruption', () => {
    const { ui, frame, travel, resume, guidance } = studio(savedRoute());
    frame({ x: -12, z: -3 });
    expect(guidance.textContent).toBe('Olive grove · Walking to chosen point');
    expect(resume.hidden).toBe(false);
    expect(resume.disabled).toBe(false);
    ui.setWorldPaused(true);
    expect(travel.hidden).toBe(false);
    expect(guidance.textContent).toBe('Olive grove · Your destination is in this region.');
    expect(resume.hidden).toBe(false);
  });

  it('preserves an unavailable saved route and its disabled Resume control', () => {
    const plan = { ...savedRoute(), available: false, message: 'There is no open route.' };
    const { frame, travel, resume, guidance } = studio(plan);
    frame();
    expect(travel.hidden).toBe(false);
    expect(guidance.textContent).toBe('Olive grove · There is no open route.');
    expect(resume.hidden).toBe(false);
    expect(resume.disabled).toBe(true);
  });
});
