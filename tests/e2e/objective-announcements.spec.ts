import { expect, test } from '@playwright/test';
import { choice, ready, settled, visit } from '../helpers/connection-browser';

type ObjectiveAnnouncer = HTMLElement & {
  announcements?: string[];
  observer?: MutationObserver;
};

test('objectives announce changed guidance without repeating it during travel and arrival', async ({
  page,
}) => {
  await ready(page);
  const announcer = page.locator('#announcer');
  await expect(announcer).toHaveText('Speak with Simon');
  await expect(announcer).toHaveAttribute('aria-live', 'polite');
  await announcer.evaluate((element) => {
    const node = element as ObjectiveAnnouncer;
    node.announcements = [];
    node.observer = new MutationObserver(() => {
      node.announcements!.push(node.textContent ?? '');
    });
    node.observer.observe(node, { childList: true, characterData: true, subtree: true });
  });
  const announcements = () =>
    announcer.evaluate((element) => (element as ObjectiveAnnouncer).announcements!);
  try {
    // An optional neighbor and a return to Simon select and finish real walking routes.
    await visit(page, 'miriam');
    await expect(page.locator('.dialogue-main h2')).toHaveText('Miriam');
    await page.getByRole('button', { name: 'Leave conversation', exact: true }).click();
    await visit(page, 'simon');
    await expect(page.locator('.dialogue-main h2')).toHaveText('Simon');
    await expect(announcer).toHaveText('Speak with Simon');
    expect(await announcements()).toEqual([]);

    await choice(page, 'Of course');
    await choice(page, 'I’ll bring the net');
    await settled(page);
    await expect(announcer).toHaveText('Collect the mended net');
    expect(await announcements()).toEqual(['Collect the mended net']);
  } finally {
    await announcer.evaluate((element) => {
      const node = element as ObjectiveAnnouncer;
      node.observer?.disconnect();
      delete node.observer;
      delete node.announcements;
    });
  }
});
