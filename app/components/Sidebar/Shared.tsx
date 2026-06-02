import { useKBar } from "kbar";
import { observer } from "mobx-react";
import { CollapsedIcon, ExpandedIcon, SearchIcon } from "outline-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import styled, { css } from "styled-components";
import { s } from "@shared/styles";
import { ProsemirrorHelper } from "@shared/utils/ProsemirrorHelper";
import { metaDisplay, shortcutSeparator } from "@shared/utils/keyboard";
import type Share from "~/models/Share";
import Flex from "~/components/Flex";
import Scrollable from "~/components/Scrollable";
import useCurrentUser from "~/hooks/useCurrentUser";
import useShareBranding from "~/hooks/useShareBranding";
import useStores from "~/hooks/useStores";
import history from "~/utils/history";
import { homePath, sharedModelPath } from "~/utils/routeHelpers";
import { AvatarSize } from "../Avatar";
import TeamLogo from "../TeamLogo";
import Sidebar from "./Sidebar";
import SidebarExpansionContext, {
  useSidebarExpansionState,
} from "./components/SidebarExpansionContext";
import SharedNavTree from "./components/SharedNavTree";
import SidebarButton from "./components/SidebarButton";

interface Props {
  share: Share;
}

/** Scroll distance (px) past which the "back to top" button appears. */
const BACK_TO_TOP_THRESHOLD = 240;

/**
 * Public/shared documentation sidebar.
 *
 * Renders branding, a sticky search box with Cmd+K shortcut, a tree
 * expansion toggle, the document navigation tree, and a floating
 * "back to top" affordance when scrolled.
 */
function SharedSidebar({ share }: Props) {
  const user = useCurrentUser({ rejectOnEmpty: false });
  const { ui, documents, collections } = useStores();
  const { t } = useTranslation();
  const { query } = useKBar();

  const { displayName, displayLogoUrl, displayLogoModel, brandingAvailable } =
    useShareBranding(share);
  const rootNode = share.tree;
  const shareId = share.urlId || share.id;
  const collection = collections.get(rootNode?.id);
  const hideRootNode = collection
    ? ProsemirrorHelper.isEmptyData(collection?.data)
    : false;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const handleOpenSearch = useCallback(() => {
    query.toggle();
  }, [query]);

  const rootChildren = useMemo(
    () => (rootNode ? [rootNode] : undefined),
    [rootNode]
  );
  const expansion = useSidebarExpansionState(
    rootChildren,
    ui.activeDocumentId,
    shareId
  );

  // Walk every node ID in the visible tree so the toggle can decide whether to
  // expand or collapse the whole forest in one click.
  const allTreeIds = useMemo<string[]>(() => {
    if (!rootChildren) {
      return [];
    }
    const ids: string[] = [];
    const walk = (n: typeof rootChildren) => {
      for (const node of n) {
        if (node.children.length) {
          ids.push(node.id);
          walk(node.children);
        }
      }
    };
    walk(rootChildren);
    return ids;
  }, [rootChildren]);

  const allExpanded =
    allTreeIds.length > 0 &&
    allTreeIds.every((id) => expansion.isExpanded(id));

  const handleToggleAll = useCallback(() => {
    if (!rootChildren) {
      return;
    }
    if (allExpanded) {
      expansion.collapseAll();
    } else {
      expansion.expandAll(rootChildren);
    }
  }, [allExpanded, expansion, rootChildren]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    setIsScrolled(el.scrollTop > 2);
    setShowBackToTop(el.scrollTop > BACK_TO_TOP_THRESHOLD);
  }, []);

  const handleBackToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    // For public shares, force the table of contents to always be visible
    // when the share owner enabled it (`share.showTOC`). The toggle button
    // in SharedHeader is hidden on desktop, so users can't turn it off.
    ui.tocVisible = !!share.showTOC;
  }, [share.showTOC]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    el.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // Cmd+K / Ctrl+K opens search globally for guests as well.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        query.toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [query]);

  if (!rootNode?.children.length) {
    return null;
  }

  return (
    <Sidebar canCollapse={false}>
      {brandingAvailable && (
        <SidebarButton
          title={displayName}
          image={
            <TeamLogo
              model={displayLogoModel}
              src={displayLogoUrl ?? undefined}
              size={AvatarSize.XLarge}
              alt={t("Logo")}
            />
          }
          disabled={hideRootNode}
          onClick={
            hideRootNode
              ? undefined
              : () => history.push(user ? homePath() : sharedModelPath(shareId))
          }
        />
      )}
      <StickyHeader $scrolled={isScrolled}>
        <SearchButton
          type="button"
          onClick={handleOpenSearch}
          aria-label={t("Поиск по документации")}
        >
          <SearchIcon size={18} />
          <SearchLabel>{t("Search")}</SearchLabel>
          <Shortcut aria-hidden>
            {metaDisplay}
            {shortcutSeparator}K
          </Shortcut>
        </SearchButton>
        {allTreeIds.length > 0 && (
          <TreeToolbar>
            <ToggleAllButton
              type="button"
              onClick={handleToggleAll}
              aria-label={
                allExpanded ? t("Свернуть всё") : t("Развернуть всё")
              }
              title={allExpanded ? t("Свернуть всё") : t("Развернуть всё")}
            >
              {allExpanded ? (
                <ExpandedIcon size={16} />
              ) : (
                <CollapsedIcon size={16} />
              )}
              <ToggleAllLabel>
                {allExpanded ? t("Свернуть всё") : t("Развернуть всё")}
              </ToggleAllLabel>
            </ToggleAllButton>
          </TreeToolbar>
        )}
      </StickyHeader>
      <ScrollContainer ref={scrollRef} flex>
        <NavSection role="navigation" aria-label={t("Документы")}>
          <SidebarExpansionContext.Provider value={expansion}>
            <SharedNavTree
              rootNode={rootNode}
              shareId={shareId}
              hideRootNode={hideRootNode}
              activeDocumentId={ui.activeDocumentId}
              activeDocument={documents.active}
            />
          </SidebarExpansionContext.Provider>
        </NavSection>
        {showBackToTop && (
          <BackToTop
            type="button"
            onClick={handleBackToTop}
            aria-label={t("Назад наверх")}
            title={t("Назад наверх")}
          >
            <ExpandedIcon size={16} style={{ transform: "rotate(180deg)" }} />
            <span>{t("Назад наверх")}</span>
          </BackToTop>
        )}
      </ScrollContainer>
    </Sidebar>
  );
}

const StickyHeader = styled.div<{ $scrolled: boolean }>`
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 8px 8px 6px;
  background: ${s("sidebarBackground")};
  transition:
    border-color 150ms ease,
    box-shadow 150ms ease;
  border-bottom: 1px solid transparent;

  ${(props) =>
    props.$scrolled &&
    css`
      border-bottom-color: ${s("divider")};
      box-shadow: 0 4px 8px -6px rgba(0, 0, 0, 0.12);
    `}
`;

/**
 * Wrapper for the tree, matching `.nav-wrap` in `sidebar-preview.html`:
 * 14px vertical / 10px horizontal padding around the `<ul.nav>`.
 * Plain styled <div>, not the workspace `Section` (which adds its own
 * margins + min-width that would fight the preview spec).
 */
const NavSection = styled.div`
  position: relative;
  padding: 14px 10px;
`;

const ScrollContainer = styled(Scrollable)`
  position: relative;
  padding-bottom: 24px;

  /* GitBook-style hover-only scrollbar: thumb is invisible by default and
     fades in only when the user is hovering the sidebar. Gutter is reserved
     so layout doesn't shift when the thumb appears. */
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;

  &::-webkit-scrollbar {
    width: 8px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 8px;
    transition: background-color 200ms ease;
  }

  #sidebar:hover & {
    scrollbar-color: ${s("divider")} transparent;
  }
  #sidebar:hover &::-webkit-scrollbar-thumb {
    background: ${s("divider")};
  }
  #sidebar:hover &::-webkit-scrollbar-thumb:hover {
    background: ${s("textTertiary")};
  }
`;

const SearchButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 12px;
  border: 1px solid ${s("inputBorder")};
  border-radius: 10px;
  background: ${s("background")};
  color: ${s("textTertiary")};
  cursor: var(--pointer);
  font-size: 14px;
  transition:
    border-color 120ms ease,
    color 120ms ease,
    box-shadow 120ms ease,
    background 120ms ease;

  &:hover {
    border-color: ${s("inputBorderFocused")};
    color: ${s("textSecondary")};
  }

  &:focus-visible {
    outline: none;
    border-color: ${(props) => props.theme.accent};
    box-shadow: 0 0 0 3px ${(props) => props.theme.accent}22;
    color: ${s("text")};
  }
`;

const SearchLabel = styled.span`
  flex-grow: 1;
  text-align: start;
`;

const Shortcut = styled.kbd`
  flex-shrink: 0;
  font-size: 11px;
  font-family: inherit;
  padding: 2px 6px;
  border-radius: 4px;
  color: ${s("textTertiary")};
  background: ${s("backgroundSecondary")};
  border: 1px solid ${s("inputBorder")};
  line-height: 1;
`;

const TreeToolbar = styled(Flex)`
  margin-top: 6px;
  padding: 0;
  justify-content: flex-start;
`;

const ToggleAllButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px 4px 0;
  margin-inline-start: -2px;
  border: none;
  background: transparent;
  color: ${s("textTertiary")};
  font-size: 12px;
  font-weight: 500;
  border-radius: 6px;
  cursor: var(--pointer);
  transition:
    color 100ms ease,
    background 100ms ease;

  &:hover {
    color: ${s("text")};
    background: ${s("sidebarControlHoverBackground")};
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px ${(props) => props.theme.accent}55;
  }
`;

const ToggleAllLabel = styled.span`
  white-space: nowrap;
`;

const BackToTop = styled.button`
  position: sticky;
  bottom: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 12px auto 0;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  color: ${s("text")};
  background: ${s("backgroundSecondary")};
  border: 1px solid ${s("divider")};
  border-radius: 999px;
  cursor: var(--pointer);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  z-index: 1;
  /* center the sticky button within the scroll container */
  left: 50%;
  transform: translateX(-50%);
  width: max-content;
  transition:
    transform 150ms ease,
    box-shadow 150ms ease,
    background 120ms ease;

  &:hover {
    background: ${s("background")};
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    transform: translateX(-50%) translateY(-1px);
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px ${(props) => props.theme.accent}55;
  }
`;

export default observer(SharedSidebar);
