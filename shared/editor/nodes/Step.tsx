import type {
  NodeSpec,
  Node as ProsemirrorNode,
  NodeType,
} from "prosemirror-model";
import { wrappingInputRule } from "prosemirror-inputrules";
import toggleWrap from "../commands/toggleWrap";
import type { MarkdownSerializerState } from "../lib/markdown/serializer";
import Node from "./Node";

/**
 * Один шаг внутри `container_stepper`.
 * Может существовать только внутри Stepper'a (schema parent: container_stepper).
 *
 * Markdown:
 *   :::step
 *   Содержимое шага. Может содержать абзацы, списки, картинки и т.д.
 *   :::
 */
export default class Step extends Node {
  get name() {
    return "container_step";
  }

  get schema(): NodeSpec {
    return {
      content: "(paragraph | heading | list | blockquote | code_fence)+",
      defining: true,
      parseDOM: [
        {
          tag: "div.stepper-step",
          preserveWhitespace: "full",
        },
      ],
      toDOM: () => [
        "div",
        { class: "stepper-step" },
        ["div", { class: "stepper-step-marker", contenteditable: "false" }, ""],
        ["div", { class: "stepper-step-body" }, 0],
      ],
    };
  }

  commands({ type }: { type: NodeType }) {
    return () => toggleWrap(type);
  }

  inputRules({ type }: { type: NodeType }) {
    return [wrappingInputRule(/^:::step$/, type)];
  }

  toMarkdown(state: MarkdownSerializerState, node: ProsemirrorNode) {
    state.write("\n:::step\n");
    state.renderContent(node);
    state.ensureNewLine();
    state.write(":::");
    state.closeBlock(node);
  }

  parseMarkdown() {
    return {
      block: "container_step",
    };
  }
}
