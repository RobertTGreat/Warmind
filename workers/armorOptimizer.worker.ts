import {
  findOptimalArmorSets,
  type ArmorPiece,
  type OptimizerSettings,
  type StatConstraints,
} from "@/lib/armorOptimizer";

type ArmorOptimizerWorkerRequest = {
  id: number;
  armorPieces: ArmorPiece[];
  classType: number;
  constraints: StatConstraints;
  settings: OptimizerSettings;
  maxResults: number;
};

type ArmorOptimizerWorkerResponse =
  | {
      id: number;
      type: "result";
      results: ReturnType<typeof findOptimalArmorSets>;
    }
  | {
      id: number;
      type: "error";
      error: string;
    };

self.onmessage = (event: MessageEvent<ArmorOptimizerWorkerRequest>) => {
  const message = event.data;

  try {
    const response: ArmorOptimizerWorkerResponse = {
      id: message.id,
      type: "result",
      results: findOptimalArmorSets(
        message.armorPieces,
        message.classType,
        message.constraints,
        message.settings,
        message.maxResults,
      ),
    };

    self.postMessage(response);
  } catch (error) {
    const response: ArmorOptimizerWorkerResponse = {
      id: message.id,
      type: "error",
      error: error instanceof Error ? error.message : "Armor optimizer worker failed",
    };

    self.postMessage(response);
  }
};

export {};
