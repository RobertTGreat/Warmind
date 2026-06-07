import {
  buildInventorySearchMatchRecord,
  type InventorySearchMatchRequest,
} from "@/lib/inventoryViewModels";

type InventoryWorkerRequest = {
  id: number;
  type: "buildSearchMatches";
  payload: InventorySearchMatchRequest;
};

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

self.onmessage = (event: MessageEvent<InventoryWorkerRequest>) => {
  const message = event.data;

  try {
    if (message.type === "buildSearchMatches") {
      const response: InventoryWorkerResponse = {
        id: message.id,
        type: "searchMatches",
        payload: buildInventorySearchMatchRecord(message.payload),
      };

      self.postMessage(response);
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
