import { emModoEditor } from '../features/editor/modo';

// Site que o painel está editando agora (cada site tem conteúdo, imagens e SEO próprios).
// Dentro do editor visual, o site vem do endereço do iframe (?site=...).
export const SITE_PRINCIPAL = 'luce-d-oro';
const CHAVE = 'ld_site_admin';

export function siteAtual(): string {
  try {
    if (emModoEditor()) return new URLSearchParams(window.location.search).get('site') || SITE_PRINCIPAL;
    return sessionStorage.getItem(CHAVE) || SITE_PRINCIPAL;
  } catch { return SITE_PRINCIPAL; }
}
export function definirSiteAtual(id: string) {
  try { if (id === SITE_PRINCIPAL) sessionStorage.removeItem(CHAVE); else sessionStorage.setItem(CHAVE, id); } catch { /* sem armazenamento */ }
}
