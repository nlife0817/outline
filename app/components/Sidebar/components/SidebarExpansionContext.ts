import { action, observable, reaction } from "mobx";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { NavigationNode } from "@shared/types";

/** localStorage key prefix for per-share manual expansion state. */
const STORAGE_PREFIX = "sidebar.expanded.";

/**
 * Read persisted expanded node IDs for a given share from localStorage.
 *
 * @param shareId the share identifier used as the storage key suffix.
 * @returns array of persisted node IDs, or an empty array if none/invalid.
 */
function readPersistedIds(shareId: string): string[] {
  try {
    const raw =
      typeof window !== "undefined"
        ? window.localStorage.getItem(STORAGE_PREFIX + shareId)
        : null;
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Persist expanded node IDs for a given share to localStorage.
 *
 * @param shareId the share identifier used as the storage key suffix.
 * @param ids iterable of node IDs to persist.
 */
function writePersistedIds(shareId: string, ids: Iterable<string>): void {
  try {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      STORAGE_PREFIX + shareId,
      JSON.stringify(Array.from(ids))
    );
  } catch {
    // Storage unavailable (private mode, quota); silently skip.
  }
}

/**
 * Collect every node ID reachable from the given roots.
 *
 * @param roots top-level navigation nodes.
 * @returns array of all node IDs in the tree.
 */
function collectAllIds(roots: NavigationNode[]): string[] {
  const ids: string[] = [];
  const walk = (nodes: NavigationNode[]) => {
    for (const node of nodes) {
      ids.push(node.id);
      if (node.children.length) {
        walk(node.children);
      }
    }
  };
  walk(roots);
  return ids;
}

/**
 * Computes the set of node IDs along the path from any node in `roots` down
 * to a node with `targetId`, inclusive of both endpoints. Returns an empty
 * array when no path exists.
 *
 * @param roots the top-level navigation nodes to search through.
 * @param targetId the id of the target document.
 * @returns array of ancestor IDs (inclusive of the target).
 */
function computeAncestorPath(
  roots: NavigationNode[],
  targetId: string
): string[] {
  const stack: string[] = [];
  let found = false;
  const search = (nodes: NavigationNode[]): boolean => {
    for (const node of nodes) {
      stack.push(node.id);
      if (node.id === targetId) {
        found = true;
        return true;
      }
      if (node.children.length && search(node.children)) {
        return true;
      }
      stack.pop();
    }
    return false;
  };
  search(roots);
  return found ? stack : [];
}

/**
 * Manages the set of expanded node IDs for a sidebar document tree.
 *
 * Uses a MobX ObservableSet so that individual `observer`-wrapped
 * DocumentLinks only re-render when their own node's membership in the set
 * changes, rather than on every expansion toggle anywhere in the tree.
 */
export class SidebarExpansionState {
  @observable
  expandedIds = new Set<string>();

  /**
   * Whether a given node is currently expanded.
   *
   * @param nodeId the id of the node to check.
   * @returns true if the node is expanded.
   */
  isExpanded(nodeId: string): boolean {
    return this.expandedIds.has(nodeId);
  }

  /**
   * Expand a single node.
   *
   * @param nodeId the id of the node to expand.
   */
  @action
  expand(nodeId: string): void {
    this.expandedIds.add(nodeId);
  }

  /**
   * Collapse a single node.
   *
   * @param nodeId the id of the node to collapse.
   */
  @action
  collapse(nodeId: string): void {
    this.expandedIds.delete(nodeId);
  }

  /**
   * Expand a node and all of its descendants recursively.
   *
   * @param node the root NavigationNode to expand.
   */
  @action
  expandDescendants(node: NavigationNode): void {
    const walk = (n: NavigationNode) => {
      this.expandedIds.add(n.id);
      for (const child of n.children) {
        walk(child);
      }
    };
    walk(node);
  }

  /**
   * Collapse a node and all of its descendants recursively.
   *
   * @param node the root NavigationNode to collapse.
   */
  @action
  collapseDescendants(node: NavigationNode): void {
    const walk = (n: NavigationNode) => {
      this.expandedIds.delete(n.id);
      for (const child of n.children) {
        walk(child);
      }
    };
    walk(node);
  }

  /**
   * Expand all nodes along a path (e.g. ancestors of the active document).
   *
   * @param ids the node IDs to expand.
   */
  @action
  expandPath(ids: Iterable<string>): void {
    for (const id of ids) {
      this.expandedIds.add(id);
    }
  }

  /**
   * Expand every node in the given roots, recursively.
   *
   * @param roots the top-level navigation nodes.
   */
  @action
  expandAll(roots: NavigationNode[]): void {
    const walk = (nodes: NavigationNode[]) => {
      for (const node of nodes) {
        this.expandedIds.add(node.id);
        walk(node.children);
      }
    };
    walk(roots);
  }

  /**
   * Collapse every node by clearing the set.
   */
  @action
  collapseAll(): void {
    this.expandedIds.clear();
  }
}

/**
 * Context for providing a SidebarExpansionState to descendant sidebar
 * components. Each document tree root (collection, starred doc, shared
 * membership) creates its own instance so expansion state is scoped.
 */
const SidebarExpansionContext = createContext<SidebarExpansionState | null>(
  null
);

/**
 * Hook to consume the nearest SidebarExpansionState from context.
 *
 * @returns the expansion state instance.
 */
export function useSidebarExpansion(): SidebarExpansionState {
  const ctx = useContext(SidebarExpansionContext);
  if (!ctx) {
    throw new Error(
      "useSidebarExpansion must be used within a SidebarExpansionContext.Provider"
    );
  }
  return ctx;
}

/**
 * Hook that creates a SidebarExpansionState and auto-expands the path
 * to the active document whenever it changes. Returns the state instance
 * to be provided via SidebarExpansionContext.Provider.
 *
 * @param roots the top-level navigation nodes (e.g. collection documents).
 * @param activeDocumentId the currently active document ID.
 * @returns the expansion state instance.
 */
export function useSidebarExpansionState(
  roots: NavigationNode[] | undefined,
  activeDocumentId: string | undefined,
  shareId?: string
): SidebarExpansionState {
  const [state] = useState(() => new SidebarExpansionState());
  const [initialized, setInitialized] = useState(false);

  // On first render with a non-empty tree, restore persisted branches from
  // localStorage if they exist; otherwise expand the entire tree so users see
  // the full table of contents by default.
  useEffect(() => {
    if (initialized || !roots || roots.length === 0) {
      return;
    }
    const persisted = shareId ? readPersistedIds(shareId) : [];
    if (persisted.length) {
      state.expandPath(persisted);
    } else {
      state.expandAll(roots);
    }
    setInitialized(true);
  }, [state, shareId, roots, initialized]);

  // Auto-expand only the ancestor path of the currently active document so
  // the open page is visible after navigation/reload. Sibling branches stay
  // collapsed (GitBook-like behaviour).
  useEffect(() => {
    if (!roots || !activeDocumentId) {
      return;
    }
    const path = computeAncestorPath(roots, activeDocumentId);
    if (path.length > 1) {
      // Drop the active node itself — only expand its ancestors.
      state.expandPath(path.slice(0, -1));
    }
  }, [state, roots, activeDocumentId]);

  // Persist every change to localStorage, debounced.
  useEffect(() => {
    if (!shareId) {
      return;
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const dispose = reaction(
      () => Array.from(state.expandedIds),
      (ids) => {
        if (timer) {
          clearTimeout(timer);
        }
        timer = setTimeout(() => {
          writePersistedIds(shareId, ids);
        }, 150);
      },
      { fireImmediately: true }
    );
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
      dispose();
    };
  }, [state, shareId]);

  // Memoise to keep referential stability for consumers.
  return useMemo(() => state, [state]);
}

/**
 * Hook returning helpers to expand or collapse every node in the tree at once.
 *
 * @param roots the top-level navigation nodes.
 * @returns object with `expandAll`, `collapseAll`, and `allExpanded` flag.
 */
export function useTreeExpansionControls(
  roots: NavigationNode[] | undefined
): {
  expandAll: () => void;
  collapseAll: () => void;
} {
  const expansion = useSidebarExpansion();
  return useMemo(
    () => ({
      expandAll: () => {
        if (roots) {
          expansion.expandAll(roots);
        }
      },
      collapseAll: () => {
        expansion.collapseAll();
      },
    }),
    [expansion, roots]
  );
}

export { collectAllIds };

export default SidebarExpansionContext;
