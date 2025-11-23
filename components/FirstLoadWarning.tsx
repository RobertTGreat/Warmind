"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function FirstLoadWarning() {
  useEffect(() => {
    let hasShownWarning = false;
    try {
        hasShownWarning = localStorage.getItem("warmind_first_load_warning") === "true";
    } catch (e) {
        // Storage likely disabled or full
        console.warn("Could not read from localStorage", e);
    }

    if (!hasShownWarning) {
      // Add a small delay to ensure the app is interactive/visible before showing
      const timer = setTimeout(() => {
        toast.info("First Load", {
          description: "Initial loading may take a moment while we fetch and cache Destiny 2 definitions.",
          duration: 8000,
          action: {
            label: "Dismiss",
            onClick: () => {},
          },
        });
        try {
            localStorage.setItem("warmind_first_load_warning", "true");
        } catch (e) {
            console.warn("Could not write to localStorage", e);
        }
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, []);

  return null;
}
