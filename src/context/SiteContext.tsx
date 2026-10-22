import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, type Category, type Banner } from '../services/api';
import { emModoEditor } from '../features/editor/modo';
import { CONTENT_DEFAULTS, CONTATO_PADRAO } from '../content/siteContentDefaults';

// Categorias padrão: usadas só se o servidor ainda não respondeu (a loja nunca fica sem menu).
const CATEGORIAS_PADRAO: Category[] = [
  { id: 'pulseiras', name: 'Pulseiras', slug: 'pulseiras', description: 'Elegância e presença esculpidas em ouro nobre e design atemporal.', image_url: '/images/category-pulseiras.jpg' },
  { id: 'correntes', name: 'Correntes', slug: 'correntes', description: 'Elo por elo, sofisticação discreta para compor produções memoráveis.', image_url: '/images/category-correntes.jpg' },
  { id: 'brincos', name: 'Brincos', slug: 'brincos', description: 'O brilho sutil do ouro para iluminar a expressão com leveza e magnetismo.', image_url: '/images/category-brincos.jpg' },
];

interface SiteContextValue {
  categories: Category[];
  categoriesLoaded: boolean;
  refreshCategories: () => Promise<void>;
  /** Texto/imagem editável da loja (usa o padrão se nada foi trocado no painel) */
  c: (key: string) => string;
  /** Banner principal (o primeiro ativo, na ordem do painel) */
  heroBanner: Banner | null;
  /** Configurações da loja (aba Configurações do painel) */
  settings: Record<string, string>;
  contato: { email: string; whatsapp: string; cnpj: string; instagram: string; endereco: string };
  refreshContent: () => Promise<void>;
}

const SiteContext = createContext<SiteContextValue | null>(null);

export function SiteProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<Category[]>(CATEGORIAS_PADRAO);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);

  const [content, setContent] = useState<Record<string, string>>(CONTENT_DEFAULTS);
  const [heroBanner, setHeroBanner] = useState<Banner | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});

  const refreshContent = useCallback(async () => {
    // Dentro do editor, o site mostra o rascunho; fora dele, só o que está publicado.
    const conteudo = emModoEditor() ? api.admin.getContentPreview().catch(() => api.content.get()) : api.content.get();
    const [cont, bans, sets] = await Promise.allSettled([conteudo, api.banners.list(), api.settings.get()]);
    if (cont.status === 'fulfilled' && cont.value) setContent({ ...CONTENT_DEFAULTS, ...cont.value });
    if (bans.status === 'fulfilled' && Array.isArray(bans.value)) setHeroBanner(bans.value[0] || null);
    if (sets.status === 'fulfilled' && sets.value) setSettings(sets.value);
  }, []);

  const refreshCategories = useCallback(async () => {
    try {
      const lista = await api.catalog.getCategories();
      if (Array.isArray(lista) && lista.length > 0) setCategories(lista);
    } catch {
      /* mantém as categorias atuais se o servidor não responder */
    } finally {
      setCategoriesLoaded(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshCategories();
    void refreshContent();
  }, [refreshCategories, refreshContent]);

  const value = useMemo<SiteContextValue>(() => {
    const c = (key: string) => content[key] ?? CONTENT_DEFAULTS[key] ?? '';
    // As Configurações usam nomes novos (store_*), mas lojas antigas têm os nomes antigos (contact_*): aceita os dois.
    const pega = (...chaves: string[]) => chaves.map((k) => (settings[k] || '').trim()).find(Boolean) || '';
    const contato = {
      email: pega('store_email', 'contact_email') || CONTATO_PADRAO.email,
      whatsapp: pega('store_phone', 'contact_whatsapp', 'contact_phone') || CONTATO_PADRAO.whatsapp,
      cnpj: pega('store_cnpj') || CONTATO_PADRAO.cnpj,
      instagram: pega('store_instagram', 'instagram'),
      endereco: pega('store_address'),
    };
    return { categories, categoriesLoaded, refreshCategories, c, heroBanner, settings, contato, refreshContent };
  }, [categories, categoriesLoaded, refreshCategories, content, heroBanner, settings, refreshContent]);
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSite(): SiteContextValue {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error('useSite deve ser usado dentro de <SiteProvider>');
  return ctx;
}
