import type MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";
import customFence from "markdown-it-container";

// --- GitBook compatibility layer ---
// Преобразуем GitBook-синтаксис в эквивалентный Outline-синтаксис
// на этапе normalize, до парсинга. Это позволяет импортировать страницы
// из GitBook без отдельного конвертера для наиболее частых конструкций.

// Маппинг стилей GitBook → Outline notice-типы
const GITBOOK_HINT_STYLES: Record<string, string> = {
  info: "info",
  warning: "warning",
  success: "success",
  danger: "warning", // в Outline нет "danger", ближайший — warning
  tip: "tip",
};

function applyGitBookCompat(src: string): string {
  // 1. {% hint style="X" %}...{% endhint %} → :::X\n...\n:::
  src = src.replace(
    /\{%\s*hint\s+style="(\w+)"\s*%\}([\s\S]*?)\{%\s*endhint\s*%\}/g,
    (_match, style: string, content: string) => {
      const noticeStyle = GITBOOK_HINT_STYLES[style.toLowerCase()] || "info";
      return `\n:::${noticeStyle}\n${content.trim()}\n:::\n`;
    }
  );

  // 2. <figure><img src="X" alt="Y"><figcaption>Z</figcaption></figure>
  //    → ![Y](X)\n*Z*
  src = src.replace(
    /<figure>\s*<img\s+([^>]*)\/?>\s*<figcaption>([\s\S]*?)<\/figcaption>\s*<\/figure>/g,
    (_match, imgAttrs: string, caption: string) => {
      const srcMatch = imgAttrs.match(/src="([^"]+)"/);
      const altMatch = imgAttrs.match(/alt="([^"]*)"/);
      const imgSrc = srcMatch ? srcMatch[1] : "";
      const imgAlt = altMatch ? altMatch[1] : "";
      return `\n![${imgAlt}](${imgSrc})\n*${caption.trim()}*\n`;
    }
  );

  // 3. <mark style="background-color:..."">text</mark> → ==text==
  //    (Outline поддерживает один цвет подсветки — теряем разнообразие цветов)
  src = src.replace(
    /<mark\s+style="[^"]*">([\s\S]*?)<\/mark>/g,
    (_match, content: string) => `==${content}==`
  );

  // 4. {% content-ref url="X" %}[label](X){% endcontent-ref %} → [label](X)
  //    Outline сам построит unfurl-карточку для внутренних ссылок.
  //    Если содержимое блока пустое — берём имя файла из url.
  src = src.replace(
    /\{%\s*content-ref\s+url="([^"]+)"[^%]*%\}([\s\S]*?)\{%\s*endcontent-ref\s*%\}/g,
    (_match, url: string, inner: string) => {
      const linkMatch = inner.match(/\[([^\]]+)\]\([^)]+\)/);
      const label = linkMatch
        ? linkMatch[1]
        : url
            .split("/")
            .pop()!
            .replace(/\.md$/, "")
            .replace(/-/g, " ");
      const cleanUrl = url.replace(/\.md$/, "");
      return `\n[${label}](${cleanUrl})\n`;
    }
  );

  return src;
}

export default function notice(md: MarkdownIt): void {
  // Регистрируем core-rule, преобразующее GitBook-синтаксис на этапе normalize
  md.core.ruler.before("normalize", "gitbook_compat", (state) => {
    state.src = applyGitBookCompat(state.src);
    return false;
  });

  return customFence(md, "notice", {
    marker: ":",
    validate: () => true,
    render(tokens: Token[], idx: number) {
      const { info } = tokens[idx];

      if (tokens[idx].nesting === 1) {
        // opening tag
        return `<div class="notice notice-${md.utils.escapeHtml(info)}">\n`;
      } else {
        // closing tag
        return "</div>\n";
      }
    },
  });
}
