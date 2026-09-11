import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useApp } from '../../runtime/store';

/** Fit the most constrained visible bar; all rows retain the same dollars-per-pixel scale. */
export function WalletScale({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const fitScale = useApp(s => s.fitScale);
  const scaleMode = useApp(s => s.scaleMode);
  useLayoutEffect(() => {
    const bars = Array.from(root.current!.querySelectorAll<HTMLElement>('[data-bar-usd]'));
    const fit = () => {
      let limiting = { usd: 0, width: 1 };
      for (const bar of bars) {
        const usd = Number(bar.dataset['barUsd']);
        const width = bar.getBoundingClientRect().width;
        if (width > 0 && usd / width > limiting.usd / limiting.width) limiting = { usd, width };
      }
      fitScale(limiting.usd, limiting.width);
    };
    fit();
    const observer = new ResizeObserver(fit);
    bars.forEach(bar => observer.observe(bar));
    return () => observer.disconnect();
  }, [children, fitScale, scaleMode]);
  return (
    <div ref={root} className="screen wallet-home fade-in">
      {children}
    </div>
  );
}
