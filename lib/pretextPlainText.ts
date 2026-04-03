import { isValidElement, type ReactNode } from "react";

/**
 * Best-effort plain text from React children for Pretext measurement.
 * Returns null if the tree contains non-text nodes we cannot flatten safely.
 */
export function extractPlainTextFromReactNode(node: ReactNode): string | null {
  if (node == null || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    let out = "";
    for (const child of node) {
      const t = extractPlainTextFromReactNode(child);
      if (t === null) {
        return null;
      }
      out += t;
    }
    return out;
  }
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode };
    return extractPlainTextFromReactNode(props?.children ?? null);
  }
  return null;
}

/** Collapse whitespace / newlines for single-line (marquee) width measurement. */
export function normalizeForSingleLineMeasure(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
