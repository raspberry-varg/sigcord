import type { Context } from "../lib/contexts/context.js";
import { useContext } from "../lib/contexts/useContext.js";
import type { Cord } from "./cord.js";

export const CordContext: Context<Cord | undefined> = {
  id: Symbol.for("__sigcord.CordContext"),
  default: undefined,
};

export function useCordInternal(): Cord | undefined {
  return useContext(CordContext);
}

export function useCordInternalOrThrow(): Cord {
  const cord = useCordInternal();
  if (!cord) {
    throw new Error(
      "Attempted to use a hook outside of a reactive context. Was this called " +
        "outside of a reactive view?",
    );
  }
  return cord;
}
