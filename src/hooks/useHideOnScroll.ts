import { useEffect, useRef, useState } from 'react';

const HIDE_AFTER_PX = 8;   // ignore sub-pixel jitter and rubber-banding
const REVEAL_DELAY_MS = 150;

/**
 * Returns false while the user is actively scrolling down, true otherwise.
 *
 * The add button is fixed and floats over the content, so at any mid-scroll
 * position it sits on top of whatever happens to be under it -- on the journal
 * tab that is the selected date and the empty-state line. Hiding it while the
 * user scrolls down keeps it out of the way of the thing they are reading, and
 * bringing it straight back on scroll-up or on stop keeps it within reach.
 */
export function useHideOnScroll(): boolean {
  const [visible, setVisible] = useState(true);
  const lastY = useRef(0);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    lastY.current = window.scrollY;

    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;

      if (Math.abs(delta) > HIDE_AFTER_PX) {
        // Near the top there is nothing to collide with, so stay visible.
        setVisible(delta < 0 || y < HIDE_AFTER_PX);
        lastY.current = y;
      }

      // Reappear once scrolling settles, so the button is never far away.
      if (revealTimer.current) clearTimeout(revealTimer.current);
      revealTimer.current = setTimeout(() => setVisible(true), REVEAL_DELAY_MS);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (revealTimer.current) clearTimeout(revealTimer.current);
    };
  }, []);

  return visible;
}
