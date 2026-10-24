export const SETTINGS_SUB = [
  { id: 'geral', label: 'Geral' },
  { id: 'seo', label: 'SEO' },
  { id: 'integracoes', label: 'Integrações' },
  { id: 'notificacoes', label: 'Notificações' },
] as const;

export type SettingsSub = typeof SETTINGS_SUB[number]['id'];
