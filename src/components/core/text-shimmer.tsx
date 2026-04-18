"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import React, { useMemo } from "react";

interface TextShimmerProps {
  children: string;
  as?: React.ElementType;
  className?: string;
  duration?: number;
  spread?: number;
}

export function TextShimmer({
  children,
  as: Component = "p",
  className,
  duration = 2,
  spread = 2,
}: TextShimmerProps) {
  return (
    <Component
      className={cn(
        "relative inline-block bg-[length:250%_100%] bg-clip-text text-transparent underline-offset-4",
        "bg-gradient-to-r from-zinc-500 via-zinc-200 to-zinc-500 dark:from-zinc-400 dark:via-zinc-100 dark:to-zinc-400",
        className
      )}
      style={{
        "--base-color": "var(--zinc-500)",
        "--base-gradient-color": "var(--zinc-200)",
      } as React.CSSProperties}
    >
      <motion.span
        initial={{ backgroundPosition: "-100% 0" }}
        animate={{ backgroundPosition: "100% 0" }}
        transition={{
          repeat: Infinity,
          duration,
          ease: "linear",
        }}
        style={{
          display: "inline-block",
          width: "100%",
          background: "inherit",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
        }}
      >
        {children}
      </motion.span>
    </Component>
  );
}
