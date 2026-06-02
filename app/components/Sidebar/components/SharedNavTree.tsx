import { observer } from "mobx-react";
import * as React from "react";
import { NavLink as RouterNavLink } from "react-router-dom";
import styled, { css } from "styled-components";
import { s } from "@shared/styles";
import type { NavigationNode } from "@shared/types";
import type Document from "~/models/Document";
import useStores from "~/hooks/useStores";
import { sharedModelPath } from "~/utils/routeHelpers";
import { useSidebarExpansion } from "./SidebarExpansionContext";

/**
 * Public/shared documentation tree — visual replica of
 * `sidebar-preview.html` (GitBook-style).
 *
 * Markup mirrors the preview exactly:
 *   ul.nav > li > .row + ul.children (recursive)
 * Active document gets a 2px accent bar in the parent guide column;
 * the children list animates open/closed via `scrollHeight` → 0 height
 * transitions matching the preview's JS (no `grid-template-rows` trick).
 *
 * Back-end logic untouched: expansion state via `SidebarExpansionContext`,
 * navigation via React Router, prefetching via the documents store.
 */

type Props = {
  rootNode: NavigationNode;
  shareId: string;
  hideRootNode: boolean;
  activeDocumentId?: string;
  activeDocument?: Document;
};

function SharedNavTree({
  rootNode,
  shareId,
  hideRootNode,
  activeDocumentId,
  activeDocument,
}: Props) {
  // If the root collection is hidden, render its direct children as the
  // top-level items (this matches how the existing sidebar behaves).
  const topLevel = hideRootNode ? rootNode.children : [rootNode];

  return (
    <Nav role="tree">
      {topLevel.map((node) => (
        <NavItem
          key={node.id}
          node={node}
          depth={0}
          shareId={shareId}
          activeDocumentId={activeDocumentId}
          activeDocument={activeDocument}
        />
      ))}
    </Nav>
  );
}

type ItemProps = {
  node: NavigationNode;
  depth: number;
  shareId: string;
  activeDocumentId?: string;
  activeDocument?: Document;
};

function NavItemImpl({
  node,
  depth,
  shareId,
  activeDocumentId,
  activeDocument,
}: ItemProps) {
  const { documents } = useStores();
  const expansion = useSidebarExpansion();

  const hasChildren =
    node.children.length > 0 ||
    activeDocument?.parentDocumentId === node.id;
  const expanded = expansion.isExpanded(node.id);
  const isActive = activeDocumentId === node.id;

  // Children appear in the live tree once they include a draft of the doc
  // being edited, matching the existing sidebar behaviour.
  const children = React.useMemo(() => {
    if (
      activeDocument?.isDraft &&
      activeDocument?.isActive &&
      activeDocument?.parentDocumentId === node.id &&
      activeDocument?.asNavigationNode
    ) {
      return [activeDocument.asNavigationNode, ...node.children];
    }
    return node.children;
  }, [
    activeDocument?.isDraft,
    activeDocument?.isActive,
    activeDocument?.parentDocumentId,
    activeDocument?.asNavigationNode,
    node.children,
  ]);

  // Lazy-mount: only render the children subtree once the user has
  // expanded the branch at least once. Keeps deep trees cheap on first
  // paint but still lets us animate the *collapse* direction.
  const [hasMounted, setHasMounted] = React.useState<boolean>(expanded);
  React.useEffect(() => {
    if (expanded && !hasMounted) {
      setHasMounted(true);
    }
  }, [expanded, hasMounted]);

  const ulRef = React.useRef<HTMLUListElement | null>(null);
  const isFirstHeightEffect = React.useRef(true);

  // Animate the children list height between 0 and its natural size.
  // Mirrors the preview HTML's `expand` / `collapse` functions: pin height
  // to a px value, force reflow, transition to the target, then snap to
  // `auto` once the transition settles so descendant accordions still work.
  React.useLayoutEffect(() => {
    const ul = ulRef.current;
    if (!ul) {
      return;
    }
    if (isFirstHeightEffect.current) {
      // Initial mount — set the final height immediately without animating.
      ul.style.height = expanded ? "auto" : "0px";
      isFirstHeightEffect.current = false;
      return;
    }

    if (expanded) {
      // Open: 0 → scrollHeight → auto.
      const target = ul.scrollHeight;
      ul.style.height = "0px";
      // Force reflow so the browser registers the start frame.
      void ul.offsetHeight;
      ul.style.height = target + "px";
      const onEnd = (e: TransitionEvent) => {
        if (e.propertyName !== "height") {
          return;
        }
        ul.style.height = "auto";
        ul.removeEventListener("transitionend", onEnd);
      };
      ul.addEventListener("transitionend", onEnd);
      return () => ul.removeEventListener("transitionend", onEnd);
    } else {
      // Close: auto → current px → 0. Pin px first so the transition has a
      // start value (transitions don't interpolate from `auto`).
      const current = ul.scrollHeight;
      ul.style.height = current + "px";
      void ul.offsetHeight;
      ul.style.height = "0px";
    }
  }, [expanded, children.length]);

  const handleToggle = React.useCallback(
    (ev: React.MouseEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (expanded) {
        if (ev.altKey) {
          expansion.collapseDescendants(node);
        } else {
          expansion.collapse(node.id);
        }
      } else {
        if (ev.altKey) {
          expansion.expandDescendants(node);
        } else {
          expansion.expand(node.id);
        }
      }
    },
    [expanded, expansion, node]
  );

  const handlePrefetch = React.useCallback(() => {
    void documents.prefetchDocument?.(node.id);
  }, [documents, node.id]);

  const title = (isActive && activeDocument
    ? activeDocument.title
    : node.title) || "Untitled";

  return (
    <Li className={expanded ? "open" : undefined} $depth={depth}>
      <RowSlot>
        <Row
          to={{
            pathname: sharedModelPath(shareId, node.url),
            state: { title },
          }}
          $hasChev={hasChildren}
          $isGroup={depth === 0 && hasChildren}
          onMouseEnter={handlePrefetch}
        >
          <Label>{title}</Label>
        </Row>
        {hasChildren && (
          <Chev
            type="button"
            onClick={handleToggle}
            onMouseDown={(e) => e.stopPropagation()}
            aria-label={expanded ? "Collapse" : "Expand"}
            aria-expanded={expanded}
            tabIndex={-1}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              width={14}
              height={14}
              aria-hidden
            >
              <polyline points="9 6 15 12 9 18" />
            </svg>
          </Chev>
        )}
      </RowSlot>

      {hasChildren && hasMounted && (
        <Children ref={ulRef}>
          {children.map((child) => (
            <NavItem
              key={child.id}
              node={child}
              depth={depth + 1}
              shareId={shareId}
              activeDocumentId={activeDocumentId}
              activeDocument={activeDocument}
            />
          ))}
        </Children>
      )}
    </Li>
  );
}

const NavItem = observer(NavItemImpl);

/* ----- styled (matches sidebar-preview.html spec) ----- */

const Nav = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 14px;
  line-height: 1.4;
`;

const Li = styled.li<{ $depth: number }>`
  position: relative;
  margin: 0;
  padding: 0;
  list-style: none;
`;

const Children = styled.ul`
  list-style: none;
  margin: 0 0 0 14px;
  padding: 0 0 0 12px;
  /* Guide column — clean border-left, no absolute pseudos. */
  border-inline-start: 1px solid ${s("divider")};
  overflow: hidden;
  height: 0;
  transition: height 320ms cubic-bezier(0.65, 0, 0.35, 1);

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

/**
 * Wraps the NavLink + chevron button so the latter can be a sibling
 * (not a descendant) of the anchor — HTML disallows interactive elements
 * inside <a>. Chevron is positioned absolutely on the right; the anchor
 * fills the slot beneath it.
 */
const RowSlot = styled.div`
  position: relative;
`;

/**
 * The clickable row. Uses React Router's NavLink so SPA navigation works
 * and `aria-current="page"` is set automatically on the active route.
 */
const Row = styled(RouterNavLink)<{
  $hasChev: boolean;
  $isGroup: boolean;
}>`
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  /* Reserve trailing space for the chevron button so the label's ellipsis
     stops before the chevron column. */
  padding-inline-end: ${(props) => (props.$hasChev ? 32 : 10)}px;
  border-radius: 8px;
  color: ${s("text")};
  font-weight: ${(props) => (props.$isGroup ? 500 : 400)};
  text-decoration: none;
  user-select: none;
  cursor: var(--pointer);
  transition:
    background-color 180ms cubic-bezier(0.22, 1, 0.36, 1),
    color 180ms cubic-bezier(0.22, 1, 0.36, 1);

  &:hover {
    background: ${s("sidebarHoverBackground")};
    color: ${s("text")};
  }

  &:focus-visible {
    outline: 2px solid ${(props) => props.theme.accent};
    outline-offset: 1px;
  }

  /* Active state — accent color, semibold, no pill, vertical accent bar
     pinned into the parent guide column (left:-13px from the row, where
     the parent's <ul.children> has margin-left:14 + padding-left:12). */
  &.active,
  &[aria-current="page"] {
    color: ${(props) => props.theme.accent};
    font-weight: 600;
  }

  &.active:hover,
  &[aria-current="page"]:hover {
    background: ${(props) => props.theme.accent}14;
  }

  &[aria-current="page"]::before {
    content: "";
    position: absolute;
    left: -13px;
    top: 4px;
    bottom: 4px;
    width: 2px;
    border-radius: 2px;
    background: ${(props) => props.theme.accent};
    transform-origin: center;
    animation: sharedNavBarIn 280ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  @keyframes sharedNavBarIn {
    from { transform: scaleY(0.2); opacity: 0; }
    to   { transform: scaleY(1);   opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    &[aria-current="page"]::before { animation: none; }
  }

`;

const Label = styled.span`
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

/**
 * Chevron toggle. Positioned over the row's trailing padding so a click on
 * the chevron toggles expansion without triggering navigation.
 */
const Chev = styled.button`
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 22px;
  height: 22px;
  padding: 0;
  margin: 0;
  border: 0;
  background: transparent;
  color: ${s("textTertiary")};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  cursor: var(--pointer);
  transition:
    transform 280ms cubic-bezier(0.65, 0, 0.35, 1),
    color 180ms cubic-bezier(0.22, 1, 0.36, 1),
    background-color 120ms ease;

  &:hover {
    color: ${s("text")};
    background: ${s("sidebarControlHoverBackground")};
  }

  /* Rotate the right-pointing chevron when its <li> is open. */
  ${Li}.open > ${RowSlot} > & {
    transform: translateY(-50%) rotate(90deg);
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

export default observer(SharedNavTree);
