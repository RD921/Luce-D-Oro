# Arquitetura Adm. — análise do mockup

Data: 2026-10-21

## O que o mockup mostra

O mockup é um painel escuro em tom azul-grafite, com destaque em prata, organizado como um software profissional.

- **Menu lateral:** marca "LUCE D'ORO · Desenvolvedor" e três grupos. Visão geral (Dashboard, Produtos, Categorias, Pedidos, Clientes), Marketing & Loja (Estoque) e Sistema (Cupons, Entrega, Pagamento, Configurações e Arquitetura Adm.).
- **Configurações:** vira um submenu com Geral, SEO, Integrações e Notificações. "Arquitetura Adm." é um item próprio e fica selecionado, com um marcador à direita.
- **Topo:** "Sistema online", sino com ponto vermelho, avatar com nome e data, e o seletor de site ("Luce D'Oro (loja principal)").
- **Corpo:** título e descrição, 8 cartões em 2 linhas de 4, tabela de sites e clientes (com "Adicionar site" e busca), e três blocos embaixo: Atividade recente, Status do sistema e Resumo do site atual.

Cores aproximadas, tiradas da imagem:

| Elemento | Cor |
| --- | --- |
| Fundo principal | #0d161c |
| Menu lateral | #080e13 |
| Cartões | #0e161c |
| Bordas | #252d36 |
| Destaque (prata) | #9199a4 |
| Textos | branco e cinza-claro |

O mockup não usa dourado.

## Diferenças em relação ao painel de hoje

Hoje o painel é escuro com destaque dourado, e a Arquitetura é só uma aba dentro de Configurações; o mockup muda cinco coisas.

| Ponto | Painel atual | Mockup |
| --- | --- | --- |
| Cor | Escuro com dourado | Azul-grafite com prata |
| Menu | Banners, Conteúdo, Equipe e Auditoria presentes | Banners e Conteúdo somem; Equipe e Auditoria não aparecem |
| Configurações | Duas abas: Geral e Arquitetura | Submenu: Geral, SEO, Integrações, Notificações |
| Arquitetura | Aba dentro de Configurações | Item próprio do menu, "Arquitetura Adm." |
| Topo | Sem sino, sem seletor de site, sem "Sistema online" | Os três existem |

## O que é só ilustração e não pode ser copiado

Vários dados do mockup são inventados e não têm equivalente real hoje; o painel só deve mostrar o que for verificável.

- Os clientes "Silver & Co.", "Valentina" e "Atelier Noir", e as tecnologias WordPress e Shopify.
- O domínio www.lucedoro.com.br, as datas de 2025 e a atividade recente.
- "API de pagamentos: Conectado", porque hoje não existe API de pagamentos integrada.
- "Armazenamento: Operacional", porque o disco permanente ainda não foi verificado.
- A miniatura do site (uma aliança sobre fundo escuro), que não é o site real.

O prompt já pede estados reais (funcionando, falha, pendente, não verificado) e nenhum dado de exemplo em produção.

## Ajustes sugeridos no prompt

O prompt está bom; quatro ajustes o deixam consistente com o mockup.

1. **Cartões:** o prompt fala em "4 cartões + 6 módulos" e o mockup tem 8 cartões iguais. Escolha uma das duas versões.
2. **Cores:** inclua os valores exatos da seção 1 e diga se o painel inteiro muda ou só a Arquitetura.
3. **Ordem das fases:** a biblioteca de mídia (armazenamento persistente) deve vir antes do editor visual, e o resumo do site com miniatura só depois de existir um jeito real de gerar a imagem.
4. **Banners:** deixe explícito que o item some do menu só depois que a migração estiver testada.

## Decisões para o Rodrigo

Três respostas bastam para começar a Fase 1 visual.

- [ ] O visual novo vale para o painel inteiro ou só para a Arquitetura?
- [ ] Os cartões: 8 iguais (como no mockup) ou 4 + 6 (como no prompt)?
- [ ] Por onde começar: Fase 1 visual (menu, topo, 8 cartões, tabela só com a Luce D'Oro, atividade e estado reais) ou biblioteca de mídia (armazenamento permanente)?

Se a resposta for "painel inteiro, 8 cartões, Fase 1 visual", a implementação começa em seguida, com cartões e atividade em dados reais.
