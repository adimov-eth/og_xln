import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Icon } from './Icons';
import { useApp } from '../runtime/store';
import { useWallet } from '../runtime/views';
import { TOUR_STEPS, type TourContext } from '../tour/steps';

type Rect = { top: number; left: number; width: number; height: number };
const nodeFor = (id: string): HTMLElement | undefined =>
  [...document.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)].find(node => node.getClientRects().length > 0);
const dom: TourContext['dom'] = {
  has: id => Boolean(nodeFor(id)),
  value: id => (nodeFor(id) as HTMLInputElement | undefined)?.value ?? '',
  text: id => nodeFor(id)?.textContent ?? '',
};

/** Small guidance beside the current control; only the user performs actions. */
export function Tour() {
  const tour = useApp(s => s.tour);
  const setTour = useApp(s => s.setTour);
  const entityId = useApp(s => s.activeEntityId);
  const wallet = useWallet(entityId);
  const { pathname } = useLocation();
  const baseline = useRef(new Map<string, number>());
  const entered = useRef('');
  const card = useRef<HTMLDivElement>(null);
  const [tick, setTick] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [cardHeight, setCardHeight] = useState(150);
  const [menuBottom, setMenuBottom] = useState<number | null>(null);
  const ctx = useMemo(() => ({ wallet, pathname, baseline: baseline.current, dom }), [wallet, pathname]);
  const index = Math.min(tour.index, TOUR_STEPS.length - 1);
  const step = tour.active ? TOUR_STEPS[index] : undefined;
  const target = step?.target(ctx) ?? '';

  useEffect(() => {
    if (!step) {
      entered.current = '';
      return;
    }
    const key = `${wallet.entityId}:${step.id}`;
    if (entered.current !== key) {
      entered.current = key;
      step.enter?.(ctx);
    }
    if (step.done?.(ctx)) setTour({ index: index + 1 });
  }, [step, ctx, index, setTour, tick]);

  useEffect(() => {
    if (!step) return;
    const timer = window.setInterval(() => setTick(value => value + 1), 200);
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTour({ active: false });
    };
    window.addEventListener('keydown', close);
    return () => {
      clearInterval(timer);
      window.removeEventListener('keydown', close);
    };
  }, [step, setTour]);

  useEffect(() => {
    if (!target) {
      setRect(null);
      return;
    }
    const node = nodeFor(target);
    if (!node) {
      setRect(null);
      return;
    }
    const bounds = node.getBoundingClientRect();
    const menu = document.querySelector<HTMLElement>('.picker-menu');
    setMenuBottom(menu && menu.getClientRects().length > 0 ? menu.getBoundingClientRect().bottom : null);
    const next = { top: bounds.top - 6, left: bounds.left - 6, width: bounds.width + 12, height: bounds.height + 12 };
    setRect(previous =>
      previous && Object.keys(next).every(key => previous[key as keyof Rect] === next[key as keyof Rect])
        ? previous
        : next,
    );
    if (card.current) setCardHeight(card.current.offsetHeight);
  }, [target, tick]);

  useEffect(() => {
    if (!target) return;
    nodeFor(target)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [target]);

  if (!step) return null;
  const width = Math.min(320, window.innerWidth - 24);
  const left = rect
    ? Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))
    : window.innerWidth - width - 12;
  const below = rect ? Math.max(rect.top + rect.height, menuBottom ?? 0) + 14 : 24;
  const above = rect ? rect.top - cardHeight - 14 : -1;
  const fitsAbove = above >= 12;
  const fitsBelow = below + cardHeight <= window.innerHeight - 12;
  const top = fitsAbove && (menuBottom !== null || !fitsBelow) ? above : below;
  const menuNeedsSpace = menuBottom !== null && !fitsAbove && !fitsBelow;
  const finish = step.id === 'finish';
  return (
    <div className="tour" data-testid="tour" data-step={step.id} data-target={target}>
      {rect && <div className="tour-ring" style={rect} />}
      <div
        ref={card}
        className="tour-card anchored"
        style={{
          left,
          top,
          width,
          right: 'auto',
          bottom: 'auto',
          pointerEvents: 'none',
          visibility: menuNeedsSpace ? 'hidden' : 'visible',
        }}
        role="status"
        aria-live="polite"
      >
        <div className="tour-head">
          <span className="tour-kicker">{Math.min(index + 1, 4)} / 4</span>
          <button
            type="button"
            className="icon-btn"
            aria-label="Exit the tour"
            data-testid="tour-exit"
            style={{ pointerEvents: 'auto' }}
            onClick={() => setTour({ active: false })}
          >
            <Icon name="close" size={14} />
          </button>
        </div>
        <h2 className="tour-title">{step.title}</h2>
        <p className="tour-body" data-testid="tour-hint">
          {step.instruction(ctx)}
        </p>
        {finish && (
          <button
            type="button"
            className="btn primary sm"
            data-testid="tour-next"
            style={{ pointerEvents: 'auto' }}
            onClick={() => setTour({ active: false, index: 0, completed: true })}
          >
            Finish
          </button>
        )}
      </div>
    </div>
  );
}
