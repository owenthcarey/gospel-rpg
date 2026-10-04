import { test } from '@playwright/test';
import {
  graphicsQuestNotice,
  keyboardQuestNotice,
  pointerQuestNotice,
} from '../helpers/quest-notice-browser';

test('floating feedback leaves the selected expanded quest shortcut visible through resizing and expiry', async ({
  page,
}, info) => {
  await keyboardQuestNotice(page, info);
});

test('native pointer tracking keeps large-text quest controls clear of floating feedback on a short phone', async ({
  page,
  isMobile,
  browserName,
}, info) => {
  await pointerQuestNotice(page, isMobile, browserName, info);
});

test('graphics interruption keeps a focused expanded quest clear of held feedback through portrait resizing', async ({
  page,
  isMobile,
  browserName,
}, info) => {
  await graphicsQuestNotice(page, info, isMobile, browserName);
});
