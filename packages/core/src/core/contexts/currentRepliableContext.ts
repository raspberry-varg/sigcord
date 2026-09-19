import type { RepliableInteraction } from "discord.js";

import { createInternalContext } from "./createInternalContext.js";

export const CurrentRepliableContext =
  createInternalContext<RepliableInteraction>("CurrentRepliableContext");
