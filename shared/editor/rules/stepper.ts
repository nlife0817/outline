import type MarkdownIt from "markdown-it";
import customFence from "markdown-it-container";

/**
 * Markdown-it rules for the stepper component.
 *
 * Расширяет синтаксис двумя контейнерами с маркером `:`:
 *   :::stepper
 *   :::step
 *   First step content.
 *   :::
 *   :::step
 *   Second step content.
 *   :::
 *   :::
 *
 * GitBook-эквивалент `{% stepper %}` преобразуется в этот синтаксис
 * preprocessor'ом из notices.ts (gitbook_compat rule).
 */
export default function stepper(md: MarkdownIt): void {
  customFence(md, "stepper", {
    marker: ":",
    validate: (params: string) => params.trim() === "stepper",
  });

  customFence(md, "step", {
    marker: ":",
    validate: (params: string) => params.trim() === "step",
  });
}
