import { test } from '@playwright/test';
import { narrowWorkReading } from '../helpers/work-reading-browser';

test('narrow large-text work keeps full supply guidance, touch controls and the framed world readable', async ({
  page,
}, info) => {
  await narrowWorkReading(page, info);
});
