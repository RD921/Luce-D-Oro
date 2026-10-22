import { useEffect } from 'react';
import { useSite } from '../../context/SiteContext';

// Modo de edição: ativo só quando o site está dentro do editor do painel (iframe da própria loja com ?editor=1).
// Aqui o site apenas AVISA o painel qual elemento foi clicado; quem salva é o painel, com login e permissão do servidor.
export const emModoEditor = (): boolean => {
  try { return window.parent !== window && new URLSearchParams(window.location.search).get('editor') === '1'; } catch { return false; }
};

export function EditorBridge() {
  const { refreshContent } = useSite();
  const ativo = emModoEditor();

  useEffect(() => {
    if (!ativo) return;
    const estilo = document.createElement('style');
    estilo.textContent = `
      [data-edit-key]{outline:1px dashed rgba(197,204,214,.55);outline-offset:3px;cursor:pointer !important;transition:outline-color .15s}
      [data-edit-key]:hover{outline:2px solid #c5ccd6;background:rgba(197,204,214,.08)}
      [data-edit-key].ld-selecionado{outline:2px solid #4ade80 !important}
    `;
    document.head.appendChild(estilo);

    const marcar = (key: string | null) => {
      document.querySelectorAll('.ld-selecionado').forEach(el => el.classList.remove('ld-selecionado'));
      if (key) document.querySelectorAll(`[data-edit-key="${CSS.escape(key)}"]`).forEach(el => el.classList.add('ld-selecionado'));
    };
    const clique = (e: MouseEvent) => {
      const alvo = (e.target as Element | null)?.closest?.('[data-edit-key]');
      if (!alvo) return;
      e.preventDefault(); e.stopPropagation();
      const key = alvo.getAttribute('data-edit-key');
      marcar(key);
      window.parent.postMessage({ tipo: 'ld-editar', key }, window.location.origin);
    };
    const mensagem = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== window.parent) return;
      if (e.data?.tipo === 'ld-atualizar') void refreshContent();
      if (e.data?.tipo === 'ld-marcar') marcar(e.data.key ?? null);
    };
    document.addEventListener('click', clique, true);
    window.addEventListener('message', mensagem);
    window.parent.postMessage({ tipo: 'ld-pronto' }, window.location.origin);
    return () => { document.removeEventListener('click', clique, true); window.removeEventListener('message', mensagem); estilo.remove(); };
  }, [ativo, refreshContent]);

  return null;
}
