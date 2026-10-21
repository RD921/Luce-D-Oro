import { useEffect, useState } from 'react';
import styles from './IntroSound.module.css';

// Tela de abertura: logo sobre fundo preto, mostrada uma vez por sessão. Sem som.
const CHAVE_SPLASH = 'ld_intro_done';
const lerSessao = (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } };
const gravarSessao = (k: string, v: string) => { try { sessionStorage.setItem(k, v); } catch { /* */ } };

export function IntroSound(_props: { pausado?: boolean }) {
  const [splash, setSplash] = useState(() => lerSessao(CHAVE_SPLASH) !== '1');

  const encerrar = () => {
    document.body.style.overflow = '';
    gravarSessao(CHAVE_SPLASH, '1');
    setSplash(false);
  };

  useEffect(() => {
    if (!splash) return;
    document.body.style.overflow = 'hidden';
    const reduz = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t = window.setTimeout(encerrar, reduz ? 1500 : 4700);
    return () => { window.clearTimeout(t); document.body.style.overflow = ''; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splash]);

  if (!splash) return null;
  return (
    <div className={styles.splash} role="presentation" onClick={encerrar}>
      <img src="/images/logo-intro.png" alt="Luce d'Oro" className={styles.splashLogo} draggable={false} />
    </div>
  );
}
