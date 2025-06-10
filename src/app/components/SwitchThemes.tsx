'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { useMouseOut } from "@/app/hooks/useMouseOut";

export const SwitchThemes = () => {
   const [collapsed, setCollapsed] = useState<boolean>(false),
    { setTheme, theme } = useTheme(),
    { open, ref, setOpen, handleMouseLeave } = useMouseOut(),
    router = useRouter();

  useEffect(() => {
    const handleResize = () => {
      setCollapsed(window.innerWidth < 1024);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="px-4 py-2">
      <Select open={open} onOpenChange={setOpen} onValueChange={setTheme}>
        <SelectTrigger className="w-full cursor-pointer text-custom-white border-colored bg-transparent">
          <SelectValue placeholder="Select theme" suppressHydrationWarning />
        </SelectTrigger>
        <SelectContent
          className="bg-background text-accent border-colored"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={handleMouseLeave}
          ref={ref}
        >
          <SelectItem value="light" className="cursor-pointer">
            Light
          </SelectItem>
          <SelectItem value="dark" className="cursor-pointer">
            Dark
          </SelectItem>
          <SelectItem value="custom" className="cursor-pointer">
            Custom
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
