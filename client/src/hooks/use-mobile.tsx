import { useState, useEffect } from "react";

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if window exists (to handle SSR)
    if (typeof window !== "undefined") {
      const checkMobile = () => {
        setIsMobile(window.innerWidth < 768);
      };
      
      // Set initial value
      checkMobile();
      
      // Add resize event listener
      window.addEventListener("resize", checkMobile);
      
      // Clean up
      return () => window.removeEventListener("resize", checkMobile);
    }
  }, []);

  return isMobile;
}