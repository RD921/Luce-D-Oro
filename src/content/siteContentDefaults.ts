// Textos e imagens da loja que o proprietário pode trocar pelo painel (aba "Conteúdo").
// Este arquivo é a ÚNICA fonte dos valores padrão: o site e o servidor leem daqui.
// Não importe nada neste arquivo (ele é usado pelos dois lados).

export type ContentType = 'text' | 'textarea' | 'image' | 'position';

export interface ContentField {
  key: string;
  label: string;
  group: string;
  type: ContentType;
  def: string;
}

const CAMPOS_BASE: ContentField[] = [
  // ---- Identidade visual e imagens padrão ----
  { key: 'logo_header', group: 'Identidade visual', label: 'Logo do cabeçalho', type: 'image', def: '/images/logo-crop.png' },
  { key: 'logo_footer', group: 'Identidade visual', label: 'Logo do rodapé', type: 'image', def: '/images/logo-crop.png' },
  { key: 'logo_signature', group: 'Identidade visual', label: 'Logo da assinatura (manifesto)', type: 'image', def: '/images/logo-header.png' },
  { key: 'hero_fallback', group: 'Imagens padrão', label: 'Imagem da faixa principal (quando não há banner ativo)', type: 'image', def: '/images/hero-luce-d-oro.png' },
  { key: 'category_banner_fallback', group: 'Imagens padrão', label: 'Imagem de topo das categorias (quando a categoria não tem foto)', type: 'image', def: '/images/hero-editorial.jpg' },

  // ---- Página inicial: coleções e destaques ----
  { key: 'collections_tag', group: 'Página inicial — Coleções', label: 'Etiqueta acima do título', type: 'text', def: "UNIVERSO LUCE D'ORO" },
  { key: 'collections_title', group: 'Página inicial — Coleções', label: 'Título', type: 'text', def: 'Nossas Coleções' },
  { key: 'featured_tag', group: 'Página inicial — Destaques', label: 'Etiqueta acima do título', type: 'text', def: 'SELEÇÃO EDITORIAL' },
  { key: 'featured_title', group: 'Página inicial — Destaques', label: 'Título', type: 'text', def: 'Joias em Destaque' },

  // ---- Página inicial: materiais ----
  { key: 'materials_image', group: 'Página inicial — Materiais', label: 'Imagem da seção Materiais', type: 'image', def: '/images/materials-macro.jpg' },
  { key: 'materials_pill', group: 'Página inicial — Materiais', label: 'Selo sobre a imagem', type: 'text', def: 'Atelier de Ourivesaria' },
  { key: 'materials_tag', group: 'Página inicial — Materiais', label: 'Etiqueta acima do título', type: 'text', def: 'RIGOR E MATÉRIA-PRIMA' },
  { key: 'materials_title', group: 'Página inicial — Materiais', label: 'Título', type: 'text', def: 'A Pureza do Ouro 18k e a Mestria do Acabamento' },
  { key: 'materials_lead', group: 'Página inicial — Materiais', label: 'Texto de apresentação', type: 'textarea', def: "Cada joia Luce D'Oro recebe 10 milésimos de Ouro 18k sobre liga nobre sem níquel, blindada com verniz nanocerâmico suíço que assegura brilho inalterado e toque aveludado na pele." },
  { key: 'spec1_title', group: 'Página inicial — Materiais', label: 'Diferencial 1 — título', type: 'text', def: '10 Milésimos de Ouro 18k' },
  { key: 'spec1_desc', group: 'Página inicial — Materiais', label: 'Diferencial 1 — descrição', type: 'textarea', def: 'Camada de altíssima espessura que confere a densidade e o tom caloroso do ouro puro.' },
  { key: 'spec2_title', group: 'Página inicial — Materiais', label: 'Diferencial 2 — título', type: 'text', def: 'Verniz Suíço Nanotecnológico' },
  { key: 'spec2_desc', group: 'Página inicial — Materiais', label: 'Diferencial 2 — descrição', type: 'textarea', def: 'Proteção invisível contra oxidação e suor, 100% hipoalergênica e livre de níquel.' },
  { key: 'spec3_title', group: 'Página inicial — Materiais', label: 'Diferencial 3 — título', type: 'text', def: 'Garantia Vitalícia do Teor' },
  { key: 'spec3_desc', group: 'Página inicial — Materiais', label: 'Diferencial 3 — descrição', type: 'textarea', def: 'Certificado individual assinado com garantia total contra defeitos de fabricação.' },

  // ---- Página inicial: manifesto ----
  { key: 'story_tag', group: 'Página inicial — Manifesto', label: 'Etiqueta acima do título', type: 'text', def: "O MANIFESTO LUCE D'ORO" },
  { key: 'story_title', group: 'Página inicial — Manifesto', label: 'Título', type: 'text', def: 'Luxo Silencioso, Elegância Eterna' },
  { key: 'story_p1', group: 'Página inicial — Manifesto', label: 'Primeiro parágrafo', type: 'textarea', def: 'Nascemos da convicção de que o verdadeiro luxo não precisa gritar para ser percebido. Ele reside no peso preciso de uma corrente que repousa sobre a pele, no clique perfeito de uma trava gaveta e no brilho dourado que atravessa gerações.' },
  { key: 'story_p2', group: 'Página inicial — Manifesto', label: 'Segundo parágrafo', type: 'textarea', def: "A Luce D'Oro une a herança da ourivesaria clássica ao minimalismo da joalheria contemporânea, criando símbolos de afeto, conquista e identidade pessoal." },
  { key: 'story_signature', group: 'Página inicial — Manifesto', label: 'Assinatura', type: 'text', def: 'Joalheria Contemporânea' },

  // ---- Página inicial: confiança ----
  { key: 'trust1_title', group: 'Página inicial — Confiança', label: 'Item 1 — título', type: 'text', def: 'Envio Seguro com Seguro Total' },
  { key: 'trust1_desc', group: 'Página inicial — Confiança', label: 'Item 1 — descrição', type: 'textarea', def: 'Transporte monitorado com cobertura integral até as suas mãos. Frete cortesia para pedidos acima de R$ 500.' },
  { key: 'trust2_title', group: 'Página inicial — Confiança', label: 'Item 2 — título', type: 'text', def: 'Certificado de Garantia' },
  { key: 'trust2_desc', group: 'Página inicial — Confiança', label: 'Item 2 — descrição', type: 'textarea', def: 'Todas as joias acompanham livreto numerado com certificado oficial de qualidade e autenticidade do ouro.' },
  { key: 'trust3_title', group: 'Página inicial — Confiança', label: 'Item 3 — título', type: 'text', def: 'Primeira Troca Cortesia' },
  { key: 'trust3_desc', group: 'Página inicial — Confiança', label: 'Item 3 — descrição', type: 'textarea', def: 'Até 30 dias para experimentar suas peças com total tranquilidade no conforto de sua casa.' },
  { key: 'trust4_title', group: 'Página inicial — Confiança', label: 'Item 4 — título', type: 'text', def: 'Atendimento Concierge' },
  { key: 'trust4_desc', group: 'Página inicial — Confiança', label: 'Item 4 — descrição', type: 'textarea', def: 'Especialistas à disposição via WhatsApp e e-mail para consultoria de estilos, medidas e presentes especiais.' },

  // ---- Rodapé ----
  { key: 'footer_news_tag', group: 'Rodapé', label: 'Newsletter — etiqueta', type: 'text', def: 'CÍRCULO EXCLUSIVO' },
  { key: 'footer_news_title', group: 'Rodapé', label: 'Newsletter — título', type: 'text', def: 'Receba lançamentos e convites privados' },
  { key: 'footer_news_desc', group: 'Rodapé', label: 'Newsletter — texto', type: 'textarea', def: 'Cadastre seu e-mail para ter acesso antecipado a novas edições limitadas e conteúdos editoriais da joalheria.' },
  { key: 'footer_bio', group: 'Rodapé', label: 'Texto sobre a marca', type: 'textarea', def: 'Joalheria contemporânea com peças exclusivas em ouro nobre, design autoral e acabamento primoroso. Detalhes que contam a sua história com discrição e sofisticação atemporal.' },
  { key: 'footer_hours', group: 'Rodapé', label: 'Horário de atendimento', type: 'text', def: 'Segunda a Sexta, das 09h às 19h' },
  { key: 'footer_extra', group: 'Rodapé', label: 'Linha extra do atendimento', type: 'text', def: 'Entregas & Trocas Cortesia' },
  { key: 'footer_inst1', group: 'Rodapé', label: 'Institucional — item 1', type: 'text', def: "Sobre a Luce D'Oro" },
  { key: 'footer_inst2', group: 'Rodapé', label: 'Institucional — item 2', type: 'text', def: 'Nossos Mestres Ourives' },
  { key: 'footer_inst3', group: 'Rodapé', label: 'Institucional — item 3', type: 'text', def: 'Política de Privacidade' },
  { key: 'footer_inst4', group: 'Rodapé', label: 'Institucional — item 4', type: 'text', def: 'Termos de Uso' },
];

// Elementos que o visitante vê e o editor visual pode arrastar. Cada um ganha dois campos de posição:
//   pos_<chave>  = deslocamento no computador   |   posm_<chave> = deslocamento no celular
// Valor "x,y": x em % da largura do bloco onde o elemento está, y em pixels. Vazio = posição original.
export const ELEMENTOS_ARRASTAVEIS = [
  'logo_header', 'logo_footer', 'logo_signature', 'footer_hours',
  'materials_tag', 'materials_title', 'materials_lead', 'materials_image', 'materials_pill',
  'story_tag', 'story_title', 'story_p1', 'story_p2', 'story_signature',
] as const;

const rotuloDe = (k: string) => CAMPOS_BASE.find((f) => f.key === k)?.label ?? k;
export const CONTENT_FIELDS: ContentField[] = [
  ...CAMPOS_BASE,
  ...ELEMENTOS_ARRASTAVEIS.flatMap((k): ContentField[] => [
    { key: `pos_${k}`, group: 'Posição (computador)', label: `Posição — ${rotuloDe(k)}`, type: 'position', def: '' },
    { key: `posm_${k}`, group: 'Posição (celular)', label: `Posição no celular — ${rotuloDe(k)}`, type: 'position', def: '' },
  ]),
];

export const CONTENT_DEFAULTS: Record<string, string> = Object.fromEntries(CONTENT_FIELDS.map((f) => [f.key, f.def]));

// Dados de contato do rodapé vêm de "Configurações" (loja). Estes são os padrões se nada foi preenchido.
export const CONTATO_PADRAO = {
  email: 'rodrigoarrezzi@icloud.com',
  whatsapp: '+55 (27) 99505-5702',
  cnpj: '48.912.304/0001-92',
};
