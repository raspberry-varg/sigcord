import { type APIButtonComponent, ComponentType } from "discord.js";

export function isButtonData(obj: unknown): obj is APIButtonComponent {
  return (
    typeof obj === "object" &&
    (obj as { type: unknown }).type === ComponentType.Button
  );
}
