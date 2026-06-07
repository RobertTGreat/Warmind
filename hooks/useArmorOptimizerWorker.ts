"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  findOptimalArmorSets,
  type ArmorPiece,
  type ArmorSet,
  type OptimizerSettings,
  type StatConstraints,
} from "@/lib/armorOptimizer";

type OptimizeArmorInput = {
  armorPieces: ArmorPiece[];
  classType: number;
  constraints: StatConstraints;
  settings: OptimizerSettings;
  maxResults?: number;
};

type ArmorOptimizerWorkerResponse =
  | {
      id: number;
      type: "result";
      results: ArmorSet[];
    }
  | {
      id: number;
      type: "error";
      error: string;
    };

function createArmorOptimizerWorker() {
  if (typeof Worker === "undefined") {
    return null;
  }

  return new Worker(new URL("../workers/armorOptimizer.worker.ts", import.meta.url), {
    type: "module",
  });
}

export function useArmorOptimizerWorker() {
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  return useCallback((input: OptimizeArmorInput) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    return new Promise<ArmorSet[]>((resolve, reject) => {
      try {
        const worker = workerRef.current ?? createArmorOptimizerWorker();
        workerRef.current = worker;

        if (!worker) {
          resolve(
            findOptimalArmorSets(
              input.armorPieces,
              input.classType,
              input.constraints,
              input.settings,
              input.maxResults ?? 50,
            ),
          );
          return;
        }

        const handleMessage = (event: MessageEvent<ArmorOptimizerWorkerResponse>) => {
          const message = event.data;

          if (message.id !== requestId) return;

          worker.removeEventListener("message", handleMessage);

          if (message.type === "result") {
            resolve(message.results);
          } else {
            reject(new Error(message.error));
          }
        };

        worker.addEventListener("message", handleMessage);
        worker.postMessage({
          id: requestId,
          armorPieces: input.armorPieces,
          classType: input.classType,
          constraints: input.constraints,
          settings: input.settings,
          maxResults: input.maxResults ?? 50,
        });
      } catch (error) {
        try {
          resolve(
            findOptimalArmorSets(
              input.armorPieces,
              input.classType,
              input.constraints,
              input.settings,
              input.maxResults ?? 50,
            ),
          );
        } catch {
          reject(error);
        }
      }
    });
  }, []);
}
