"use client";

import { useRef, useState, useCallback, useEffect } from "react";

export function useMouseOut(
  distanceThreshold = 100,
  shouldClose?: () => boolean
) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const handleMouseLeave = useCallback(() => {
    function handleMouseMove(e: MouseEvent) {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        if (
          e.clientX < rect.left - distanceThreshold ||
          e.clientX > rect.right + distanceThreshold ||
          e.clientY < rect.top - distanceThreshold ||
          e.clientY > rect.bottom + distanceThreshold
        ) {
          if (!shouldClose || shouldClose()) {
            setOpen(false);
            window.removeEventListener("mousemove", handleMouseMove);
          }
        }
      }
    }
    window.addEventListener("mousemove", handleMouseMove);
  }, [distanceThreshold, shouldClose]);

  useEffect(() => {
    return () => {
      window.removeEventListener("mousemove", () => {});
    };
  }, []);

  return { open, ref, setOpen, handleMouseLeave };
}
