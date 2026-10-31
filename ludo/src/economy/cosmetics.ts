import { getTheme, type Theme } from '../themes';
import { shopItem } from './config';
import type { Eco } from './store';

/** UI theme + equipped token/dice/board styles merged into one Theme the whole app already understands. */
export function equippedTheme(eco: Eco): Theme {
  const base = getTheme(eco.equipped.ui.replace(/^u_/, ''));
  const token = shopItem(eco.equipped.token);
  const dice = shopItem(eco.equipped.dice)?.dice;
  const board = shopItem(eco.equipped.board)?.board;
  return {
    ...base,
    ...(board ?? {}),
    ...(dice && dice.face ? { diceFace: dice.face, dicePip: dice.pip } : {}),
    tokenShape: token?.shape ?? 'circle',
  };
}
