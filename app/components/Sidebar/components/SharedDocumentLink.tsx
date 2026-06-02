import { observer } from "mobx-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import Icon from "@shared/components/Icon";
import type { NavigationNode } from "@shared/types";
import type Collection from "~/models/Collection";
import type Document from "~/models/Document";
import useStores from "~/hooks/useStores";
import { sharedModelPath } from "~/utils/routeHelpers";
import { useSidebarExpansion } from "./SidebarExpansionContext";
import SidebarLink from "./SidebarLink";

type Props = {
  node: NavigationNode;
  collection?: Collection;
  activeDocumentId?: string;
  activeDocument?: Document;
  prefetchDocument?: (documentId: string) => Promise<Document | void>;
  isDraft?: boolean;
  depth: number;
  index: number;
  shareId: string;
  parentId?: string;
};

function DocumentLink(
  {
    node,
    collection,
    activeDocument,
    activeDocumentId,
    prefetchDocument,
    isDraft,
    depth,
    shareId,
  }: Props,
  ref: React.RefObject<HTMLAnchorElement>
) {
  const { documents } = useStores();
  const { t } = useTranslation();
  const expansion = useSidebarExpansion();

  const isActiveDocument = activeDocumentId === node.id;

  const hasChildDocuments =
    !!node.children.length || activeDocument?.parentDocumentId === node.id;
  const document = documents.get(node.id);

  // GitBook-like fork: do NOT auto-expand any nodes — the user expands
  // accordions manually.
  const expanded = expansion.isExpanded(node.id);

  const handleDisclosureClick = React.useCallback(
    (ev: React.SyntheticEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (expanded) {
        const altKey = "altKey" in ev && (ev as React.MouseEvent).altKey;
        if (altKey) {
          expansion.collapseDescendants(node);
        } else {
          expansion.collapse(node.id);
        }
      } else {
        const altKey = "altKey" in ev && (ev as React.MouseEvent).altKey;
        if (altKey) {
          expansion.expandDescendants(node);
        } else {
          expansion.expand(node.id);
        }
      }
    },
    [expanded, expansion, node]
  );

  const nodeChildren = React.useMemo(() => {
    if (
      activeDocument?.isDraft &&
      activeDocument?.isActive &&
      activeDocument?.parentDocumentId === node.id
    ) {
      return [activeDocument?.asNavigationNode, ...node.children];
    }

    return node.children;
  }, [
    activeDocument?.isActive,
    activeDocument?.isDraft,
    activeDocument?.parentDocumentId,
    activeDocument?.asNavigationNode,
    node,
  ]);

  const handlePrefetch = React.useCallback(() => {
    void prefetchDocument?.(node.id);
  }, [prefetchDocument, node]);

  const title =
    (activeDocument?.id === node.id ? activeDocument.title : node.title) ||
    t("Untitled");

  const icon = node.icon ?? node.emoji;
  const initial = title ? title.charAt(0).toUpperCase() : "?";

  // Guide line is drawn for any nested child group so users can visually
  // follow the parent column. Kept on the wrapper even while collapsed so
  // the line fades together with the rows during the height transition.
  const showGuide = depth >= 1 && nodeChildren.length > 0;

  const showDisclosure = hasChildDocuments && depth !== 0;

  // Lazy-mount children on first expand so deep trees don't pay render cost
  // up-front, but keep them mounted afterwards so the collapse direction is
  // animatable too.
  const [hasMountedChildren, setHasMountedChildren] =
    React.useState<boolean>(expanded);
  React.useEffect(() => {
    if (expanded && !hasMountedChildren) {
      setHasMountedChildren(true);
    }
  }, [expanded, hasMountedChildren]);

  return (
    <>
      <SidebarLink
        to={{
          pathname: sharedModelPath(shareId, node.url),
          state: {
            title: node.title,
          },
        }}
        expanded={showDisclosure ? expanded : undefined}
        disclosureRight={showDisclosure}
        onDisclosureClick={handleDisclosureClick}
        onClickIntent={handlePrefetch}
        icon={
          icon && <Icon value={icon} color={node.color} initial={initial} />
        }
        label={title}
        depth={depth}
        flatIndent
        exact={false}
        scrollIntoViewIfNeeded={!document?.isStarred}
        isDraft={isDraft}
        ref={ref}
        isActive={() => !!isActiveDocument}
      />
      {hasMountedChildren && (
        <ChildGroup
          $hasGuide={showGuide}
          $depth={depth}
          $expanded={expanded}
          aria-hidden={!expanded}
        >
          <ChildGroupInner>
            {nodeChildren.map((childNode, index) => (
              <SharedDocumentLink
                shareId={shareId}
                key={childNode.id}
                collection={collection}
                node={childNode}
                activeDocumentId={activeDocumentId}
                activeDocument={activeDocument}
                prefetchDocument={prefetchDocument}
                isDraft={childNode.isDraft}
                depth={depth + 1}
                index={index}
                parentId={node.id}
              />
            ))}
          </ChildGroupInner>
        </ChildGroup>
      )}
    </>
  );
}

interface ChildGroupProps {
  $hasGuide: boolean;
  $depth: number;
  $expanded: boolean;
}

const ChildGroup = styled.div<ChildGroupProps>`
  position: relative;
  display: grid;
  grid-template-rows: ${(props) => (props.$expanded ? "1fr" : "0fr")};
  opacity: ${(props) => (props.$expanded ? 1 : 0)};
  transition:
    grid-template-rows 280ms cubic-bezier(0.65, 0, 0.35, 1),
    opacity 220ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: grid-template-rows;

  /* Preview-spec guide line: clean border-left on the child group itself,
     no absolute pseudo. margin-left + padding-left gives the 14/12 split
     used in the preview HTML. */
  ${(props) =>
    props.$hasGuide &&
    `
    margin-inline-start: 14px;
    padding-inline-start: 12px;
    border-inline-start: 1px solid ${props.theme.divider};
  `}

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const ChildGroupInner = styled.div`
  overflow: hidden;
  min-height: 0;
`;

export const SharedDocumentLink = observer(React.forwardRef(DocumentLink));
