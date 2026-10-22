import React from 'react';

export default function IntroScreen({ onComplete }) {
  return (
    <main className="intro-screen" aria-label="Presentación de Sintegra I26">
      <video
        className="intro-video"
        src="/intro-arba.mp4"
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={onComplete}
        onError={onComplete}
        aria-label="Animación de presentación"
      />
      <button className="intro-skip" type="button" onClick={onComplete}>
        Omitir intro
      </button>
    </main>
  );
}
