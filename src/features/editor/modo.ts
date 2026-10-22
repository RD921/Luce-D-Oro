// Modo de edição: ativo só quando o site está dentro do editor do painel (iframe da própria loja com ?editor=1).
export const emModoEditor = (): boolean => {
  try { return window.parent !== window && new URLSearchParams(window.location.search).get('editor') === '1'; } catch { return false; }
};
