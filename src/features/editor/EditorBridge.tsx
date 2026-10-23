import { useEffect } from 'react';
import { useSite } from '../../context/SiteContext';
import { emModoEditor } from './modo';

// Modo de edição (só dentro do iframe do editor do painel):
//  • clique num elemento marcado  → avisa o painel qual foi (para editar texto/imagem);
//  • arrastar um elemento marcado → move na hora e avisa o painel a nova posição.
// Quem SALVA é o painel, com login e permissão do servidor. Aqui o site só avisa.
export function EditorBridge() {
  const { refreshContent } = useSite();
  const ativo = emModoEditor();

  useEffect(() => {
    if (!ativo) return;
    const estilo = document.createElement('style');
    estilo.textContent = `
      [data-edit-key]{outline:1px dashed rgba(197,204,214,.55);outline-offset:3px;cursor:grab !important;transition:outline-color .15s;touch-action:none;-webkit-user-drag:none;user-select:none}
      [data-edit-key]:hover{outline:2px solid #c5ccd6;background:rgba(197,204,214,.08)}
      [data-edit-key].ld-selecionado{outline:2px solid #4ade80 !important}
      body.ld-arrastando, body.ld-arrastando *{cursor:grabbing !important;user-select:none !important}
      body.ld-arrastando [data-edit-key].ld-movendo{outline:2px solid #facc15 !important;z-index:50}
    `;
    document.head.appendChild(estilo);

    const celular = () => window.matchMedia('(max-width: 640px)').matches;
    const marcar = (key: string | null) => {
      document.querySelectorAll('.ld-selecionado').forEach(el => el.classList.remove('ld-selecionado'));
      if (key) document.querySelectorAll(`[data-edit-key="${CSS.escape(key)}"]`).forEach(el => el.classList.add('ld-selecionado'));
    };
    const alvoDe = (e: Event) => (e.target as Element | null)?.closest?.('[data-edit-key]') as HTMLElement | null;

    // Largura do bloco onde o elemento está (a posição horizontal é guardada em % dela)
    const larguraDoBloco = (el: HTMLElement) => {
      let p = el.parentElement;
      while (p && getComputedStyle(p).display === 'inline') p = p.parentElement;
      return Math.max(1, p?.clientWidth || window.innerWidth);
    };

    let arrasto: { el: HTMLElement; key: string; x0: number; y0: number; baseX: number; baseY: number; larg: number; moveu: boolean } | null = null;
    let ignorarClique = false;
    const limitar = (n: number, max: number) => Math.max(-max, Math.min(max, n));
    const arred = (n: number) => Math.round(n * 100) / 100;

    const descer = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const el = alvoDe(e);
      if (!el) return;
      e.preventDefault();
      arrasto = {
        el, key: el.getAttribute('data-edit-key') as string, x0: e.clientX, y0: e.clientY,
        baseX: parseFloat(el.style.left) || 0, baseY: parseFloat(el.style.top) || 0, larg: larguraDoBloco(el), moveu: false,
      };
    };
    const mover = (e: PointerEvent) => {
      if (!arrasto) return;
      const dx = e.clientX - arrasto.x0, dy = e.clientY - arrasto.y0;
      if (!arrasto.moveu && Math.hypot(dx, dy) < 4) return;
      if (!arrasto.moveu) { arrasto.moveu = true; document.body.classList.add('ld-arrastando'); arrasto.el.classList.add('ld-movendo'); }
      const x = limitar(arrasto.baseX + (dx / arrasto.larg) * 100, 100);
      const y = limitar(arrasto.baseY + dy, 2000);
      arrasto.el.style.position = 'relative';
      arrasto.el.style.left = `${arred(x)}%`;
      arrasto.el.style.top = `${arred(y)}px`;
    };
    const soltar = () => {
      const a = arrasto; arrasto = null;
      if (!a) return;
      document.body.classList.remove('ld-arrastando'); a.el.classList.remove('ld-movendo');
      if (!a.moveu) return;
      ignorarClique = true; window.setTimeout(() => { ignorarClique = false; }, 0);
      marcar(a.key);
      window.parent.postMessage({ tipo: 'ld-mover', key: a.key, x: arred(parseFloat(a.el.style.left) || 0), y: arred(parseFloat(a.el.style.top) || 0), celular: celular() }, window.location.origin);
    };
    const clique = (e: MouseEvent) => {
      const alvo = alvoDe(e);
      if (!alvo) return;
      e.preventDefault(); e.stopPropagation();
      if (ignorarClique) return;
      const key = alvo.getAttribute('data-edit-key');
      marcar(key);
      window.parent.postMessage({ tipo: 'ld-editar', key }, window.location.origin);
    };
    const bloquearArrastoNativo = (e: Event) => { if (alvoDe(e)) e.preventDefault(); };
    const mensagem = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== window.parent) return;
      if (e.data?.tipo === 'ld-atualizar') void refreshContent();
      if (e.data?.tipo === 'ld-marcar') marcar(e.data.key ?? null);
    };

    document.addEventListener('pointerdown', descer, true);
    document.addEventListener('pointermove', mover, true);
    document.addEventListener('pointerup', soltar, true);
    document.addEventListener('pointercancel', soltar, true);
    document.addEventListener('dragstart', bloquearArrastoNativo, true);
    document.addEventListener('click', clique, true);
    window.addEventListener('message', mensagem);
    window.parent.postMessage({ tipo: 'ld-pronto' }, window.location.origin);
    return () => {
      document.removeEventListener('pointerdown', descer, true);
      document.removeEventListener('pointermove', mover, true);
      document.removeEventListener('pointerup', soltar, true);
      document.removeEventListener('pointercancel', soltar, true);
      document.removeEventListener('dragstart', bloquearArrastoNativo, true);
      document.removeEventListener('click', clique, true);
      window.removeEventListener('message', mensagem);
      estilo.remove();
    };
  }, [ativo, refreshContent]);

  return null;
}
