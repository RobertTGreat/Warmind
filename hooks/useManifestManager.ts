import { useEffect, useState } from 'react';
import { bungieApi, endpoints } from '@/lib/bungie';
import { clearDB } from '@/lib/indexedDB';
import { toast } from 'sonner';

export function useManifestManager() {
    const [isChecking, setIsChecking] = useState(false);

    useEffect(() => {
        const checkManifestVersion = async () => {
            if (typeof window === 'undefined') return;
            
            setIsChecking(true);
            try {
                const storedVersion = localStorage.getItem('destiny_manifest_version');
                
                // Fetch lightweight manifest metadata
                const response = await bungieApi.get(endpoints.getDestinyManifest());
                const latestVersion = response.data.Response.version;

                if (storedVersion !== latestVersion) {
                    console.log(`[Manifest] Update detected: ${storedVersion} -> ${latestVersion}`);
                    
                    // 1. Clear IndexedDB (remove stale items)
                    await clearDB();
                    
                    // 2. Update Local Storage
                    localStorage.setItem('destiny_manifest_version', latestVersion);
                    
                    if (storedVersion) {
                        toast.info("Destiny Database Updated", {
                            description: "Downloaded latest item definitions from Bungie.",
                            duration: 4000,
                        });
                    }
                } else {
                    console.log(`[Manifest] Up to date: ${latestVersion}`);
                }
            } catch (error) {
                console.error("[Manifest] Check failed", error);
            } finally {
                setIsChecking(false);
            }
        };

        // Run check on mount
        checkManifestVersion();

    }, []);

    return { isChecking };
}


