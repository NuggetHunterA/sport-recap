// Neu laden beim Zurückkehren in die App und per Herunterziehen.
import { createContext } from 'preact';
import type { ComponentChildren } from 'preact';
import { useContext, useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from './components';

/** `stamp` steigt bei jedem Neuladen; `settled` meldet, dass die sichtbare Ansicht fertig geladen hat. */
export const Refresh = createContext<{ stamp: number; settled: () => void }>({ stamp: 0, settled: () => {} });

/**
 * Lädt bei geänderten `deps` neu (mit Platzhaltern) und bei jedem Neuladen der App (ohne:
 * die bisherigen Daten bleiben stehen, bis die neuen da sind).
 */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const { stamp, settled } = useContext(Refresh);
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  const key = JSON.stringify(deps);
  const last = useRef(key);
  useEffect(() => {
    let alive = true;
    const same = last.current === key;
    last.current = key;
    if (!same) setState({ loading: true });
    load().then(
      (data) => alive && setState({ data, loading: false }),
      (e) => alive && setState({ error: String(e?.message ?? e), loading: false }),
    ).finally(() => alive && settled());
    return () => { alive = false; };
  }, [key, stamp]);
  return state;
}

const PULL = 70;

/** Herunterziehen am Seitenanfang löst `onPull` aus; der Pfeil dreht sich, bis `busy` endet. */
export function PullToRefresh({ onPull, busy, children }: { onPull: () => void; busy: boolean; children: ComponentChildren }) {
  const [pull, setPull] = useState(0);
  const start = useRef<number | null>(null);
  const distance = useRef(0);
  useEffect(() => {
    const down = (e: TouchEvent) => {
      // Nicht im Boxscore-Blatt und nur ganz oben auf der Seite
      const inSheet = (e.target as Element | null)?.closest?.('.sheet-backdrop, .sheet');
      start.current = !busy && !inSheet && window.scrollY <= 0 ? e.touches[0].clientY : null;
      distance.current = 0;
    };
    const move = (e: TouchEvent) => {
      if (start.current === null) return;
      const dy = e.touches[0].clientY - start.current;
      if (dy <= 0 || window.scrollY > 0) { distance.current = 0; setPull(0); return; }
      // Gedämpft, damit sich das Ziehen nach Widerstand anfühlt
      distance.current = Math.min(dy * 0.5, PULL * 1.4);
      setPull(distance.current);
    };
    const up = () => {
      if (start.current !== null && distance.current >= PULL) onPull();
      start.current = null;
      distance.current = 0;
      setPull(0);
    };
    window.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', up);
    window.addEventListener('touchcancel', up);
    return () => {
      window.removeEventListener('touchstart', down);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
      window.removeEventListener('touchcancel', up);
    };
  }, [busy, onPull]);

  const shown = busy || pull > 0;
  return (
    <>
      <div
        class={`pull${busy ? ' busy' : ''}`}
        style={{ transform: `translate(-50%, ${busy ? PULL * 0.8 : pull}px)`, opacity: shown ? 1 : 0, transition: pull > 0 ? 'none' : undefined }}
        role="status"
        aria-label={busy ? 'Wird aktualisiert' : undefined}
      >
        <span style={{ transform: `rotate(${busy ? 0 : Math.min(pull / PULL, 1) * 270}deg)` }}>{Icon.refresh}</span>
      </div>
      {children}
    </>
  );
}
