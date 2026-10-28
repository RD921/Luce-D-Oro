import { useEffect, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import styles from './IntroSound.module.css';
import { emModoEditor } from '../editor/modo';

// ABERTURA CINEMATOGRÁFICA LUCE D’ORO
// Fundo preto profundo #050304 com iluminação halo rosa,
// partículas luminosas, slogan e botão DESCUBRA com transição suave.
const CHAVE_SPLASH = 'ld_intro_done';
const lerSessao = (k: string) => {
  try {
    return sessionStorage.getItem(k);
  } catch {
    return null;
  }
};
const gravarSessao = (k: string, v: string) => {
  try {
    sessionStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
};

export function IntroSound(_props: { pausado?: boolean }) {
  const [splash, setSplash] = useState(() => lerSessao(CHAVE_SPLASH) !== '1' && !emModoEditor());
  const [fadingOut, setFadingOut] = useState(false);

  const encerrar = () => {
    if (fadingOut) return;
    setFadingOut(true);
    gravarSessao(CHAVE_SPLASH, '1');
    setTimeout(() => {
      document.body.style.overflow = '';
      setSplash(false);
    }, 600);
  };

  useEffect(() => {
    if (!splash) return;
    document.body.style.overflow = 'hidden';
    const reduz = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // Duração de 2.8 a 3.5s para conduzir à vitrine suavemente
    const t = window.setTimeout(encerrar, reduz ? 1200 : 3600);
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splash]);

  if (!splash) return null;

  return (
    <div
      className={`${styles.splash} ${fadingOut ? styles.splashFadeOut : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Apresentação Luce D'Oro"
      onClick={encerrar}
    >
      {/* Halo de iluminação rosa e reflexos de estúdio */}
      <div className={styles.ambientGlow} />
      <div className={styles.reflectionFloor} />

      {/* Partículas luminosas sutis */}
      <div className={styles.particles}>
        <span className={`${styles.particle} ${styles.p1}`} />
        <span className={`${styles.particle} ${styles.p2}`} />
        <span className={`${styles.particle} ${styles.p3}`} />
        <span className={`${styles.particle} ${styles.p4}`} />
        <span className={`${styles.particle} ${styles.p5}`} />
      </div>

      <div className={styles.centerStage}>
        {/* Logo central com feixe de luz perolado */}
        <div className={styles.logoWrapper}>
          <img
            src="/images/intro-cinematic.png"
            alt="Luce D'Oro — Joias que Iluminam Histórias"
            className={styles.splashLogo}
            draggable={false}
          />
          <div className={styles.lightSweep} />
        </div>

        {/* Assinatura da marca */}
        <div className={styles.brandTagline}>
          <span>JOIAS QUE ILUMINAM HISTÓRIAS</span>
        </div>
      </div>

      {/* Indicador minimalista DESCUBRA */}
      <button
        type="button"
        className={styles.discoverBtn}
        onClick={(e) => {
          e.stopPropagation();
          encerrar();
        }}
        aria-label="Avançar diretamente para a vitrine"
      >
        <span className={styles.discoverText}>DESCUBRA</span>
        <ArrowDown size={14} className={styles.discoverArrow} strokeWidth={1.5} />
      </button>
    </div>
  );
}
