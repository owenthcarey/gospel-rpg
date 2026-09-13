export const ACCOUNTS = ['lake', 'roof', 'nain', 'storm'] as const;
export type AccountId = (typeof ACCOUNTS)[number];
export const HOME_VISITS = ['farm', 'table', 'shore'] as const;
export type HomeVisit = (typeof HOME_VISITS)[number];
export const HOME_CHOICES = {
  farm: ['room', 'company'],
  table: ['listening', 'sharing'],
  shore: ['attention', 'beginning'],
} as const;
export const HOME_REFLECTIONS = ['onward', 'remain'] as const;
export interface ConnectionState {
  route: { target: string } | null;
  replay: { account: AccountId; checkpoint: string } | null;
  home: {
    visits: Partial<Record<HomeVisit, string>>;
    reflection: (typeof HOME_REFLECTIONS)[number] | null;
  };
}
export type ConnectionEvent =
  | { type: 'route-select'; target: string }
  | { type: 'route-cancel' }
  | { type: 'route-arrive'; target: string }
  | { type: 'replay-open'; account: AccountId; checkpoint: string }
  | { type: 'replay-next' | 'replay-previous'; account: AccountId; checkpoint: string }
  | { type: 'replay-close' }
  | { type: 'home-remember'; visit: HomeVisit; choice: string }
  | { type: 'home-reflect'; choice: (typeof HOME_REFLECTIONS)[number] };
export function newConnection(): ConnectionState {
  return { route: null, replay: null, home: { visits: {}, reflection: null } };
}
