import { useEffect, useState } from 'react';
import styles from './IntroSound.module.css';
import { emModoEditor } from '../editor/modo';

// ABERTURA CINEMATOGRÁFICA LUCE D’ORO
// Tela inteira imersiva em fundo preto com animação elegante e transição suave.
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
    }, 700);
  };

  useEffect(() => {
    if (!splash) return;
    document.body.style.overflow = 'hidden';
    const reduz = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // Duração suave para conduzir diretamente à vitrine
    const t = window.setTimeout(encerrar, reduz ? 1200 : 3200);
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
      <div className={styles.fullScreenStage}>
        <img
          src="/images/intro-cinematic.png"
          alt="Luce D'Oro"
          className={styles.fullScreenImage}
          draggable={false}
        />
      </div>
    </div>
  );
}
