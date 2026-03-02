import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Stagger-animate children on mount (cards, list items, etc.)
 */
export function useStaggerIn(containerRef: React.RefObject<HTMLElement | null>, selector = ":scope > *", deps: unknown[] = []) {
  useEffect(() => {
    if (!containerRef.current) return;
    const children = containerRef.current.querySelectorAll(selector);
    if (children.length === 0) return;

    gsap.fromTo(
      children,
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration: 0.4,
        stagger: 0.08,
        ease: "power2.out",
        clearProps: "all",
      }
    );
  }, deps);
}

/**
 * Animate a number counting up from 0 to target value
 */
export function useCountUp(
  elementRef: React.RefObject<HTMLElement | null>,
  targetValue: number,
  deps: unknown[] = []
) {
  useEffect(() => {
    if (!elementRef.current || targetValue === 0) return;

    const obj = { val: 0 };
    gsap.to(obj, {
      val: targetValue,
      duration: 1.2,
      ease: "power2.out",
      onUpdate: () => {
        if (elementRef.current) {
          elementRef.current.textContent = obj.val.toLocaleString("ru-RU", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        }
      },
    });
  }, deps);
}

/**
 * Fade-slide element in on mount
 */
export function useFadeIn(ref: React.RefObject<HTMLElement | null>, delay = 0, deps: unknown[] = []) {
  useEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(
      ref.current,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.5, delay, ease: "power2.out", clearProps: "all" }
    );
  }, deps);
}

/**
 * ScrollTrigger: animate children as they enter viewport
 */
export function useScrollReveal(containerRef: React.RefObject<HTMLElement | null>, selector = ":scope > *") {
  useEffect(() => {
    if (!containerRef.current) return;
    const children = containerRef.current.querySelectorAll(selector);
    if (children.length === 0) return;

    children.forEach((child) => {
      gsap.fromTo(
        child,
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          ease: "power2.out",
          clearProps: "all",
          scrollTrigger: {
            trigger: child,
            start: "top 92%",
            toggleActions: "play none none none",
          },
        }
      );
    });

    return () => {
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);
}
