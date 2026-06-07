/**
 * Touch/pen drag-and-drop for the inventory board.
 *
 * Native HTML5 drag-and-drop only works for mouse/trackpad, so this hook adds a
 * Pointer Events implementation for touch and pen input (e.g. touchscreen
 * laptops and tablets). It uses long-press activation so normal touch scrolling
 * still works, renders a floating drag ghost, hit-tests drop zones via
 * `data-drop-owner` / `data-drop-bucket` attributes, and locks page scrolling
 * while a drag is in progress.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";

export type BoardDragPayload = {
  itemHash: number;
  itemInstanceId: string;
  fromOwnerId: string;
  bucketHash: number | null;
  iconSrc: string | null;
  iconSizePx: number;
};

export type BoardDropTarget = {
  ownerId: string;
  bucketHash: number;
};

export type StartBoardPointerDrag = (
  event: ReactPointerEvent,
  payload: BoardDragPayload,
) => void;

type BoardPointerDragOptions = {
  onDrop: (payload: BoardDragPayload, target: BoardDropTarget) => void;
  isValidTarget: (payload: BoardDragPayload, target: BoardDropTarget) => boolean;
};

type DragSession = {
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  payload: BoardDragPayload;
  longPressTimerId: number | null;
  isActive: boolean;
  ghostElement: HTMLDivElement | null;
  highlightedZone: HTMLElement | null;
  currentTarget: BoardDropTarget | null;
};

const LONG_PRESS_DELAY_MS = 200;
const SCROLL_INTENT_THRESHOLD_PX = 12;

const DROP_ZONE_HIGHLIGHT = {
  outline: "2px solid rgba(244, 196, 72, 0.75)",
  outlineOffset: "-2px",
  backgroundColor: "rgba(244, 196, 72, 0.08)",
} as const;

function findDropTargetAtPoint(
  clientX: number,
  clientY: number,
): { zone: HTMLElement; target: BoardDropTarget } | null {
  const elementUnderPointer = document.elementFromPoint(
    clientX,
    clientY,
  ) as HTMLElement | null;
  const zone = elementUnderPointer?.closest(
    "[data-drop-owner]",
  ) as HTMLElement | null;
  if (!zone) {
    return null;
  }

  const ownerId = zone.getAttribute("data-drop-owner");
  const bucketHash = Number(zone.getAttribute("data-drop-bucket"));
  if (!ownerId || !Number.isFinite(bucketHash)) {
    return null;
  }

  return { zone, target: { ownerId, bucketHash } };
}

function createDragGhost(payload: BoardDragPayload): HTMLDivElement {
  const ghost = document.createElement("div");
  const sizePx = payload.iconSizePx;
  ghost.style.position = "fixed";
  ghost.style.left = "0";
  ghost.style.top = "0";
  ghost.style.width = `${sizePx}px`;
  ghost.style.height = `${sizePx}px`;
  ghost.style.pointerEvents = "none";
  ghost.style.zIndex = "9999";
  ghost.style.borderRadius = "2px";
  ghost.style.border = "2px solid rgba(244, 196, 72, 0.85)";
  ghost.style.boxShadow = "0 6px 16px rgba(0, 0, 0, 0.55)";
  ghost.style.opacity = "0.9";
  ghost.style.transform = "translate(-50%, -50%)";
  ghost.style.willChange = "transform";
  ghost.style.backgroundColor = "rgba(15, 17, 21, 0.9)";
  ghost.style.backgroundSize = "cover";
  ghost.style.backgroundPosition = "center";
  if (payload.iconSrc) {
    ghost.style.backgroundImage = `url(${payload.iconSrc})`;
  }
  return ghost;
}

const BoardPointerDragContext = createContext<StartBoardPointerDrag | null>(
  null,
);

export const BoardPointerDragProvider = BoardPointerDragContext.Provider;

/** Returns the touch/pen drag starter, or null when used outside the board. */
export function useStartBoardPointerDrag(): StartBoardPointerDrag | null {
  return useContext(BoardPointerDragContext);
}

export function useBoardPointerDrag(
  options: BoardPointerDragOptions,
): StartBoardPointerDrag {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const sessionRef = useRef<DragSession | null>(null);
  const pointerMoveHandlerRef = useRef<((event: PointerEvent) => void) | null>(
    null,
  );
  const pointerEndHandlerRef = useRef<((event: PointerEvent) => void) | null>(
    null,
  );
  const preventTouchScrollRef = useRef<((event: TouchEvent) => void) | null>(
    null,
  );

  const clearHighlight = useCallback(() => {
    const session = sessionRef.current;
    if (session?.highlightedZone) {
      session.highlightedZone.style.outline = "";
      session.highlightedZone.style.outlineOffset = "";
      session.highlightedZone.style.backgroundColor = "";
      session.highlightedZone = null;
    }
  }, []);

  const endDragSession = useCallback(() => {
    const session = sessionRef.current;

    if (pointerMoveHandlerRef.current) {
      window.removeEventListener("pointermove", pointerMoveHandlerRef.current);
      pointerMoveHandlerRef.current = null;
    }
    if (pointerEndHandlerRef.current) {
      window.removeEventListener("pointerup", pointerEndHandlerRef.current);
      window.removeEventListener("pointercancel", pointerEndHandlerRef.current);
      pointerEndHandlerRef.current = null;
    }
    if (preventTouchScrollRef.current) {
      document.removeEventListener("touchmove", preventTouchScrollRef.current);
      preventTouchScrollRef.current = null;
    }

    if (!session) {
      return;
    }

    if (session.longPressTimerId !== null) {
      window.clearTimeout(session.longPressTimerId);
    }
    clearHighlight();
    if (session.ghostElement) {
      session.ghostElement.remove();
    }

    if (session.isActive) {
      document.body.style.touchAction = "";
      document.body.style.userSelect = "";
      (document.body.style as any).webkitUserSelect = "";
    }

    sessionRef.current = null;
  }, [clearHighlight]);

  const updateActiveDrag = useCallback(
    (clientX: number, clientY: number) => {
      const session = sessionRef.current;
      if (!session || !session.isActive) {
        return;
      }

      if (session.ghostElement) {
        session.ghostElement.style.transform = `translate(${clientX}px, ${clientY}px) translate(-50%, -50%)`;
      }

      const hit = findDropTargetAtPoint(clientX, clientY);
      const isValid =
        hit !== null &&
        optionsRef.current.isValidTarget(session.payload, hit.target);

      if (!isValid) {
        clearHighlight();
        session.currentTarget = null;
        return;
      }

      if (session.highlightedZone !== hit!.zone) {
        clearHighlight();
        hit!.zone.style.outline = DROP_ZONE_HIGHLIGHT.outline;
        hit!.zone.style.outlineOffset = DROP_ZONE_HIGHLIGHT.outlineOffset;
        hit!.zone.style.backgroundColor = DROP_ZONE_HIGHLIGHT.backgroundColor;
        session.highlightedZone = hit!.zone;
      }
      session.currentTarget = hit!.target;
    },
    [clearHighlight],
  );

  const activateDrag = useCallback(
    (clientX: number, clientY: number) => {
      const session = sessionRef.current;
      if (!session || session.isActive) {
        return;
      }

      session.isActive = true;
      session.longPressTimerId = null;

      session.ghostElement = createDragGhost(session.payload);
      document.body.appendChild(session.ghostElement);

      // Lock scrolling/selection for the duration of the drag.
      document.body.style.touchAction = "none";
      document.body.style.userSelect = "none";
      (document.body.style as any).webkitUserSelect = "none";

      const preventTouchScroll = (event: TouchEvent) => {
        event.preventDefault();
      };
      preventTouchScrollRef.current = preventTouchScroll;
      document.addEventListener("touchmove", preventTouchScroll, {
        passive: false,
      });

      updateActiveDrag(clientX, clientY);
    },
    [updateActiveDrag],
  );

  const startPointerDrag = useCallback<StartBoardPointerDrag>(
    (event, payload) => {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      endDragSession();

      const startX = event.clientX;
      const startY = event.clientY;

      const longPressTimerId =
        event.pointerType === "mouse"
          ? null
          : window.setTimeout(() => {
              activateDrag(startX, startY);
            }, LONG_PRESS_DELAY_MS);

      sessionRef.current = {
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        startX,
        startY,
        payload,
        longPressTimerId,
        isActive: false,
        ghostElement: null,
        highlightedZone: null,
        currentTarget: null,
      };

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const session = sessionRef.current;
        if (!session || moveEvent.pointerId !== session.pointerId) {
          return;
        }

        if (session.isActive) {
          moveEvent.preventDefault();
          updateActiveDrag(moveEvent.clientX, moveEvent.clientY);
          return;
        }

        // Before activation, significant movement means the user is scrolling.
        const movedDistance = Math.hypot(
          moveEvent.clientX - session.startX,
          moveEvent.clientY - session.startY,
        );
        if (movedDistance <= SCROLL_INTENT_THRESHOLD_PX) {
          return;
        }

        if (session.pointerType === "mouse") {
          moveEvent.preventDefault();
          activateDrag(moveEvent.clientX, moveEvent.clientY);
          return;
        }

        endDragSession();
      };

      const handlePointerEnd = (endEvent: PointerEvent) => {
        const session = sessionRef.current;
        if (!session || endEvent.pointerId !== session.pointerId) {
          return;
        }

        if (
          endEvent.type === "pointerup" &&
          session.isActive &&
          session.currentTarget
        ) {
          optionsRef.current.onDrop(session.payload, session.currentTarget);
        }

        endDragSession();
      };

      pointerMoveHandlerRef.current = handlePointerMove;
      pointerEndHandlerRef.current = handlePointerEnd;
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerEnd);
      window.addEventListener("pointercancel", handlePointerEnd);
    },
    [activateDrag, endDragSession, updateActiveDrag],
  );

  useEffect(() => endDragSession, [endDragSession]);

  return startPointerDrag;
}
