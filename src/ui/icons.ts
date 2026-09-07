const paths: Record<string, string> = {
  journal:
    '<path d="M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-3H4zM13 7a3 3 0 0 1 3-3h4v14h-4a3 3 0 0 0-3 3M7 8h3M7 11h3M16 8h2M16 11h2"/>',
  bag: '<path d="M6 8h12l2 13H4zM9 8V5a3 3 0 0 1 6 0v3M8 12h8M10 12v3h4v-3"/>',
  map: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16M15 5v16"/>',
  settings:
    '<path d="m9 3-1 3-3 1 1 3-2 2 2 2-1 3 3 1 1 3h5l1-3 3-1-1-3 2-2-2-2 1-3-3-1-1-3z"/><circle cx="11.5" cy="12" r="3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  check: '<path d="m5 12 4 4 10-10"/>',
  leaf: '<path d="M19 3C7 2 2 8 5 16c8 5 15-2 14-13ZM4 21 16 7M8 15l-1-5M11 12h5"/>',
  person:
    '<circle cx="12" cy="6" r="3"/><path d="M9 11h6l3 9H6zM8 12l-3 5M16 12l3 5M10 20v2M14 20v2"/>',
  pin: '<path d="M19 9c0 5-7 12-7 12S5 14 5 9a7 7 0 1 1 14 0Z"/><circle cx="12" cy="9" r="2"/>',
  net: '<path d="M3 3v18M21 3v18M3 5h18M5 5v13h14V5M5 9h14M5 13h14M9 5v13M14 5v13"/>',
  bread: '<path d="M3 14c0-6 4-9 9-9s9 3 9 9v4H3zM8 7l2 5M13 6l2 5M17 8l2 4"/>',
  sound: '<path d="m4 9 4 0 5-5v16l-5-5H4zM17 8a6 6 0 0 1 0 8M20 5a10 10 0 0 1 0 14"/>',
  mute: '<path d="m4 9 4 0 5-5v16l-5-5H4zM17 9l5 6M17 15l5-6"/>',
  save: '<path d="M4 3h13l3 3v15H4zM8 3v6h8V3M8 21v-8h8v8"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15 8-2 6-5 2 2-6z"/>',
  mouse: '<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 2v7M6 9h12"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 8a3 3 0 0 1 6 1c0 2-3 2-3 5M12 17v.1"/>',
};
export const icon = (name: string, className = ''): string =>
  `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.leaf}</svg>`;
export const escapeHtml = (text: string): string =>
  text.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );
