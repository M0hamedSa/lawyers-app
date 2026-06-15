"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

type AnimationOptions = {
  delay?: number;
  duration?: number;
  stagger?: number;
};

/**
 * Staggers children of a container fading/sliding in from below.
 */
export function useStaggerIn(options: AnimationOptions = {}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    const el = ref.current;
    if (!el || el.children.length === 0) return;
    const { delay = 0, duration = 0.5, stagger = 0.06 } = optsRef.current;
    const children = Array.from(el.children);
    gsap.fromTo(
      children,
      { opacity: 0 },
      { opacity: 1, duration, stagger, delay, ease: "power2.out" }
    );
  }, []);

  return ref;
}

/**
 * Animates a single element fading in.
 */
export function useFadeIn(options: AnimationOptions = {}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { delay = 0, duration = 0.5 } = optsRef.current;
    gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration, delay, ease: "power2.out" });
  }, []);

  return ref;
}

/**
 * Counts up from 0 to a target number, updating the element's inner text.
 */
export function useCountUp(
  value: number,
  options: { duration?: number; delay?: number; formatter?: (v: number) => string } = {}
) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { duration = 1, delay = 0.2, formatter } = optsRef.current;
    const obj = { val: 0 };
    gsap.to(obj, {
      val: value,
      duration,
      delay,
      ease: "power2.out",
      onUpdate: () => {
        const rounded = Math.round(obj.val);
        el.textContent = formatter ? formatter(rounded) : rounded.toLocaleString();
      },
    });
  }, [value]);

  return ref;
}

/**
 * Applies a subtle scale-up on hover to any element.
 */
export function useScaleHover<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onEnter = () => gsap.to(el, { scale: 1.03, duration: 0.2, ease: "power1.out", transformOrigin: "center center" });
    const onLeave = () => gsap.to(el, { scale: 1, duration: 0.2, ease: "power1.out" });
    el.addEventListener("mouseenter", onEnter);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mouseenter", onEnter);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return ref;
}
