import { test } from '@playwright/test';
import { phoneRouteHud } from '../helpers/phone-route-hud-browser';

for (const available of [true, false]) {
  for (const large of [false, true]) {
    test(`short phone HUD keeps ${available ? 'available' : 'unavailable'} routes and ${large ? 'large' : 'standard'} quest reading clear through real graphics loss`, async ({
      page,
      isMobile,
      browserName,
    }, info) => {
      await phoneRouteHud(page, available, large, isMobile, browserName, info);
    });
  }
}
