import { createGlobalStyle } from "styled-components";
import styledNormalize from "styled-normalize";
import { breakpoints, depths, s } from ".";
import { EditorStyleHelper } from "../editor/styles/EditorStyleHelper";

type Props = {
  staticHTML?: boolean;
  useCursorPointer?: boolean;
};

export default createGlobalStyle<Props>`
  ${styledNormalize}

  * {
    box-sizing: border-box;
  }

  html {
    --line-height-body: 1.65;
    --font-size-body: 16px;
    scroll-behavior: smooth;
  }

  @media (prefers-reduced-motion: reduce) {
    html {
      scroll-behavior: auto;
    }
  }

  html,
  body {
    width: 100%;
    ${(props) => (props.staticHTML ? "" : "height: 100%;")}
    margin: 0;
    padding: 0;
    print-color-adjust: exact;
    --pointer: ${(props) => (props.useCursorPointer ? "pointer" : "default")};
    --scrollbar-width: calc(100vw - 100cqw);
    overscroll-behavior-x: none;

    @media print {
      background: none !important;
    }

    --line-height-p: var(--line-height-body);
    --line-height-h: 1.25;
  }

  body,
  button,
  input,
  optgroup,
  select,
  textarea {
    font-family: ${s("fontFamily")};
  }

  body {
    font-size: var(--font-size-body);
    line-height: var(--line-height-body);
    color: ${s("text")};
    overscroll-behavior-y: none;
    -moz-osx-font-smoothing: grayscale;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
    font-feature-settings: "ss03", "cv05", "cv11";

    ${(props) => (props.staticHTML ? "" : "width: 100vw;")}
    overflow-x: hidden;
    padding-right: calc(0 - var(--removed-body-scroll-bar-size)) !important;
  }

  @media (min-width: ${breakpoints.tablet}px) {
    html,
    body {
      min-height: ${(props) => (props.staticHTML ? "0" : "100vh")};
    }
  }

  @media (min-width: ${breakpoints.tablet}px) and (display-mode: standalone) {
    body:after {
      content: "";
      display: block;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: ${(props) => props.theme.titleBarDivider};
      z-index: ${depths.titleBarDivider};
    }
  }

  a {
    color: ${(props) => props.theme.link};
    text-decoration: none;
    cursor: pointer;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    font-weight: 700;
    line-height: var(--line-height-h);
    letter-spacing: -0.012em;
    margin-bottom: 0.5em;
  }
  h1 {
    font-size: 36px;
    letter-spacing: -0.022em;
    line-height: 1.15;
    margin-top: 1.2em;
  }
  h2 {
    font-size: 26px;
    letter-spacing: -0.018em;
    line-height: 1.2;
    margin-top: 1.5em;
  }
  h3 {
    font-size: 20px;
    letter-spacing: -0.012em;
    margin-top: 1.4em;
  }
  h4 {
    font-size: 17px;
    margin-top: 1.2em;
  }
  h5 {
    font-size: 15px;
    font-weight: 600;
    margin-top: 1em;
  }
  h6 {
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: ${s("textSecondary")};
    margin-top: 1em;
  }

  p,
  dl,
  ol,
  ul,
  pre,
  blockquote {
    margin-top: 1em;
    margin-bottom: 1em;
  }

  hr {
    border: 0;
    height: 0;
    border-top: 1px solid ${s("divider")};
  }

  /* GitBook-style thin scrollbars. Sidebar scrollbar is fully transparent
     until the sidebar block is hovered/focused. */
  #sidebar * {
    scrollbar-width: thin;
    scrollbar-color: transparent transparent;
    transition: scrollbar-color 200ms ease-out;
  }
  #sidebar:hover *,
  #sidebar:focus-within * {
    scrollbar-color: ${(props) =>
      props.theme.isDark
        ? "rgba(255,255,255,0.18) transparent"
        : "rgba(0,0,0,0.22) transparent"};
  }
  #sidebar *::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  #sidebar *::-webkit-scrollbar-track {
    background: transparent;
  }
  #sidebar *::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 6px;
    transition: background 200ms ease-out;
  }
  #sidebar:hover *::-webkit-scrollbar-thumb,
  #sidebar:focus-within *::-webkit-scrollbar-thumb {
    background: ${(props) =>
      props.theme.isDark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.20)"};
  }
  #sidebar *::-webkit-scrollbar-thumb:hover {
    background: ${(props) =>
      props.theme.isDark ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.34)"};
  }

  [data-toc-list],
  .scrollable {
    scrollbar-width: thin;
    scrollbar-color: ${(props) =>
      props.theme.isDark
        ? "rgba(255,255,255,0.12) transparent"
        : "rgba(0,0,0,0.18) transparent"};
  }
  [data-toc-list]::-webkit-scrollbar,
  .scrollable::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  [data-toc-list]::-webkit-scrollbar-thumb,
  .scrollable::-webkit-scrollbar-thumb {
    background: ${(props) =>
      props.theme.isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.18)"};
    border-radius: 6px;
  }

  :focus-visible {
    outline-color: ${s("accent")};
    outline-offset: -1px;
    outline-width: initial;
  }

  :root {
    --sat: env(safe-area-inset-top);
    --sar: env(safe-area-inset-right);
    --sab: env(safe-area-inset-bottom);
    --sal: env(safe-area-inset-left);
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }

  /* Mermaid.js injects these into the root of the page. It's very annoying, but we have to deal with it or they affect layout */
  [id^="doffscreen-mermaid"] {
      position: absolute !important;
      left: -9999px !important;
      top: -9999px !important;
  }

  /* Table row/column drag and drop cursor */
  &.${EditorStyleHelper.tableDragging},
  &.${EditorStyleHelper.tableDragging} *,
  &.${EditorStyleHelper.tableDragging} *::before,
  &.${EditorStyleHelper.tableDragging} *::after {
    cursor: grabbing !important;
  }
`;
