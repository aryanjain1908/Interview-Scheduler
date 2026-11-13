import type { Action } from "./types";

/** The API computes whether and when an action opens, so the UI doesn't re-implement the rules. */
export function actionState(action: Action, now: number): { enabled: boolean; hint: string | null; upcoming: boolean } {
  if (action.allowed) return { enabled: true, hint: null, upcoming: false };
  if (action.available_at) {
    const opens = Date.parse(action.available_at);
    if (now >= opens) return { enabled: true, hint: null, upcoming: false };
    return { enabled: false, hint: action.reason, upcoming: true };
  }
  return { enabled: false, hint: action.reason, upcoming: false };
}
