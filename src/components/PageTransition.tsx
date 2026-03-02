import { useRef, useEffect, useState, type ReactNode } from "react";
import gsap from "gsap";
import { useLocation } from "react-router-dom";

interface PageTransitionProps {
  children: ReactNode;
}

const PageTransition = ({ children }: PageTransitionProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const [displayChildren, setDisplayChildren] = useState(children);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      // First render — just animate in
      isFirstRender.current = false;
      if (containerRef.current) {
        gsap.fromTo(
          containerRef.current,
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" }
        );
      }
      return;
    }

    // Route changed — animate out, swap, animate in
    const el = containerRef.current;
    if (!el) return;

    gsap.to(el, {
      opacity: 0,
      y: -8,
      duration: 0.15,
      ease: "power2.in",
      onComplete: () => {
        setDisplayChildren(children);
        gsap.fromTo(
          el,
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" }
        );
      },
    });
  }, [location.pathname]);

  // Update children when they change but route stays the same
  useEffect(() => {
    setDisplayChildren(children);
  }, [children]);

  return (
    <div ref={containerRef}>
      {displayChildren}
    </div>
  );
};

export default PageTransition;
