import { expect, type Page } from '@playwright/test';

/** Observe short-lived native route feedback before slow browser-driver calls miss arrival. */
export async function observeNavigation(
  page: Page,
  options: { ground?: boolean; loseContext?: boolean } = {},
) {
  // This handle retains the completed reading until the driver retrieves it. Setup is awaited
  // before native input; neither the route nor the graphics pause is simulated.
  const reading = await page.evaluateHandle((options) => {
    const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
    const extension = options.loseContext
      ? (canvas.getContext('webgl2') ?? canvas.getContext('webgl'))!.getExtension(
          'WEBGL_lose_context',
        )
      : null;
    if (options.loseContext && !extension) throw new Error('WEBGL_lose_context is unavailable');
    const sample = () => {
      const travel = document.querySelector<HTMLElement>('#travel-status')!;
      const resume = travel.querySelector<HTMLButtonElement>('[data-action="route-resume"]')!;
      const cancel = travel.querySelector<HTMLButtonElement>('[data-action="cancel-navigation"]')!;
      const flag = document.querySelector<SVGElement>('.minimap-destination');
      const point = (node: Element | null) => {
        const match = node?.getAttribute('transform')?.match(/translate\(([^,]+),([^)]*)\)/);
        return match ? { x: Number(match[1]) / 4 - 24, z: 24 - Number(match[2]) / 4 } : null;
      };
      return {
        visible: !travel.hidden,
        text: travel.querySelector('span')!.textContent,
        resumeVisible: !resume.hidden,
        resumeDisabled: resume.disabled,
        cancelDisabled: cancel.disabled,
        flagVisible: !!flag && getComputedStyle(flag).display !== 'none',
        graphicsPaused: document.querySelector<HTMLElement>('#ui')!.dataset.graphicsPaused,
        pending: document.querySelector<HTMLElement>('#ui')!.dataset.actionPending,
        standing: point(document.querySelector('#minimap-player')),
        endpoint: point(flag),
        trackingValue: document
          .querySelector('.quest-card .village-shortcut')
          ?.getAttribute('data-value'),
      };
    };
    type Feedback = ReturnType<typeof sample>;
    const retained = {
      initial: sample(),
      last: sample(),
      active: undefined as Feedback | undefined,
      beforeTracking: undefined as Feedback | undefined,
      result: undefined as
        { active: Feedback; beforeTracking?: Feedback; afterTracking?: Feedback } | undefined,
      lossRequested: false,
      restore: () => {
        cleanup();
        if (retained.lossRequested) extension!.restoreContext();
      },
    };
    const tracked = (event: MouseEvent) => {
      const control = (event.target as Element | null)?.closest('.village-shortcut');
      if (event.isTrusted && control?.getAttribute('data-value') === 'village') {
        retained.beforeTracking = sample();
      }
    };
    const cleanup = () => {
      observer.disconnect();
      document.removeEventListener('click', tracked, true);
    };
    const changed = () => {
      const current = (retained.last = sample());
      const active =
        current.flagVisible &&
        current.visible &&
        (options.ground
          ? !current.text?.includes('Approaching')
          : current.text?.includes('Approaching Olive grove'));
      if (!active) return;
      retained.active ??= current;
      if (
        options.ground &&
        (!retained.beforeTracking?.flagVisible ||
          current.trackingValue !== 'main' ||
          current.pending !== 'false')
      )
        return;
      cleanup();
      retained.result = {
        active: retained.active,
        ...(options.ground
          ? { beforeTracking: retained.beforeTracking, afterTracking: current }
          : {}),
      };
      if (extension) {
        retained.lossRequested = true;
        extension.loseContext();
      }
    };
    const observer = new MutationObserver(changed);
    observer.observe(document.querySelector('#ui')!, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['hidden', 'style', 'transform', 'data-value', 'data-action-pending'],
    });
    document.addEventListener('click', tracked, true);
    changed();
    return retained;
  }, options);
  return {
    async observed() {
      await expect
        .poll(
          () =>
            reading.evaluate((value) => ({
              observed: !!value.result,
              initial: value.initial,
              last: value.last,
              beforeTracking: value.beforeTracking,
            })),
          { timeout: 60_000, message: 'Native active navigation feedback was not observed' },
        )
        .toMatchObject({ observed: true });
      return reading.evaluate((value) => value.result!);
    },
    async restore() {
      await reading.evaluate((value) => value.restore());
      await reading.dispose();
    },
  };
}
