import { useState, useEffect } from 'react';
import { fetchManifestDefinitions } from '@/lib/manifestTableClient';

const CACHE_KEY_PREFIX = 'destiny_manifest_objective_';
const CACHE_VERSION = 'v1';

export interface ObjectiveDefinition {
  hash: number;
  displayProperties: {
    name: string; // Sometimes empty, check progressDescription
    description: string;
    icon: string;
  };
  progressDescription: string;
  completionValue: number;
  [key: string]: any;
}

export function useObjectiveDefinitions(objectiveHashes: number[]) {
  const [definitions, setDefinitions] = useState<Record<number, ObjectiveDefinition>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!objectiveHashes || !objectiveHashes.length) {
        setIsLoading(false);
        return;
    }

    const loadDefinitions = async () => {
        const uniqueHashes = Array.from(new Set(objectiveHashes));
        const newDefs: Record<number, ObjectiveDefinition> = {};
        const missingHashes: number[] = [];

        // 1. Check LocalStorage
        uniqueHashes.forEach(hash => {
            if (definitions[hash]) {
                newDefs[hash] = definitions[hash];
                return;
            }

            const cached = localStorage.getItem(`${CACHE_KEY_PREFIX}${hash}_${CACHE_VERSION}`);
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    newDefs[hash] = parsed;
                } catch (e) {
                    missingHashes.push(hash);
                }
            } else {
                missingHashes.push(hash);
            }
        });

        setDefinitions(prev => ({ ...prev, ...newDefs }));

        // 2. Fetch Missing
        if (missingHashes.length > 0) {
            const BATCH_SIZE = 5;
            for (let i = 0; i < missingHashes.length; i += BATCH_SIZE) {
                const batch = missingHashes.slice(i, i + BATCH_SIZE);
                
                try {
                    const fetchedDefinitions = await fetchManifestDefinitions<ObjectiveDefinition>(
                        'DestinyObjectiveDefinition',
                        batch
                    );

                    for (const hash of batch) {
                        const definition = fetchedDefinitions[String(hash)];

                        if (definition) {
                            newDefs[hash] = definition;
                            try {
                                localStorage.setItem(
                                    `${CACHE_KEY_PREFIX}${hash}_${CACHE_VERSION}`,
                                    JSON.stringify(definition)
                                );
                            } catch (e) {}
                        }
                    }
                } catch (err) {
                    console.error('Failed to fetch objective definitions', err);
                }
                
                setDefinitions(prev => ({ ...prev, ...newDefs }));
            }
        }
        
        setIsLoading(false);
    };

    loadDefinitions();
  }, [objectiveHashes]); // Warning: passing array inline might cause loops if not stable, but wrapper usually handles

  return { definitions, isLoading };
}

