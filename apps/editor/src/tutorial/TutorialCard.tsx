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
