"use client";
import { ReactNode } from "react";
import { useStaggerIn, useFadeIn, useCountUp } from "@/lib/animations";

export function StaggerContainer({
  children,
  className,
  delay = 0,
  stagger = 0.06,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  stagger?: number;
}) {
  const ref = useStaggerIn({ delay, stagger });
  return <div ref={ref} className={className}>{children}</div>;
}

export function FadeInBox({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useFadeIn({ delay });
  return <div ref={ref} className={className}>{children}</div>;
}

export function CountUpNumber({
  value,
  className,
  duration = 1,
  formatter,
}: {
  value: number;
  className?: string;
  duration?: number;
  formatter?: (v: number) => string;
}) {
  const ref = useCountUp(value, { duration, formatter });
  return <span ref={ref} className={className}>0</span>;
}
