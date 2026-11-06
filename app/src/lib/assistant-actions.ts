import { GameState } from './types';
import { isSeasonOver } from './constants';

/**
 * The suggestions the assistant is allowed to make.
 *
 * Every entry is a screen the chat can actually take the player to, which is
 * the point of keeping the list here rather than in the component: the mock
 * picks from it, the live model is told to pick from it and is filtered back
 * against it, and the chips the player sees are rendered from the same rows.
 * An action nobody implemented cannot be suggested by accident.
 *
 * `context.availableActions` on the save is deliberately not the source. It
 * is a fixed list written at team creation and replaced, at the end of a
 * season, with `['view_final_standings', 'new_season']` — and `new_season` is
 * a feature that does not exist, which is how it ended up on screen as a raw
 * key. That field still drives the match screen, so it is left as it is; what
 * the assistant offers is derived from the save instead.
 */

/** Views the chat can switch to; a subset of the app's ViewType. */
export type AssistantDestination =
  | 'squad'
  | 'match'
  | 'transfers'
  | 'standings'
  | 'stadium'
  | 'facilities'
  | 'youth'
  | 'staff';

export interface AssistantAction {
  key: string;
  /** Shown on the chip, in the game's language. */
  label: string;
  destination: AssistantDestination;
}

const CATALOGUE: Record<string, AssistantAction> = {
  play_match: { key: 'play_match', label: 'Jogar a partida', destination: 'match' },
  view_squad: { key: 'view_squad', label: 'Ver elenco', destination: 'squad' },
  train: { key: 'train', label: 'Treinar', destination: 'squad' },
  transfer_market: { key: 'transfer_market', label: 'Mercado', destination: 'transfers' },
  view_standings: { key: 'view_standings', label: 'Ver tabela', destination: 'standings' },
  view_final_standings: {
    key: 'view_final_standings',
    label: 'Classificação final',
    destination: 'standings',
  },
  view_stadium: { key: 'view_stadium', label: 'Estádio', destination: 'stadium' },
  view_facilities: { key: 'view_facilities', label: 'Instalações', destination: 'facilities' },
  view_youth: { key: 'view_youth', label: 'Academia', destination: 'youth' },
  view_staff: { key: 'view_staff', label: 'Staff', destination: 'staff' },
};

/** What each intent leads to, most relevant first. */
const BY_INTENT: Record<string, string[]> = {
  greeting: ['play_match', 'view_squad', 'view_standings'],
  general_chat: ['play_match', 'view_squad', 'view_standings'],
  play_match: ['play_match', 'view_squad', 'train'],
  tactics: ['play_match', 'view_squad', 'train'],
  playing_style_aggressive: ['play_match', 'view_squad', 'train'],
  playing_style_defensive: ['play_match', 'view_squad', 'train'],
  playing_style_balanced: ['play_match', 'view_squad', 'train'],
  next_opponent: ['play_match', 'view_standings', 'view_squad'],
  view_squad: ['view_squad', 'train', 'transfer_market'],
  training: ['train', 'view_squad', 'view_facilities'],
  transfer_market: ['transfer_market', 'view_squad', 'view_youth'],
  spending_conservative: ['view_youth', 'transfer_market', 'view_facilities'],
  spending_aggressive: ['transfer_market', 'view_staff', 'view_stadium'],
  standings: ['view_standings', 'play_match', 'view_squad'],
  match_result: ['view_standings', 'view_squad', 'train'],
  season_over: ['view_final_standings', 'view_squad', 'transfer_market', 'view_youth'],
};

const MAX_SUGGESTIONS = 4;

/** Whether this save can act on an action right now. */
function isAvailable(key: string, gameState: GameState): boolean {
  const seasonOver = isSeasonOver(gameState.season);
  switch (key) {
    // There is no fixture left to play, and the match route refuses one.
    case 'play_match':
      return !seasonOver;
    // The two tables are the same screen, but only one of them is the truth
    // at a given moment.
    case 'view_standings':
      return !seasonOver;
    case 'view_final_standings':
      return seasonOver;
    case 'train':
      return gameState.squad.players.length > 0;
    default:
      return key in CATALOGUE;
  }
}

/** The action this key names, if it is one the chat can offer. */
export function lookupAction(key: string): AssistantAction | undefined {
  return CATALOGUE[key];
}

/**
 * What to suggest after a reply with this intent, for this save. Never empty:
 * a save with nothing else going on can always look at its own squad.
 */
export function suggestActions(gameState: GameState, intent: string): string[] {
  const wanted = BY_INTENT[intent] ?? BY_INTENT.general_chat;
  const seasonOver = isSeasonOver(gameState.season);
  const tail = seasonOver
    ? BY_INTENT.season_over
    : ['play_match', 'view_squad', 'view_standings', 'transfer_market'];

  // The table is the same screen either way, so asking about it at the end
  // of a season leads to the final table rather than falling through to
  // whatever is next in the list.
  const resolved = seasonOver
    ? wanted.map((key) => (key === 'view_standings' ? 'view_final_standings' : key))
    : wanted;

  const picked: string[] = [];
  for (const key of [...resolved, ...tail]) {
    if (picked.length >= MAX_SUGGESTIONS) break;
    if (picked.includes(key)) continue;
    if (!isAvailable(key, gameState)) continue;
    picked.push(key);
  }
  return picked.length > 0 ? picked : ['view_squad'];
}

/**
 * Keeps only the suggestions a reply is allowed to carry. The live model
 * answers with action keys of its own choosing, and an invented or stale one
 * would reach the player as a chip that goes nowhere.
 */
export function filterSuggestions(
  gameState: GameState,
  intent: string,
  actions: unknown
): string[] {
  const keys = Array.isArray(actions) ? actions.filter((a): a is string => typeof a === 'string') : [];
  const kept = keys
    .filter((key, index) => keys.indexOf(key) === index)
    .filter((key) => key in CATALOGUE && isAvailable(key, gameState))
    .slice(0, MAX_SUGGESTIONS);
  return kept.length > 0 ? kept : suggestActions(gameState, intent);
}

/** The list the live model is told it may choose from. */
export function allowedActionsFor(gameState: GameState): AssistantAction[] {
  return Object.values(CATALOGUE).filter((action) => isAvailable(action.key, gameState));
}
