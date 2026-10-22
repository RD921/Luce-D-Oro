import { useEffect, useState } from 'react';
import { api } from '../../services/api';

// Aplica título, descrição, compartilhamento (Open Graph) e "ocultar dos buscadores" conforme Configurações → SEO.
// Observação: a loja é de página única; buscadores como o Google executam o JavaScript e leem estes dados,
// mas prévias de WhatsApp/Instagram leem só o HTML inicial.
type Seo = { title: string; description: string; ogImage: string; siteUrl: string; noindex: boolean; categoryTitle: string };

function meta(attr: 'name' | 'property', chave: string, valor: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${chave}"]`);
  if (!valor) { el?.remove(); return; }
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, chave); document.head.appendChild(el); }
  el.setAttribute('content', valor);
}

export function SeoHead({ categoriaNome }: { categoriaNome?: string }) {
  const [seo, setSeo] = useState<Seo | null>(null);
  useEffect(() => { api.seo.get().then(setSeo).catch(() => {}); }, []);

  useEffect(() => {
    if (!seo) return;
    const titulo = categoriaNome ? seo.categoryTitle.replace('{categoria}', categoriaNome) : seo.title;
    document.title = titulo;
    meta('name', 'description', seo.description);
    meta('name', 'robots', seo.noindex ? 'noindex, nofollow' : '');
    meta('property', 'og:type', 'website');
    meta('property', 'og:title', titulo);
    meta('property', 'og:description', seo.description);
    const img = seo.ogImage ? (seo.ogImage.startsWith('/') && seo.siteUrl ? seo.siteUrl.replace(/\/$/, '') + seo.ogImage : seo.ogImage) : '';
    meta('property', 'og:image', img);
    meta('name', 'twitter:card', img ? 'summary_large_image' : 'summary');
    let canon = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (seo.siteUrl) {
      if (!canon) { canon = document.createElement('link'); canon.rel = 'canonical'; document.head.appendChild(canon); }
      canon.href = seo.siteUrl;
    } else canon?.remove();
  }, [seo, categoriaNome]);
  return null;
}
