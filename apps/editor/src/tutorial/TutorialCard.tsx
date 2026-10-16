import { useEffect, useState } from 'react';
import { useT } from '../state/settings';
import { TUTORIAL_STEPS } from './steps';
import { goToStep, stopTutorial, useTutorial } from './useTutorial';

interface Spot {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** Position of the part of the editor a step points at (re-measured while the step is shown). */
function useSpot(selector: string | null): Spot | null {
  const [spot, setSpot] = useState<Spot | null>(null);
  useEffect(() => {
    if (!selector) return;
    const measure = (): void => {
      const element = document.querySelector(selector);
      if (!element) {
        setSpot(null);
        return;
      }
      const rect = element.getBoundingClientRect();
      setSpot({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    };
    measure();
    const timer = window.setInterval(measure, 500);
    window.addEventListener('resize', measure);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('resize', measure);
    };
  }, [selector]);
  return selector ? spot : null;
}

const CARD_WIDTH = 340;
const CARD_HEIGHT = 230;
const MARGIN = 16;
const TOP = 90;

/** The corner that does not cover the framed part of the editor (bottom right if none does). */
function cornerFor(spot: Spot | null): {
  right?: number;
  left?: number;
  top?: number;
  bottom?: number;
} {
  const corners = [
    { right: MARGIN, bottom: MARGIN },
    { left: MARGIN, bottom: MARGIN },
    { right: MARGIN, top: TOP },
    { left: MARGIN, top: TOP },
  ];
  if (!spot) return corners[0] ?? {};
  const fits = (corner: (typeof corners)[number]): boolean => {
    const left = corner.left ?? window.innerWidth - CARD_WIDTH - (corner.right ?? 0);
    const top = corner.top ?? window.innerHeight - CARD_HEIGHT - (corner.bottom ?? 0);
    return (
      left + CARD_WIDTH < spot.left ||
      left > spot.left + spot.width ||
      top + CARD_HEIGHT < spot.top ||
      top > spot.top + spot.height
    );
  };
  return corners.find(fits) ?? corners[0] ?? {};
}

/**
 * The tutorial card: a small window in the corner that says what to do next and frames the part
 * of the editor it means. It never blocks the editor; every step also has "Next".
 */
export function TutorialCard() {
  const t = useT();
  const active = useTutorial((state) => state.active);
  const index = useTutorial((state) => state.index);
  const step = TUTORIAL_STEPS[index];
  const spot = useSpot(active && step ? step.target : null);
  if (!active || !step) return null;
  const last = index === TUTORIAL_STEPS.length - 1;
  return (
    <>
      {spot && (
        <div
          className="tutorial-spot"
          aria-hidden="true"
          data-testid="tutorial-spot"
          style={{
            left: spot.left - 3,
            top: spot.top - 3,
            width: spot.width + 6,
            height: spot.height + 6,
          }}
        />
      )}
      <aside
        className="tutorial-card"
        role="region"
        aria-labelledby="tutorial-title"
        data-testid="tutorial-card"
        data-step={step.id}
        style={cornerFor(spot)}
      >
        <p className="tutorial-progress" data-testid="tutorial-progress">
          {t('tutorial.progress', {
            current: String(index + 1),
            total: String(TUTORIAL_STEPS.length),
          })}
        </p>
        <h2 id="tutorial-title">{t(step.title)}</h2>
        <p aria-live="polite">{t(step.body)}</p>
        <div className="tutorial-buttons">
          <button type="button" onClick={stopTutorial} data-testid="tutorial-close">
            {t('tutorial.close')}
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => goToStep(index + 1)}
            data-testid="tutorial-next"
          >
            {last ? t('tutorial.done') : t('tutorial.next')}
          </button>
        </div>
      </aside>
    </>
  );
}
