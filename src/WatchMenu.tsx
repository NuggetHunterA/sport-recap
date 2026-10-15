import { useEffect, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { fullGameLink, loadWatchLinks, serviceName } from './watch';
import type { WatchLinks } from './watch';
import type { Game } from './types';

const play = <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg>;

function ServiceLogo({ game }: { game: Game }) {
  return <span class={`svc-logo ${game.league.toLowerCase()}`} aria-hidden="true">{game.league === 'NBA' ? 'LP' : 'TV'}</span>;
}

/**
 * Runder Play-Knopf mit Menü: Highlights und ganzes Spiel. Das Menü liegt über einem Schleier,
 * ein Tipp daneben schließt nur das Menü und erreicht kein Ergebnis darunter.
 */
export function WatchButton({ game }: { game: Game }) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [links, setLinks] = useState<WatchLinks | null>(null);
  const open = anchor !== null;

  useEffect(() => {
    if (!open || links) return;
    let alive = true;
    loadWatchLinks(game).then((l) => alive && setLinks(l));
    return () => { alive = false; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setAnchor(null);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('scroll', close, { passive: true });
    window.addEventListener('resize', close);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('scroll', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', key);
    };
  }, [open]);

  const toggle = (e: MouseEvent) => {
    e.stopPropagation();
    setAnchor(open ? null : (e.currentTarget as HTMLElement).getBoundingClientRect());
  };

  return (
    <>
      <button type="button" class={`play-btn${open ? ' active' : ''}`} aria-label="Spiel ansehen" aria-haspopup="menu" aria-expanded={open} onClick={toggle}>{play}</button>
      {anchor && createPortal(
        <div class="watch-layer" onClick={() => setAnchor(null)}>
          <div class="watch-menu" role="menu" style={{ top: anchor.bottom + 8, right: Math.max(12, window.innerWidth - anchor.right) }}
            onClick={(e) => e.stopPropagation()}>
            {!links && <div class="watch-note">Suche Links …</div>}
            {links?.highlights && (
              <a role="menuitem" href={links.highlights} target="_blank" rel="noopener" onClick={() => setAnchor(null)}>
                <span class="yt-logo" aria-hidden="true">{play}</span>
                <span><b>Highlights</b><small>YouTube · @{game.league}</small></span>
              </a>
            )}
            {links?.full && (
              <a role="menuitem" href={links.full} target="_blank" rel="noopener" onClick={() => setAnchor(null)}>
                <ServiceLogo game={game} />
                <span><b>Ganzes Spiel</b><small>{serviceName(game)}</small></span>
              </a>
            )}
            {links && !links.highlights && !links.full && <div class="watch-note">Noch keine Links verfügbar.</div>}
            {links?.problem && <div class="watch-note small">{links.problem}</div>}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/** Link zum laufenden Spiel. Solange er lädt oder fehlt, bleibt das Live-Feld ohne Link. */
export function useLiveLink(game: Game): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (game.state !== 'in') return;
    let alive = true;
    fullGameLink(game).then((u) => alive && setUrl(u));
    return () => { alive = false; };
  }, [game.id, game.state]);
  return url;
}
