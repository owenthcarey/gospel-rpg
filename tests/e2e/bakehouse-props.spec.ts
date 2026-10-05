import { test } from '@playwright/test';
import { bakehouseProp, bakehouseProps } from '../helpers/bakehouse-props-browser';

for (const prop of bakehouseProps)
  test(`${prop.target} supports native model options, inspection, pickup and return`, async ({
    page,
    isMobile,
  }, info) => {
    test.setTimeout(180_000);
    await bakehouseProp(page, info, prop, isMobile);
  });
