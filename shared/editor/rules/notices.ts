import type MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";
import customFence from "markdown-it-container";

// --- GitBook compatibility layer ---
// Преобразуем GitBook-синтаксис в эквивалентный Outline-синтаксис
// на этапе normalize, до парсинга. Это позволяет импортировать страницы
// из GitBook без отдельного конвертера для наиболее частых конструкций.

const GITBOOK_HINT_STYLES: Record<string, string> = {
  info: "info",
  warning: "warning",
  success: "success",
  danger: "warning",
  tip: "tip",
};

function applyGitBookCompat(src: string): string {
  // 1. {% hint style="X" ... %}...{% endhint %} → :::X\n...\n:::
  //    Допускаем произвольные доп. атрибуты после style (icon="...", etc.)
  src = src.replace(
    /\{%\s*hint\s+style="(\w+)"[^%]*%\}([\s\S]*?)\{%\s*endhint\s*%\}/g,
    (_match, style: string, content: string) => {
      const noticeStyle = GITBOOK_HINT_STYLES[style.toLowerCase()] || "info";
      return `\n:::${noticeStyle}\n${content.trim()}\n:::\n`;
    }
  );

  // 2. <figure><img src="X" alt="Y"><figcaption>Z</figcaption></figure>
  //    → ![Y](X)\n*Z*  (если caption пустой — без курсива, иначе остаётся "**")
  src = src.replace(
    /<figure>\s*<img\s+([^>]*)\/?>\s*<figcaption>([\s\S]*?)<\/figcaption>\s*<\/figure>/g,
    (_match, imgAttrs: string, caption: string) => {
      const srcMatch = imgAttrs.match(/src="([^"]+)"/);
      const altMatch = imgAttrs.match(/alt="([^"]*)"/);
      const imgSrc = srcMatch ? srcMatch[1] : "";
      const imgAlt = altMatch ? altMatch[1] : "";
      const captionText = caption.trim();
      const captionLine = captionText ? `\n*${captionText}*` : "";
      return `\n![${imgAlt}](${imgSrc})${captionLine}\n`;
    }
  );

  // 2b. <div>...</div> вокруг figure'ов — снимаем div, оставляем содержимое.
  //     В GitBook так оформляют галереи (несколько figure подряд).
  src = src.replace(/<div>([\s\S]*?)<\/div>/g, (_m, inner: string) => `\n${inner}\n`);

  // 3. <mark style="...">text</mark> → ==text==
  src = src.replace(
    /<mark\s+style="[^"]*">([\s\S]*?)<\/mark>/g,
    (_match, content: string) => `==${content}==`
  );

  // 4. {% stepper %}{% step %}...{% endstep %}{% endstepper %}
  //    → :::::stepper / ::::step / ::::: / ::::
  //    Внутри step могут быть hint'ы (3 двоеточия), поэтому step использует
  //    4 двоеточия, stepper — 5. markdown-it-container закрывает только при
  //    маркере >= открывающего, поэтому вложенность не схлопывается.
  src = src.replace(
    /\{%\s*stepper\s*%\}([\s\S]*?)\{%\s*endstepper\s*%\}/g,
    (_match, content: string) => {
      const inner = content.replace(
        /\{%\s*step\s*%\}([\s\S]*?)\{%\s*endstep\s*%\}/g,
        (__: string, stepBody: string) =>
          `\n::::step\n${stepBody.trim()}\n::::\n`
      );
      return `\n:::::stepper\n${inner.trim()}\n:::::\n`;
    }
  );

  // 5. {% content-ref url="X.md" %}[label](X.md){% endcontent-ref %}
  //    → [label](X)  — без .md, чтобы Outline резолвил slug.
  src = src.replace(
    /\{%\s*content-ref\s+url="([^"]+)"[^%]*%\}([\s\S]*?)\{%\s*endcontent-ref\s*%\}/g,
    (_match, url: string, inner: string) => {
      const linkMatch = inner.match(/\[([^\]]+)\]\([^)]+\)/);
      const cleanUrl = url.replace(/\.md$/, "").replace(/\.md#/, "#");
      const label = linkMatch
        ? linkMatch[1].replace(/\.md$/, "")
        : url
            .split("/")
            .pop()!
            .replace(/\.md$/, "")
            .replace(/-/g, " ");
      return `\n[${label}](${cleanUrl})\n`;
    }
  );

  // 6. {% updates %}...{% endupdates %} и {% update date="..." %}...{% endupdate %}
  //    → выбрасываем обёртки, контент остаётся как обычный markdown.
  src = src.replace(/\{%\s*updates[^%]*%\}/g, "");
  src = src.replace(/\{%\s*endupdates\s*%\}/g, "");
  src = src.replace(/\{%\s*update\s[^%]*%\}/g, "\n---\n");
  src = src.replace(/\{%\s*endupdate\s*%\}/g, "");

  // 7. Анкоры заголовков GitBook'а: <a href="#x" id="x"></a> → удалить.
  src = src.replace(/<a\s+href="#[^"]*"\s+id="[^"]*"\s*><\/a>/g, "");

  // 8. <sup>X</sup> / <sub>X</sub> → плейн-текст (Outline их не понимает).
  src = src.replace(/<\/?sup>/g, "");
  src = src.replace(/<\/?sub>/g, "");

  return src;
}

export default function notice(md: MarkdownIt): void {
  md.core.ruler.before("normalize", "gitbook_compat", (state) => {
    state.src = applyGitBookCompat(state.src);
    return false;
  });

  const NOTICE_STYLES = new Set(["info", "warning", "success", "tip"]);

  return customFence(md, "notice", {
    marker: ":",
    validate: (params: string) => NOTICE_STYLES.has(params.trim()),
    render(tokens: Token[], idx: number) {
      const { info } = tokens[idx];

      if (tokens[idx].nesting === 1) {
        return `<div class="notice notice-${md.utils.escapeHtml(info)}">\n`;
      } else {
        return "</div>\n";
      }
    },
  });
}
