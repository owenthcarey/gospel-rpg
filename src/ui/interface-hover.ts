/** The corner text for a hovered interface control, in the classic manner. */
export function interfaceHover(target: Element): { verb: string; item?: string } | undefined {
  const slot = target.closest<HTMLElement>('.satchel-slot-button');
  if (slot) return { verb: 'Examine', item: slot.getAttribute('title') ?? '' };
  const control = target.closest<HTMLElement>(
    '.toolbar button,.minimap-compass,.run-orb,.minimap-open,.camera-command-buttons button,.control-hints [data-action]',
  );
  if (!control) return undefined;
  const action = control.dataset.action;
  const names: Record<string, string> = {
    journal: 'Journal',
    inventory: 'Satchel',
    emotes: 'Emotes',
    map: control.matches('.minimap-open') ? 'World Map' : 'Map',
    settings: 'Settings',
    'face-north': 'Look North',
    'run-toggle': 'Toggle Run',
    messages: 'Messages',
    help: 'Controls',
  };
  const verb = (action && names[action]) ?? control.getAttribute('aria-label');
  return verb ? { verb } : undefined;
}
