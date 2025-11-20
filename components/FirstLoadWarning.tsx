"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function FirstLoadWarning() {
  useEffect(() => {
    const hasShownWarning = localStorage.getItem("warmind_first_load_warning");

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
        localStorage.setItem("warmind_first_load_warning", "true");
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, []);

  return null;
}

