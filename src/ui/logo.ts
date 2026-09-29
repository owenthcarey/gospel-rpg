/**
 * The Way mark: a road rising to a dawn horizon over still water, inside a ring.
 * Keep this geometry in sync with the copies in index.html and public/favicon.svg.
 */
export const MARK_PATHS =
  '<circle cx="24" cy="24" r="21.2"/>' +
  '<circle cx="24" cy="24" r="18" stroke-width="0.8" opacity=".55"/>' +
  '<path d="M9.6 25.4h28.8"/>' +
  '<path d="M17.4 25.4a6.6 6.6 0 0 1 13.2 0"/>' +
  '<path d="M24 12.6v2.8M16.2 16.2l1.9 1.9M31.8 16.2l-1.9 1.9M12.6 21.6h2.4M33 21.6h2.4"/>' +
  '<path d="M17 41c2.8-3.6 6.6-4.6 7-7 .3-2.1-.7-4.6-.6-6.4M27.4 41c.2-2.6.9-4.8.6-7-.3-2.4-2.8-4.6-3.4-6.4"/>' +
  '<path d="M12.2 29.6h4.2M31.4 29.6h4.6M14.2 33.4h3M31.2 33.4h2.8"/>';

export function logoMark(className = 'logo-mark'): string {
  return `<svg class="${className}" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${MARK_PATHS}</svg>`;
}

/** Mark, wordmark and tagline. The wordmark is live text so it stays crisp and readable. */
export function logoLockup(variant: 'hud' | 'title' | 'loading' = 'hud'): string {
  return `<span class="logo logo-${variant}">${logoMark()}<span class="logo-text"><span class="logo-word">The Way</span><span class="logo-tag">A journey through Galilee</span></span></span>`;
}

/** A fine gold rule with a centered diamond, used between headings and reading text. */
export function ornamentRule(className = ''): string {
  return `<span class="ornament-rule${className ? ' ' + className : ''}" aria-hidden="true"><svg viewBox="0 0 120 12" preserveAspectRatio="xMidYMid meet" focusable="false"><path d="M2 6h46M72 6h46" stroke="currentColor" stroke-width=".9" stroke-linecap="round"/><path d="m60 1.4 4.6 4.6-4.6 4.6-4.6-4.6Z" fill="none" stroke="currentColor" stroke-width="1"/><path d="m60 4 2 2-2 2-2-2Z" fill="currentColor"/><circle cx="51.2" cy="6" r=".9" fill="currentColor"/><circle cx="68.8" cy="6" r=".9" fill="currentColor"/></svg></span>`;
}
