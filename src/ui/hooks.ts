import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { game } from "../game/store.ts";

/** Re-render whenever the controller changes; returns the live state and UI state. */
export function useGame() {
  useSyncExternalStore(game.subscribe, game.getVersion, game.getVersion);
  useTranslation(); // re-render on language change
  return { s: game.state, ui: game.ui };
}
