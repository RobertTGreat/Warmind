"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createInventorySearchMatcher,
  type InventorySearchDataset,
  type InventorySearchMatchRequest,
  type InventorySearchMatchResponse,
} from "@/lib/inventoryViewModels";
import type {
  InventoryLayoutOrderRequest,
  InventoryLayoutOrderResponse,
} from "@/lib/inventoryLayout";
import type { ParsedSearch } from "@/lib/searchUtils";

type InventoryWorkerResponse =
  | {
      id: number;
      type: "searchMatches";
      payload: InventorySearchMatchResponse;
    }
  | {
      id: number;
      type: "inventoryLayout";
      payload: InventoryLayoutOrderResponse;
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

function datasetReferencesMatch(
  firstDataset: InventorySearchDataset | null,
  secondDataset: InventorySearchDataset | null,
) {
  if (firstDataset === secondDataset) return true;
  if (!firstDataset || !secondDataset) return false;

  return (
    firstDataset.items === secondDataset.items &&
    firstDataset.definitions === secondDataset.definitions &&
    firstDataset.profile === secondDataset.profile &&
    firstDataset.dimDefinitions === secondDataset.dimDefinitions
  );
}

export function useInventorySearchMatches(
  request: InventorySearchMatchRequest | null,
) {
  const [matchByItemKey, setMatchByItemKey] = useState<Record<
    string,
    boolean
  > | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  const datasetSentToWorkerRef = useRef<InventorySearchDataset | null>(null);
  const fallbackMatcherRef = useRef<{
    dataset: InventorySearchDataset;
    matcher: ReturnType<typeof createInventorySearchMatcher>;
  } | null>(null);

  const dataset = useMemo<InventorySearchDataset | null>(() => {
    if (!request) return null;

    return {
      items: request.items,
      definitions: request.definitions,
      profile: request.profile,
      dimDefinitions: request.dimDefinitions,
    };
  }, [request]);

  const parsedSearch: ParsedSearch | null = request?.parsedSearch ?? null;

  const matchWithSyncFallback = (
    syncDataset: InventorySearchDataset,
    syncParsedSearch: ParsedSearch,
  ): Record<string, boolean> => {
    const cachedFallback = fallbackMatcherRef.current;
    const matcher =
      cachedFallback &&
      datasetReferencesMatch(cachedFallback.dataset, syncDataset)
        ? cachedFallback.matcher
        : createInventorySearchMatcher(syncDataset);

    fallbackMatcherRef.current = { dataset: syncDataset, matcher };

    return matcher.matchParsedSearch(syncParsedSearch).matchByItemKey;
  };

  useEffect(() => {
    if (!dataset || !parsedSearch) {
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
        const nextMatches = matchWithSyncFallback(dataset, parsedSearch);

        if (isCurrent) {
          setMatchByItemKey(nextMatches);
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

      const handleMessage = (
        event: MessageEvent<InventoryWorkerResponse>,
      ) => {
        const message = event.data;

        if (!isCurrent || message.id !== requestId) return;

        if (message.type === "searchMatches") {
          setMatchByItemKey(message.payload.matchByItemKey);
        } else if (message.type === "error") {
          console.warn("[InventoryWorker]", message.error);
          setMatchByItemKey(matchWithSyncFallback(dataset, parsedSearch));
        } else {
          return;
        }

        setIsBuilding(false);
      };

      worker.addEventListener("message", handleMessage);

      if (!datasetReferencesMatch(datasetSentToWorkerRef.current, dataset)) {
        worker.postMessage({
          id: requestId,
          type: "setSearchDataset",
          payload: dataset,
        });
        datasetSentToWorkerRef.current = dataset;
      }

      worker.postMessage({
        id: requestId,
        type: "search",
        payload: { parsedSearch },
      });

      return () => {
        isCurrent = false;
        worker.removeEventListener("message", handleMessage);
      };
    } catch (error) {
      console.warn(
        "[InventoryWorker] Falling back to synchronous search",
        error,
      );
      finishWithSyncFallback();

      return () => {
        isCurrent = false;
      };
    }
  }, [dataset, parsedSearch]);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      datasetSentToWorkerRef.current = null;
    };
  }, []);

  return {
    matchByItemKey,
    isBuilding,
  };
}

/**
 * Computes the heavy inventory sort/grouping order off the main thread,
 * returning the latest worker result; callers fall back to a synchronous
 * computation whenever the result is missing or stale for the current inputs.
 */
export function useInventoryLayoutOrder(
  request: InventoryLayoutOrderRequest | null,
) {
  const [layoutOrder, setLayoutOrder] =
    useState<InventoryLayoutOrderResponse | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const requestRevision = request?.revision ?? "";

  useEffect(() => {
    if (!request) {
      setLayoutOrder(null);
      return;
    }

    let isCurrent = true;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    try {
      const worker = workerRef.current ?? createInventoryWorker();
      workerRef.current = worker;

      if (!worker) {
        return () => {
          isCurrent = false;
        };
      }

      const handleMessage = (
        event: MessageEvent<InventoryWorkerResponse>,
      ) => {
        const message = event.data;

        if (!isCurrent || message.id !== requestId) return;

        if (message.type === "inventoryLayout") {
          setLayoutOrder(message.payload);
        } else if (message.type === "error") {
          console.warn("[InventoryLayoutWorker]", message.error);
        }
      };

      worker.addEventListener("message", handleMessage);
      worker.postMessage({
        id: requestId,
        type: "buildInventoryLayout",
        payload: request,
      });

      return () => {
        isCurrent = false;
        worker.removeEventListener("message", handleMessage);
      };
    } catch (error) {
      console.warn("[InventoryLayoutWorker] Worker unavailable", error);

      return () => {
        isCurrent = false;
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestRevision]);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  return layoutOrder;
}
