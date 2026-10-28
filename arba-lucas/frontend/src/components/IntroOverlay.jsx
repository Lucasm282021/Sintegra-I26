import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Intro institucional del módulo ARBA (video /intro-arba.mp4).
 *
 * - Se muestra una vez por sesión del navegador al ingresar al módulo
 *   (no interrumpe en cada recarga; vuelve a aparecer en una nueva visita).
 * - Arranca silenciada (requisito de autoplay de los navegadores); se puede activar el audio.
 * - Se omite con el botón, Esc o Enter, y se cierra sola al terminar.
 * - Con "movimiento reducido" activado no se reproduce automáticamente.
 * - Puede volver a verse desde el botón "Ver intro" del Topbar.
 */

const SEEN_KEY = 'arba_lucas_intro_seen';
const VIDEO_SRC = '/intro-arba.mp4';
const EXIT_MS = 550;

export function shouldShowIntro() {
  try {
    return sessionStorage.getItem(SEEN_KEY) !== '1';
  } catch {
    return true;
  }
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export default function IntroOverlay({ onClose }) {
  const videoRef = useRef(null);
  const skipRef = useRef(null);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [awaitingPlay, setAwaitingPlay] = useState(prefersReducedMotion);

  const close = useCallback(() => {
    if (exiting) return;
    try {
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* almacenamiento no disponible: se ignora */
    }
    videoRef.current?.pause();
    setExiting(true);
    setTimeout(onClose, EXIT_MS);
  }, [exiting, onClose]);

  // Autoplay (salvo movimiento reducido) y foco inicial accesible
  useEffect(() => {
    skipRef.current?.focus();
    if (awaitingPlay) return;
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.muted = true;
    v.play().catch(() => setAwaitingPlay(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Atajos de teclado
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  // Bloquear scroll del fondo mientras la intro está abierta
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handlePlay = () => {
    setAwaitingPlay(false);
    videoRef.current?.play().catch(close);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (v?.duration) setProgress((v.currentTime / v.duration) * 100);
  };

  return (
    <div
      className={`intro-overlay ${exiting ? 'intro-exit' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Intro del módulo ARBA"
    >
      <div className="intro-glow" aria-hidden="true" />

      <div className="intro-stage">
        <video
          ref={videoRef}
          className="intro-video"
          src={VIDEO_SRC}
          muted={muted}
          playsInline
          preload="auto"
          onTimeUpdate={handleTimeUpdate}
          onEnded={close}
          onError={close}
        />

        {awaitingPlay && (
          <div className="intro-play-gate">
            <img src="/logo-arba.png" alt="ARBA · Impuestos Provinciales" className="intro-gate-logo" />
            <button id="btn-intro-play" className="intro-play-btn" onClick={handlePlay}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <polygon points="6 4 20 12 6 20 6 4" />
              </svg>
              Reproducir intro
            </button>
          </div>
        )}
      </div>

      <div className="intro-controls">
        <button
          id="btn-intro-sound"
          className="intro-ctrl"
          onClick={toggleMute}
          aria-label={muted ? 'Activar sonido' : 'Silenciar'}
          disabled={awaitingPlay}
        >
          {muted ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          )}
          <span>{muted ? 'Sonido' : 'Silenciar'}</span>
        </button>

        <button id="btn-intro-skip" ref={skipRef} className="intro-skip" onClick={close}>
          Entrar al módulo
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      <div className="intro-progress" aria-hidden="true">
        <div className="intro-progress-bar" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
