import { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import styles from './IntroSound.module.css';

// Tela de abertura (logo sobre fundo preto) + trilha sonora instrumental.
// Os navegadores só liberam som depois de um toque/clique da pessoa: a música começa no primeiro gesto
// e vem com entrada suave. A pessoa pode silenciar no botão (a escolha fica salva).
const INTRO_SEGUNDOS = 8; // quando o trecho em loop entra
const VOLUME = 0.32;
const CHAVE_SOM = 'ld_sound';
const CHAVE_SPLASH = 'ld_intro_done';

const ler = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const gravar = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* */ } };
const lerSessao = (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } };
const gravarSessao = (k: string, v: string) => { try { sessionStorage.setItem(k, v); } catch { /* */ } };

function extensao(): 'ogg' | 'mp3' {
  try {
    const a = document.createElement('audio');
    return a.canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'mp3';
  } catch { return 'mp3'; }
}

export function IntroSound({ pausado = false }: { pausado?: boolean }) {
  const [splash, setSplash] = useState(() => lerSessao(CHAVE_SPLASH) !== '1');
  const [mudo, setMudo] = useState(() => ler(CHAVE_SOM) === 'off');
  const [suportado] = useState(() => typeof window !== 'undefined' && Boolean(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext));

  const ctxRef = useRef<AudioContext | null>(null);
  const ganhoRef = useRef<GainNode | null>(null);
  const bufsRef = useRef<{ intro: AudioBuffer; loop: AudioBuffer } | null>(null);
  const tocandoRef = useRef(false);
  const mudoRef = useRef(mudo);
  const pausadoRef = useRef(pausado);
  mudoRef.current = mudo;
  pausadoRef.current = pausado;

  // Fim da tela de abertura
  useEffect(() => {
    if (!splash) return;
    document.body.style.overflow = 'hidden';
    const reduz = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t = window.setTimeout(() => encerrarSplash(), reduz ? 1500 : 4700);
    function encerrarSplash() {
      document.body.style.overflow = '';
      gravarSessao(CHAVE_SPLASH, '1');
      setSplash(false);
    }
    return () => { window.clearTimeout(t); document.body.style.overflow = ''; };
  }, [splash]);

  // Pré-carrega os dois trechos (sem tocar nada)
  useEffect(() => {
    if (!suportado) return;
    let vivo = true;
    const ext = extensao();
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    ctxRef.current = ctx;
    const ganho = ctx.createGain();
    ganho.gain.value = 0;
    ganho.connect(ctx.destination);
    ganhoRef.current = ganho;

    const baixar = async (nome: string) => {
      const r = await fetch(`/audio/${nome}.${ext}`);
      if (!r.ok) throw new Error('áudio indisponível');
      return ctx.decodeAudioData(await r.arrayBuffer());
    };
    Promise.all([baixar('luce-intro'), baixar('luce-loop')])
      .then(([intro, loop]) => { if (vivo) { bufsRef.current = { intro, loop }; tentarTocar(); } })
      .catch(() => { /* sem áudio: a loja funciona normalmente */ });

    return () => { vivo = false; void ctx.close().catch(() => {}); ctxRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suportado]);

  const ajustarVolume = useCallback((alvo: number, segundos: number) => {
    const ctx = ctxRef.current; const g = ganhoRef.current;
    if (!ctx || !g) return;
    const agora = ctx.currentTime;
    g.gain.cancelScheduledValues(agora);
    g.gain.setValueAtTime(g.gain.value, agora);
    g.gain.linearRampToValueAtTime(alvo, agora + segundos);
  }, []);

  const iniciar = useCallback(() => {
    const ctx = ctxRef.current; const b = bufsRef.current; const g = ganhoRef.current;
    if (!ctx || !b || !g || tocandoRef.current) return;
    tocandoRef.current = true;
    const t0 = ctx.currentTime + 0.1;
    const s1 = ctx.createBufferSource(); s1.buffer = b.intro; s1.connect(g); s1.start(t0);
    const s2 = ctx.createBufferSource(); s2.buffer = b.loop; s2.loop = true; s2.loopStart = 0; s2.loopEnd = b.loop.duration; s2.connect(g);
    s2.start(t0 + INTRO_SEGUNDOS);
    g.gain.cancelScheduledValues(ctx.currentTime);
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(VOLUME, ctx.currentTime + 3);
  }, []);

  // Só toca depois de um gesto da pessoa, se ela não silenciou
  const tentarTocar = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx || mudoRef.current || pausadoRef.current || !bufsRef.current || !gestoRef.current) return;
    void ctx.resume().then(() => { if (!mudoRef.current && !pausadoRef.current) iniciar(); });
  }, [iniciar]);

  const gestoRef = useRef(false);
  useEffect(() => {
    const aoGesto = () => {
      gestoRef.current = true;
      tentarTocar();
      if (bufsRef.current || mudoRef.current) remover();
    };
    const eventos = ['pointerdown', 'keydown', 'touchend', 'click'] as const;
    const remover = () => eventos.forEach((e) => window.removeEventListener(e, aoGesto));
    eventos.forEach((e) => window.addEventListener(e, aoGesto, { passive: true }));
    return remover;
  }, [tentarTocar]);

  // Mudo / painel aberto / aba escondida
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx || !tocandoRef.current) { tentarTocar(); return; }
    if (mudo || pausado) {
      ajustarVolume(0, 0.6);
      const t = window.setTimeout(() => { if (mudoRef.current || pausadoRef.current) void ctx.suspend().catch(() => {}); }, 700);
      return () => window.clearTimeout(t);
    }
    void ctx.resume().then(() => ajustarVolume(VOLUME, 1.5));
  }, [mudo, pausado, ajustarVolume, tentarTocar]);

  useEffect(() => {
    const aoMudarAba = () => {
      const ctx = ctxRef.current;
      if (!ctx || !tocandoRef.current) return;
      if (document.hidden) void ctx.suspend().catch(() => {});
      else if (!mudoRef.current && !pausadoRef.current) void ctx.resume().catch(() => {});
    };
    document.addEventListener('visibilitychange', aoMudarAba);
    return () => document.removeEventListener('visibilitychange', aoMudarAba);
  }, []);

  const alternar = () => {
    const novo = !mudo;
    setMudo(novo);
    gravar(CHAVE_SOM, novo ? 'off' : 'on');
    if (!novo) gestoRef.current = true;
  };

  return (
    <>
      {splash && (
        <div className={styles.splash} role="presentation" onClick={() => { document.body.style.overflow = ''; gravarSessao(CHAVE_SPLASH, '1'); setSplash(false); }}>
          <img src="/images/logo-intro.png" alt="Luce d'Oro" className={styles.splashLogo} draggable={false} />
        </div>
      )}
      {suportado && !pausado && (
        <button type="button" className={styles.toggle} onClick={alternar} aria-label={mudo ? 'Ativar trilha sonora' : 'Silenciar trilha sonora'} title={mudo ? 'Ativar trilha sonora' : 'Silenciar trilha sonora'}>
          {mudo ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      )}
    </>
  );
}
