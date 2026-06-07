"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildInventorySearchMatchRecord,
  type InventorySearchMatchRequest,
} from "@/lib/inventoryViewModels";

type InventoryWorkerResponse =
  | {
      id: number;
      type: "searchMatches";
      payload: ReturnType<typeof buildInventorySearchMatchRecord>;
    }
  | {
      id: number;
      type: "error";
      error: string;
    };

function createInventoryWorker() {
  if (typeof Worker === "undefined") {
    return null;
  }

  return new Worker(new URL("../workers/inventory.worker.ts", import.meta.url), {
    type: "module",
  });
}

export function useInventorySearchMatches(
  request: InventorySearchMatchRequest | null,
) {
  const [matchByItemKey, setMatchByItemKey] = useState<Record<string, boolean> | null>(
    null,
  );
  const [isBuilding, setIsBuilding] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  const requestKey = useMemo(() => {
    if (!request) return "";

    return JSON.stringify({
      itemCount: request.items.length,
      query: request.parsedSearch,
      definitionCount: Object.keys(request.definitions).length,
      profileKey:
        request.profile?.responseMintedTimestamp ??
        request.profile?.profile?.data?.dateLastPlayed ??
        "",
    });
  }, [request]);

  useEffect(() => {
    if (!request) {
      setMatchByItemKey(null);
      setIsBuilding(false);
      return;
    }

    let isCurrent = true;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsBuilding(true);

    const finishWithSyncFallback = () => {
      try {
        const response = buildInventorySearchMatchRecord(request);

        if (isCurrent) {
          setMatchByItemKey(response.matchByItemKey);
        }
      } finally {
        if (isCurrent) {
          setIsBuilding(false);
        }
      }
    };

    try {
      const worker = workerRef.current ?? createInventoryWorker();
      workerRef.current = worker;

      if (!worker) {
        finishWithSyncFallback();
        return () => {
          isCurrent = false;
        };
      }

      const handleMessage = (event: MessageEvent<InventoryWorkerResponse>) => {
        const message = event.data;

        if (!isCurrent || message.id !== requestId) return;

        if (message.type === "searchMatches") {
          setMatchByItemKey(message.payload.matchByItemKey);
        } else {
          console.warn("[InventoryWorker]", message.error);
          setMatchByItemKey(buildInventorySearchMatchRecord(request).matchByItemKey);
        }

        setIsBuilding(false);
      };

      worker.addEventListener("message", handleMessage);
      worker.postMessage({
        id: requestId,
        type: "buildSearchMatches",
        payload: request,
      });

      return () => {
        isCurrent = false;
        worker.removeEventListener("message", handleMessage);
      };
    } catch (error) {
      console.warn("[InventoryWorker] Falling back to synchronous search", error);
      finishWithSyncFallback();

      return () => {
        isCurrent = false;
      };
    }
  }, [request, requestKey]);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  return {
    matchByItemKey,
    isBuilding,
  };
}
