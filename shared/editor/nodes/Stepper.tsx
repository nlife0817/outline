import type {
  NodeSpec,
  Node as ProsemirrorNode,
  NodeType,
} from "prosemirror-model";
import { wrappingInputRule } from "prosemirror-inputrules";
import toggleWrap from "../commands/toggleWrap";
import type { MarkdownSerializerState } from "../lib/markdown/serializer";
import stepperRule from "../rules/stepper";
import Node from "./Node";

/**
 * Контейнер пошаговой инструкции (stepper).
 *
 * Содержит один или несколько `container_step`. Нумерация шагов выполняется
 * через CSS counter в `:before` (см. shared/styles/editor.ts или GlobalStyles).
 *
 * Markdown-синтаксис:
 *   ::::stepper
 *   :::step
 *   Сначала откройте панель настроек.
 *   :::
 *   :::step
 *   Затем выберите нужный пункт.
 *   :::
 *   ::::
 *
 * GitBook `{% stepper %}` преобразуется в этот синтаксис core-rule
 * `gitbook_compat` (см. rules/notices.ts).
 */
export default class Stepper extends Node {
  get name() {
    return "container_stepper";
  }

  get rulePlugins() {
    return [stepperRule];
  }

  get schema(): NodeSpec {
    return {
      content: "container_step+",
      group: "block",
      defining: true,
      draggable: true,
      parseDOM: [
        {
          tag: "div.stepper-block",
          preserveWhitespace: "full",
        },
      ],
      toDOM: () => [
        "div",
        { class: "stepper-block" },
        ["div", { class: "stepper-content" }, 0],
      ],
    };
  }

  commands({ type }: { type: NodeType }) {
    return () => toggleWrap(type);
  }

  inputRules({ type }: { type: NodeType }) {
    return [wrappingInputRule(/^::::stepper$/, type)];
  }

  toMarkdown(state: MarkdownSerializerState, node: ProsemirrorNode) {
    state.write("\n::::stepper\n");
    state.renderContent(node);
    state.ensureNewLine();
    state.write("::::");
    state.closeBlock(node);
  }

  parseMarkdown() {
    return {
      block: "container_stepper",
    };
  }
}
