import {
  buildInventorySearchMatchRecord,
  createInventorySearchMatcher,
  type InventorySearchDataset,
  type InventorySearchMatchRequest,
  type InventorySearchMatchResponse,
} from "@/lib/inventoryViewModels";
import { parseSearchQuery, type ParsedSearch } from "@/lib/searchUtils";
import {
  buildInventoryLayoutOrder,
  type InventoryLayoutOrderRequest,
  type InventoryLayoutOrderResponse,
} from "@/lib/inventoryLayout";

type InventoryWorkerRequest =
  | {
      id: number;
      type: "setSearchDataset";
      payload: InventorySearchDataset;
    }
  | {
      id: number;
      type: "search";
      payload: { parsedSearch: ParsedSearch };
    }
  | {
      id: number;
      type: "buildSearchMatches";
      payload: InventorySearchMatchRequest;
    }
  | {
      id: number;
      type: "buildInventoryLayout";
      payload: InventoryLayoutOrderRequest;
    };

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

let activeSearchMatcher: ReturnType<typeof createInventorySearchMatcher> | null =
  null;

self.onmessage = (event: MessageEvent<InventoryWorkerRequest>) => {
  const message = event.data;

  try {
    if (message.type === "setSearchDataset") {
      activeSearchMatcher = createInventorySearchMatcher(message.payload);
      return;
    }

    if (message.type === "search") {
      if (!activeSearchMatcher) {
        throw new Error("Search dataset has not been initialized");
      }

      const parsedSearch =
        message.payload.parsedSearch ??
        parseSearchQuery("");

      const response: InventoryWorkerResponse = {
        id: message.id,
        type: "searchMatches",
        payload: activeSearchMatcher.matchParsedSearch(parsedSearch),
      };

      self.postMessage(response);
      return;
    }

    if (message.type === "buildSearchMatches") {
      const response: InventoryWorkerResponse = {
        id: message.id,
        type: "searchMatches",
        payload: buildInventorySearchMatchRecord(message.payload),
      };

      self.postMessage(response);
      return;
    }

    if (message.type === "buildInventoryLayout") {
      const response: InventoryWorkerResponse = {
        id: message.id,
        type: "inventoryLayout",
        payload: buildInventoryLayoutOrder(message.payload),
      };

      self.postMessage(response);
      return;
    }
  } catch (error) {
    const response: InventoryWorkerResponse = {
      id: message.id,
      type: "error",
      error: error instanceof Error ? error.message : "Inventory worker failed",
    };

    self.postMessage(response);
  }
};

export {};
