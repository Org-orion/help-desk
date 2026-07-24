# Software Design Document (SDD) — CONCREM Help Desk

> **Status do documento:** documentação técnica derivada do repositório  
> **Data da análise:** 24/07/2026  
> **Escopo analisado:** código-fonte React/TypeScript, APIs Vercel, Supabase Edge Functions, schema e migrações SQL, scripts, testes, configurações e documentação existente  
> **Regra de interpretação:** este documento descreve o que está comprovado no código. Quando o estado de produção ou uma intenção de negócio não pode ser confirmado, isso é indicado explicitamente.

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura](#2-arquitetura)
3. [Stack Tecnológica](#3-stack-tecnológica)
4. [Estrutura de Pastas](#4-estrutura-de-pastas)
5. [Fluxo de Navegação](#5-fluxo-de-navegação)
6. [Componentes](#6-componentes)
7. [Hooks](#7-hooks)
8. [Contextos e Gerenciamento de Estado](#8-contextos-e-gerenciamento-de-estado)
9. [Serviços](#9-serviços)
10. [Modelos de Dados](#10-modelos-de-dados)
11. [Integrações](#11-integrações)
12. [Autenticação](#12-autenticação)
13. [Segurança](#13-segurança)
14. [Fluxo de Dados](#14-fluxo-de-dados)
15. [Dependências](#15-dependências)
16. [Configurações](#16-configurações)
17. [Pontos de Atenção](#17-pontos-de-atenção)
18. [Guia para Novos Desenvolvedores](#18-guia-para-novos-desenvolvedores)
19. [Glossário](#19-glossário)
20. [Resumo Final](#20-resumo-final)

---

# 1. Visão Geral

## 1.1 Objetivo da aplicação

O CONCREM Help Desk é uma aplicação web interna de atendimento e gestão operacional. O código implementa cinco domínios principais:

- abertura, acompanhamento, priorização, conclusão e avaliação de chamados;
- inventário de equipamentos e respectivos responsáveis, setores, características técnicas e imagens;
- cadastro de usuários, setores e produtos;
- controle de estoque por registro de saídas de produtos;
- painéis e relatórios calculados a partir de chamados e equipamentos.

Existe também um subsistema de identificação patrimonial por QR Code. Administradores podem gerar etiquetas em lote, imprimi-las ou exportá-las para Excel, ler etiquetas, vinculá-las a equipamentos novos ou existentes, emitir, revogar e reemitir tokens. Uma rota pública permite consultar um conjunto limitado de dados do equipamento a partir do token da etiqueta.

## 1.2 Problema que resolve

A aplicação centraliza atividades que, sem ela, tenderiam a ficar dispersas:

- solicitações de suporte e sua fila de atendimento;
- identificação de urgências, inclusive priorização de usuários VIP;
- inventário e estado operacional de ativos;
- associação textual entre usuários, setores e equipamentos;
- histórico de consumo de produtos;
- indicadores de tempo de solução, resolução, satisfação e saúde do parque;
- consulta física de ativos por etiqueta QR.

O código não contém uma especificação formal de negócio nem integrações com ferramentas externas de ITSM. Portanto, não é possível afirmar pelo repositório quais processos anteriores foram substituídos ou quais SLAs contratuais existem.

## 1.3 Público-alvo

Os perfis técnicos implementados são:

| Perfil | Representação | Acesso comprovado |
|---|---|---|
| Administrador | `role: "admin"` e `tier: "admin"` | Todas as páginas protegidas; cadastros; ativos; análises; relatórios; operações administrativas de QR |
| VIP | `role: "user"` e `tier: "vip"` | Dashboard, chamados e páginas de análise de equipamentos/serviços; chamados VIP recebem prioridade alta no banco |
| Padrão | `role: "user"` e `tier: "padrao"` | Somente a Central de Chamados |
| Público anônimo | Sem sessão | Consulta de equipamento por token em `/consulta/equipamento/:token` |

O público organizacional exato não é declarado. A marca, textos e URLs indicam uso pela CONCREM, mas cargos e equipes responsáveis pela operação não podem ser determinados apenas pelo código.

## 1.4 Escopo funcional

### Dentro do escopo implementado

- login e migração gradual de credenciais legadas para Supabase Auth;
- restauração, renovação e encerramento de sessão;
- controle de navegação por perfil;
- CRUD de chamados, equipamentos, usuários, setores e produtos;
- vínculo opcional, de um único nível, entre equipamentos independentes;
- registro, edição e exclusão de saídas de estoque;
- avaliação de chamados concluídos;
- imagens privadas de equipamentos com URL assinada;
- dashboards e relatórios calculados no cliente;
- exportação CSV de chamados concluídos;
- termo de responsabilidade em PDF;
- QR patrimonial, impressão e exportação XLSX;
- consulta pública restrita do equipamento;
- scripts de aplicação/verificação do schema e dados de desenvolvimento;
- testes unitários dos contratos de QR, imagens e consulta pública.

### Fora do escopo ou não comprovado

- recuperação de senha: há um botão visual “Esqueceu a senha?”, mas não há handler ou serviço correspondente;
- cadastro público: `register` no contexto sempre retorna `false`;
- notificações por e-mail, SMS, push ou WhatsApp: migrações de tabelas de bot existem, porém não há runtime do bot neste repositório;
- SLA configurável, escalonamento automático ou atribuição inteligente;
- anexos em chamados;
- sincronização em tempo real via Supabase Realtime;
- paginação no servidor;
- testes end-to-end;
- observabilidade centralizada;
- pipeline CI/CD versionado no repositório.

---

# 2. Arquitetura

## 2.1 Arquitetura geral

A solução é uma SPA React servida pelo Vite e preparada para hospedagem na Vercel. O navegador acessa o Supabase diretamente para o CRUD operacional usando a chave anônima e a sessão autenticada. Operações que exigem segredo, privilégio elevado ou anonimização passam por Edge Functions do Supabase. A consulta pública usa uma função serverless da Vercel como proxy para a Edge Function.

Há quatro planos arquiteturais:

1. **Apresentação:** páginas e componentes React, Tailwind e shadcn/Radix.
2. **Estado e aplicação:** Context API para autenticação/responsividade/sidebar; TanStack Query para estado remoto; estado local React para formulários, filtros e modais.
3. **Acesso a dados:** módulos `src/lib/api`, cliente Supabase, utilitários de QR/imagens/exportação e APIs serverless em `api/`.
4. **Backend gerenciado:** Supabase Auth, PostgreSQL/PostgREST, Storage, Edge Functions e funções SQL transacionais.

## 2.2 Diagrama textual

```text
┌──────────────────────────────── Navegador ────────────────────────────────┐
│                                                                          │
│  React SPA                                                               │
│  ├─ React Router: rotas públicas e protegidas                            │
│  ├─ AuthContext: usuário, sessão, login e logout                         │
│  ├─ TanStack Query: cache de chamados/equipamentos/etc.                  │
│  ├─ Páginas e componentes                                                │
│  └─ src/lib                                                              │
│     ├─ api/* ───────────────────────────────┐                             │
│     ├─ public-equipment.ts ─────┐           │                             │
│     ├─ equipment-qr-*           │           │                             │
│     └─ supabase.ts              │           │                             │
└─────────────────────────────────┼───────────┼─────────────────────────────┘
                                  │           │
                      GET público │           │ Supabase JS/PostgREST,
                                  │           │ Auth, Storage e invoke()
                                  ▼           ▼
┌──────────────────────── Vercel Serverless ──────────┐  ┌──── Supabase ────┐
│ /api/public/equipment/:token                        │  │ Auth             │
│ /api/equipment-qr/:action (proxy disponível, mas    │  │ PostgreSQL/RLS   │
│ o frontend atual invoca a Edge Function diretamente)│  │ Storage privado │
└──────────────────────────────┬───────────────────────┘  │ Edge Functions  │
                               │                          │ ├─ auth-migrate- │
                               └─────────────────────────►│ │  login         │
                                                          │ ├─ equipment-qr-│
                                                          │ │  admin         │
                                                          │ └─ public-      │
                                                          │    equipment    │
                                                          │                 │
                                                          │ Funções SQL/RPC │
                                                          │ + auditoria QR  │
                                                          └─────────────────┘
```

## 2.3 Fluxo de inicialização

1. `src/main.tsx` cria a raiz React e renderiza `App`.
2. `App` cria um `QueryClient` único e o roteador.
3. A árvore recebe `ThemeProvider`, `QueryClientProvider`, `TooltipProvider` e o toaster Sonner.
4. A rota pública de equipamento é detectada por expressão regular sobre `window.location.pathname`. Nessa rota o `AuthProvider` é omitido.
5. Nas demais rotas, `AuthProvider` restaura a sessão antes de renderizar seus filhos.
6. Opcionalmente, dois efeitos em `App`:
   - verificam a conexão/schema quando `VITE_SUPABASE_VERIFY_ON_START=1`;
   - criam `admin/admin` se `VITE_BOOTSTRAP_ADMIN=1` e nenhum admin for encontrado.
7. `ProtectedRoute` valida autenticação e permissões e envolve a página em `ResponsiveLayout` e `MainLayout`.

## 2.4 Estrutura de camadas

### Camada de apresentação

- `src/pages`: telas roteáveis e grande parte da lógica de interação.
- `src/components/shared`: componentes reutilizáveis próprios.
- `src/components/ui`: primitives shadcn/Radix.
- `src/components/Layout`: shell autenticado e navegação.
- `src/components/equipment-qr`: fluxos especializados de etiquetas.

### Camada de aplicação e estado

- `AuthContext`: estado global de autenticação.
- `ResponsiveContext`: dimensões e categoria de dispositivo.
- `SidebarContext`: estado do menu lateral.
- TanStack Query: consultas, mutações, cache e invalidação.
- `useState`/`useMemo`/`useEffect`: estado e cálculos locais das páginas.

### Camada de serviços

- `src/lib/api/*.ts`: CRUD tipado via Supabase/PostgREST.
- `src/lib/public-equipment.ts`: contrato e chamada da consulta pública.
- `src/lib/equipment-*`: validação de imagens, QR, renderização e exportação.
- `src/lib/supabase.ts`: composição do cliente.

### Camada server-side

- `api/`: handlers Vercel que fazem proxy sem expor service role.
- `supabase/functions/`: autenticação migratória e operações privilegiadas.
- `supabase/sql` e `supabase/migrations`: funções transacionais, RLS, tabelas e Storage.

## 2.5 Características arquiteturais

- **SPA client-heavy:** filtros, métricas, gráficos e relatórios são calculados no navegador.
- **Backend as a Service:** não há servidor de aplicação tradicional no repositório.
- **Repository/service modules simples:** cada entidade possui funções CRUD, sem classes ou injeção de dependência.
- **Segurança híbrida:** navegação é restringida no cliente, enquanto operações QR e partes de usuários/imagens usam validação server-side e RLS.
- **Migração incremental:** o repositório preserva schema legado e adiciona autenticação segura/QR por migrações posteriores.

---

# 3. Stack Tecnológica

## 3.1 Frontend

| Tecnologia | Uso comprovado | Razão inferível pelo código |
|---|---|---|
| React 18 | UI declarativa e composição de telas | Base da SPA e do ecossistema de componentes/hooks |
| TypeScript | Tipos de entidades, DTOs, props e serviços | Reduz ambiguidades nos contratos do frontend; configuração não está em modo estrito |
| Vite 5 | desenvolvimento, build e preview | Inicialização rápida e suporte nativo a ESM/importação de variáveis `VITE_*` |
| SWC | transformação React pelo plugin Vite | Compilação rápida |
| React Router 6 | roteamento e redirects | Rotas client-side, parâmetros de QR e query strings de chamados |
| TanStack React Query 5 | cache remoto, loading e mutações | Padroniza busca, invalidação e atualização de dados Supabase |
| Tailwind CSS 3 | layout e design | Estilização utilitária responsiva, temas via variáveis CSS |
| shadcn/ui + Radix UI | primitives acessíveis | Diálogos, sheets, menus, selects, tooltips e outros controles |
| Framer Motion | animações no login/dashboard | Transições declarativas |
| Recharts | gráfico do dashboard | Série semanal de chamados abertos e resolvidos |
| Lucide React | iconografia | Ícones consistentes em toda a aplicação |

Não existe registro de decisão arquitetural explicando formalmente a escolha dessas tecnologias. As razões acima decorrem do modo como são usadas.

## 3.2 Backend e dados

| Tecnologia | Uso |
|---|---|
| Supabase JavaScript SDK | Auth, PostgREST, Storage, invocação de Edge Functions e RPC |
| Supabase Auth | sessão JWT, refresh token e usuários técnicos criados na migração de login |
| PostgreSQL | persistência relacional, constraints, triggers, funções e auditoria |
| PostgREST | CRUD direto do frontend sobre tabelas |
| Supabase Storage | imagens de equipamentos |
| Supabase Edge Functions/Deno | login seguro, administração de QR e consulta pública |
| Vercel Functions | proxy para consulta pública e proxy opcional de operações QR |

## 3.3 Geração de documentos e QR

- `qrcode`: geração de QR como Data URL.
- Canvas do navegador: composição da arte final da etiqueta em 300 DPI.
- `write-excel-file`: workbook XLSX com planilha visual de etiquetas e aba de dados Zebra.
- `jsPDF`: geração do termo de responsabilidade.
- APIs do navegador: `Blob`, `FileReader`, `URL.createObjectURL`, impressão e download.

## 3.4 Ferramentas de qualidade e operação

- ESLint 9 e TypeScript ESLint;
- Node Test Runner para testes;
- scripts Node com `dotenv`, `pg` e Supabase SDK;
- PostCSS e Autoprefixer;
- npm e Bun possuem arquivos de lock, embora o README oriente npm;
- Lovable aparece como origem/forma de edição no README e no plugin de desenvolvimento do Vite.

---

# 4. Estrutura de Pastas

```text
.
├─ api/                    # Funções serverless da Vercel
├─ docs/                   # Notas de rollout e ativação
├─ public/                 # Imagens, logos, favicon, robots e assets estáticos
├─ scripts/                # Administração e verificação do Supabase
├─ server/                 # Estado JSON; runtime correspondente não está presente
├─ src/                    # Aplicação React
│  ├─ components/          # Layout, UI e componentes especializados
│  ├─ config/              # Branding
│  ├─ contexts/            # Contexto de autenticação
│  ├─ hooks/               # Hooks reutilizáveis
│  ├─ lib/                 # Cliente, serviços, tipos e utilitários
│  └─ pages/               # Páginas roteáveis
├─ supabase/               # Schema, migrações, rollback, SQL e Edge Functions
└─ tests/                  # Testes unitários Node
```

## 4.1 `api/`

- `_lib/equipment-qr-security.ts`: contratos mínimos de request/response e headers de segurança para JSON privado.
- `_lib/equipment-qr-persistence.ts`: interface futura de persistência server-only. Não possui implementação instalada.
- `_lib/public-equipment-token.ts`: geração/hashing de token e composição de URL pública; marcada no código como primitiva futura.
- `equipment-qr/[action].ts`: proxy Vercel autenticado para a Edge Function `equipment-qr-admin`. Aceita apenas ações conhecidas.
- `public/equipment/[token].ts`: endpoint GET consumido pela página pública; encaminha o token à Edge Function `public-equipment`.

## 4.2 `docs/`

- `secure-auth-rollout.md`: sequência operacional da migração segura de autenticação.
- `equipment-qr-labels-activation.md`: checklist de ativação do QR.
- `public-equipment-qr-migration-proposal.md`: proposta anterior à implementação.

Esses documentos registram intenção e rollout, mas não comprovam quais etapas foram executadas no ambiente remoto.

## 4.3 `public/`

Contém favicon, `robots.txt`, placeholder SVG, imagem antiga de login e conjuntos de branding CONCREM. `src/config/branding.ts` aponta para:

- `/concrem-bg.jpg/Logo-Tipo-Cores.png`;
- `/concrem-bg.jpg/concrem-logo-mini.png`;
- `/concrem-bg.jpg/concrem-logo.png` para etiquetas.

Há ainda assets em `public/concrem-login`. A nomenclatura da pasta `concrem-bg.jpg` é incomum porque uma pasta possui extensão de arquivo.

## 4.4 `scripts/`

- `apply-supabase-schema.mjs`: lê `supabase/schema.sql` e executa por conexão PostgreSQL direta.
- `verify-supabase-schema.mjs`: valida tabelas, constraints, triggers e índices via `pg`.
- `verify-supabase-tables.mjs`: verifica visibilidade das tabelas via Supabase API.
- `test-supabase-schema.mjs`: smoke test de produto, saída e chamado.
- `reset-seed-kmz.mjs`: apaga e recria dados de desenvolvimento; é destrutivo.
- `sync-check-products.mjs`: compara quantidade de produtos entre Supabase e uma API REST de bot.
- `clear-optional-fields.mjs`: chama uma API local antiga para limpar campos opcionais.

Os dois últimos scripts referenciam APIs de bot/servidor que não estão implementadas neste repositório.

## 4.5 `server/`

Contém apenas `notify-state.json`. Não há código de servidor que o consuma; sua responsabilidade operacional não pode ser determinada.

## 4.6 `src/components/`

- `Layout/`: shell atual autenticado, menu lateral e um header simples.
- `equipment-qr/`: geração, leitura, vínculo e gestão de etiquetas.
- `shared/`: badges, métricas, cabeçalhos, busca, estado vazio e confirmações.
- `ui/`: biblioteca local de primitives shadcn/Radix.
- `Layout.tsx`: layout anterior completo, não usado por `App`.
- `NavLink.tsx`: wrapper de link, sem uso identificado nas rotas atuais.
- `ResponsiveLayout.tsx`: provider responsivo usado por todas as rotas protegidas.
- `ResponsiveAnimations.tsx`: helpers de animação, sem uso identificado.
- `TableCardSwitcher.tsx`: alternância tabela/card responsiva, sem uso identificado nas páginas atuais.

## 4.7 `src/config/`

`branding.ts` centraliza os caminhos de logo principal, logo reduzido e logo da etiqueta.

## 4.8 `src/contexts/`

`AuthContext.tsx` concentra sessão, perfil, login, logout e um registro não implementado.

## 4.9 `src/hooks/`

Contém `useResponsive`, `useIsMobile` e o sistema de toast shadcn. A aplicação usa principalmente `useResponsive`; o toaster visível atual é Sonner.

## 4.10 `src/lib/`

- `api/`: serviços CRUD.
- `config/`: mapeamentos visuais de chamados, equipamentos e estoque.
- `utils/format.ts`: datas e durações.
- `supabase.ts`: cliente compartilhado.
- `public-equipment*.ts`: consulta pública e emissão simples.
- `equipment-images.ts`: validação binária de imagens.
- `equipment-qr-labels.ts`: tipos e validações.
- `equipment-qr-label-renderer.ts`: PNG de etiqueta.
- `equipment-qr-xlsx.ts`: workbook para Zebra.
- `utils.ts`: combinação de classes Tailwind.

## 4.11 `src/pages/`

Uma página por rota principal. Algumas páginas são grandes e concentram UI, regras de interação e integração:

- `Equipamentos.tsx`: 1.208 linhas;
- `Chamados.tsx`: 842 linhas;
- `Produtos.tsx`: 721 linhas;
- `Usuarios.tsx`: 620 linhas;
- `Setores.tsx`: 544 linhas;
- `Relatorios.tsx`: 542 linhas.

`Index.tsx` existe, mas não é registrado no roteador.

## 4.12 `supabase/`

- `schema.sql`: schema-base de desenvolvimento.
- `migrations/`: alterações incrementais.
- `functions/`: três Edge Functions.
- `sql/qr_release_functions.sql`: RPCs de emissão/revogação.
- `rollback/`: rollback da migração segura.
- `README.md`: configuração básica.

## 4.13 `tests/`

- `equipment-images.test.mjs`: MIME, extensão, tamanho e magic bytes.
- `equipment-qr-labels.test.mjs`: código, validação, segurança contra fórmula, XLSX, dimensões e URL.
- `public-equipment-response.test.mjs`: contrato público, estados de erro, `no-store`, imagens e ausência de dados internos.

---

# 5. Fluxo de Navegação

## 5.1 Tabela de rotas

| Rota | Página | Proteção | Perfis |
|---|---|---|---|
| `/` | Login | Pública; redireciona usuário autenticado | Todos |
| `/consulta/equipamento` | PublicEquipment | Pública | Anônimo |
| `/consulta/equipamento/:token` | PublicEquipment | Pública | Anônimo |
| `/dashboard` | Dashboard | `ProtectedRoute` | Admin e VIP |
| `/dashboard/equipamentos` | AnaliseEquipamentos | `ProtectedRoute` | Admin e VIP |
| `/dashboard/servicos` | AnaliseServicos | `ProtectedRoute` | Admin e VIP |
| `/equipamentos` | Equipamentos | `ProtectedRoute` | Admin |
| `/chamados` | Chamados | `ProtectedRoute` | Admin, VIP e padrão |
| `/usuarios` | Usuarios | `ProtectedRoute` | Admin |
| `/produtos` | Produtos | `ProtectedRoute` | Admin |
| `/setores` | Setores | `ProtectedRoute` | Admin |
| `/relatorios` | Relatorios | `ProtectedRoute` | Admin |
| `*` | NotFound | Sem `ProtectedRoute` | Todos |

`/consulta/equipamento` sem token renderiza estado “não encontrado”.

## 5.2 Redirecionamentos

- Usuário não autenticado em rota protegida → `/`.
- Admin ou VIP autenticado em `/` → `/dashboard`.
- Usuário padrão autenticado em `/` → `/chamados`.
- Usuário padrão/VIP tentando uma rota não permitida → `/chamados`.
- Página 404 oferece link tradicional para `/`.

O redirect de rota protegida não usa `replace`, enquanto o redirect do login usa.

## 5.3 Menu lateral

### Admin

- Operação: Dashboard, Chamados.
- Gestão: Gestão de Ativos.
- Análises: Relatórios, Análise de Equipamentos, Análise de Serviços.
- Sistema/Cadastros: Usuários, Produtos, Setores.
- Rodapé: identidade do usuário e logout.

### VIP

- Dashboard e Chamados aparecem no menu.
- As páginas de análise são permitidas por `ProtectedRoute`, mas os grupos de análise são marcados `adminOnly` no menu. Assim, VIP pode acessar essas páginas por URL direta, porém não recebe links no menu.

### Usuário padrão

- O menu mostra o grupo Operação inteiro, inclusive Dashboard, mas `ProtectedRoute` rejeita `/dashboard` e redireciona para chamados. Essa diferença entre visibilidade e autorização deve ser considerada uma inconsistência de UX.

## 5.4 Fluxos entre telas

### Dashboard

- Exibe métricas de chamados e gráfico semanal.
- “Bloqueios Críticos” abre `/chamados?priority=alta`.
- Um chamado crítico específico abre `/chamados?ticket=<id>`.
- A página Chamados lê esses parâmetros, aplica o filtro ou abre a ficha e remove o parâmetro consumido.

### Análises

- Análise de Equipamentos possui retorno para dashboard e listagem filtrada.
- Análise de Serviços possui retorno para dashboard e filtros operacionais.
- Relatórios abre uma ficha lateral de chamado concluído para edição/exclusão.

### Gestão de equipamentos

- Lista → ficha, edição, exclusão, termo PDF ou QR.
- Cadastro/edição → pesquisa opcional de um equipamento principal elegível → validação local e no banco → confirmação ao trocar ou remover um vínculo.
- Ficha de equipamento vinculado → equipamento principal clicável; ficha de equipamento principal → quantidade e lista clicável dos vinculados.
- Scanner de QR `UNUSED` → cadastro de novo equipamento ou vínculo com equipamento existente.
- Gestão de QR → emissão, impressão, reemissão ou revogação.
- Geração em lote → prévia → confirmação no servidor → impressão/XLSX.

### Chamados

- Lista/fila → detalhes.
- Admin pode alterar status e excluir.
- Usuário autorizado pode editar chamado ainda não concluído.
- Chamado concluído não avaliado → prompt de avaliação.

---

# 6. Componentes

## 6.1 Layout e infraestrutura

### `MainLayout`

Shell das páginas protegidas. Fornece `SidebarContext`, sidebar, overlay e botão móvel. Persiste `sidebar_collapsed` no `localStorage`, bloqueia scroll durante drawer móvel e restaura foco ao fechar.

### `Sidebar`

Renderiza grupos conforme perfil, destaca rota ativa, implementa submenu Cadastros, tooltips no modo recolhido, focus trap básico no mobile, fechamento por Escape e logout.

### `ResponsiveLayout`

Executa `useResponsive`, fornece `ResponsiveContext` e adiciona atributos `data-device` e `data-screen-width`.

### `Layout.tsx`

Layout legado alternativo com menu próprio. Não é usado pelo roteador atual.

### `Header`

Cabeçalho simples existente em `components/Layout`; não participa do `MainLayout` atual.

## 6.2 Componentes compartilhados próprios

| Componente | Responsabilidade |
|---|---|
| `PageHeader` | Título, descrição, ícone e ações de cabeçalho |
| `MetricCard` | KPI com rótulo, valor, ícone e cor |
| `SearchInput` | Campo de busca com ícone e limpeza |
| `EmptyState` | Mensagem padronizada para listas vazias |
| `StatusBadge` | Aparência de status de chamado via configuração |
| `PriorityBadge` | Aparência de prioridade |
| `StockBadge` | Classificação visual do estoque: crítico, baixo ou OK |
| `UserTypeBadge` | Tipo admin/VIP/padrão e função `getUserTypeLabel` |
| `ConfirmDeleteModal` | Confirmação acessível de exclusão, usada pela gestão de ativos |
| `ConfirmDialog` | Confirmação genérica |

Algumas páginas ainda mantêm badges e confirmações locais, portanto a reutilização não é uniforme.

## 6.3 Componentes específicos de QR

### `EquipmentQrBatchDialog`

Valida lote, solicita `generate-batch`, gera QR Data URLs, compõe PNGs, oferece calibração, prévia, impressão e XLSX. Limites: até 500 etiquetas, prefixo de 12 caracteres, 1–8 dígitos e 1–5 colunas. O formato visual `100x40` é convertido para `60x40` na solicitação ao servidor, porque a Edge Function aceita somente `50x30`, `60x40` e `80x50`.

### `EquipmentQrScannerDialog`

Lê QR por:

- câmera via `BarcodeDetector` e `getUserMedia`;
- arquivo de imagem;
- URL digitada.

Valida mesma origem, consulta a Edge Function e permite tratar etiqueta não usada.

### `EquipmentQrBindExistingDialog`

Pesquisa até 20 equipamentos, seleciona um e define decisão de patrimônio:

- `KEEP`: mantém;
- `REPLACE`: substitui pelo código da etiqueta;
- `FILL`: preenche se vazio.

### `EquipmentQrManageDialog`

Localiza etiqueta ativa do equipamento, emite uma nova, gera imagem QR, imprime, reemite token ou revoga.

## 6.4 Componentes locais das páginas

- Dashboard: cards estatísticos e seções de gráfico/fila crítica.
- AnaliseEquipamentos: `FilterChip` e `AnaliseItem`.
- AnaliseServicos: `ServiceRow`.
- Chamados: badges locais, skeleton, `TicketRow` e `TicketList`.
- Equipamentos: `KPICard`, `FilterChip` e `EquipmentItem`.
- Produtos: `ProductRow`.
- Setores: `SectorRow`.
- Usuários: `UserRow`.
- Relatórios: `ClosedTicketRow`, `StatusMetric` e `SatisfactionChart`.
- PublicEquipment: `PublicMessage`, `EquipmentCard`, `EquipmentGallery` e `Info`.

## 6.5 Biblioteca `components/ui`

É a camada de primitives shadcn/Radix. Inclui accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, button, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, form, hover-card, input, input-otp, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toast, toaster, toggle, toggle-group e tooltip.

Nem todos estão importados pelas páginas atuais. Eles representam uma biblioteca disponível, não necessariamente funcionalidades ativas.

## 6.6 Componentes sem uso identificado

O grafo de imports visível não demonstra uso atual de:

- `Layout.tsx`;
- `Header.tsx`;
- `NavLink.tsx`;
- `ResponsiveAnimations.tsx`;
- `TableCardSwitcher.tsx`;
- vários primitives em `components/ui`;
- `Index.tsx`.

Eles não devem ser removidos sem validação, mas constituem código potencialmente legado ou preparado para evolução.

---

# 7. Hooks

## 7.1 Hooks próprios

### `useAuth()`

- **Finalidade:** consumir `AuthContext`.
- **Parâmetros:** nenhum.
- **Retorno:** `{ user, login, logout, register, isAuthenticated, loading }`.
- **Uso:** `App`, Login, Dashboard, Chamados, Sidebar e layout legado.
- **Restrição:** lança erro fora de `AuthProvider`.

### `useResponsive()`

- **Finalidade:** acompanhar viewport com debounce de 100 ms.
- **Parâmetros:** nenhum.
- **Retorno:** `{ isMobile, isTablet, isDesktop, screenWidth, screenHeight }`.
- **Breakpoints:** mobile `<=768`, tablet `>768 && <=1024`, desktop `>1024`.
- **Uso:** `ResponsiveLayout`; também chamado diretamente em Chamados e Equipamentos, embora o retorno seja descartado nessas páginas.

### `useResponsiveContext()`

- **Finalidade:** consumir dimensões/categoria calculadas por `ResponsiveLayout`.
- **Parâmetros:** nenhum.
- **Retorno:** o mesmo objeto de `useResponsive`.
- **Uso:** `MainLayout`, `Sidebar`, `TableCardSwitcher` e `ResponsiveAnimations`.
- **Restrição:** lança erro fora de `ResponsiveLayout`.

### `useSidebar()`

- **Finalidade:** controlar menu lateral.
- **Parâmetros:** nenhum.
- **Retorno:** `{ isCollapsed, toggle, closeMobile }`.
- **Uso:** `Sidebar`.
- **Provider:** interno a `MainLayout`.

### `useIsMobile()`

- **Finalidade:** detectar largura abaixo de 768 px por `matchMedia`.
- **Parâmetros:** nenhum.
- **Retorno:** boolean.
- **Uso:** biblioteca `components/ui/sidebar.tsx`.
- **Observação:** usa regra `<768`, ligeiramente diferente de `useResponsive`, que considera 768 mobile.

### `useToast()`

- **Finalidade:** estado global em memória para o toaster shadcn.
- **Parâmetros:** nenhum.
- **Retorno:** toasts, função `toast` e `dismiss`.
- **Uso:** `components/ui/toaster.tsx`; o `App` atual monta o toaster Sonner, não o toaster shadcn.

## 7.2 Função `toast` do hook shadcn

- **Parâmetro:** props do toast sem `id`.
- **Retorno:** `{ id, dismiss, update }`.
- **Estado:** singleton em memória com limite de um toast.
- **Remoção:** atraso configurado em 1.000.000 ms.

## 7.3 Hooks de bibliotecas usados

### React

- `useState`: formulários, filtros, modais, seleção e estados assíncronos.
- `useEffect`: sessão, URL, resize, câmera, timers e sincronização de ficha.
- `useMemo`: listas filtradas, métricas e configurações.
- `useCallback`: carregamentos/filtros estáveis.
- `useRef`: revisão de autenticação, câmera, foco, DOM e streams.
- `useContext`: autenticação, responsividade e sidebar.

### TanStack Query

- `useQuery`: listas de entidades e dashboards.
- `useMutation`: CRUD e avaliação.
- `useQueryClient`: invalidação após mutações.

Chaves principais: `["chamados"]`, `["equipamentos"]`, `["setores"]`, `["usuarios"]`, `["produtos"]` e `["produto_saidas"]`.

### React Router

- `useNavigate`: redirects e navegação programática.
- `useLocation`: proteção e destaque do menu.
- `useParams`: token público.
- `useSearchParams`: filtros/deep-link de chamados.

Não há hooks Zustand ou Redux.

---

# 8. Contextos e Gerenciamento de Estado

## 8.1 `AuthContext`

### Estado

- `user: User | null`;
- `loading: boolean`;
- `authRevision`: referência incremental que evita aplicar resultados assíncronos obsoletos.

### Perfil exposto

```ts
{
  id: string
  email: string       // recebe o username, não necessariamente um e-mail real
  name: string
  role: "admin" | "user"
  tier: "vip" | "padrao"
}
```

Admin é normalizado como `role="admin"` e `tier="vip"`. Logo, o `tier` do contexto não possui literal `"admin"`.

### Fluxo

1. remove o legado `helpdesk_user` do `localStorage`;
2. registra `onAuthStateChange`;
3. obtém sessão persistida;
4. tenta refresh se necessário;
5. verifica o JWT com `getUser`;
6. consulta `app_users` por `auth_user_id`;
7. encerra a sessão local se não houver perfil;
8. disponibiliza o usuário.

## 8.2 `ResponsiveContext`

Provider local de cada rota protegida. O resize causa atualização do contexto e de consumidores como layout/sidebar.

## 8.3 `SidebarContext`

Estado visual local ao shell:

- persistência em `localStorage`;
- colapso automático no mobile e após mudança de rota;
- nenhuma sincronização entre abas.

## 8.4 TanStack Query

É o gerenciador de estado remoto principal. O `QueryClient` usa defaults da biblioteca, exceto `staleTime` definido em algumas consultas:

- 30 segundos para chamados/equipamentos em análises e relatórios;
- 60 segundos para setores em análise de equipamentos;
- outras páginas usam o default.

Após mutações, as chaves correspondentes são invalidadas. Não há optimistic updates.

## 8.5 Estado local

As páginas guardam localmente:

- filtros e termos de busca;
- abertura de sheets/dialogs;
- formulários;
- item selecionado;
- estados de upload;
- avaliação;
- configuração e prévia de QR;
- flags de loading específicas.

Não há store global de domínio.

## 8.6 Zustand e Redux

Não existem dependências, stores, reducers Redux ou hooks Zustand. A única função `reducer` é do sistema de toast shadcn, não Redux.

## 8.7 Fluxo dos dados de estado

```text
Supabase/Edge Function
        │
        ▼
função de serviço
        │
        ▼
TanStack Query cache ──► página ──► componentes
        ▲                  │
        │                  ▼
invalidateQueries ◄── useMutation

Supabase Auth ──► AuthContext ──► rotas/layout/páginas
window resize ──► ResponsiveContext ──► layout/sidebar
localStorage ──► sidebar e flags de avaliação
```

---

# 9. Serviços

## 9.1 Cliente Supabase

`src/lib/supabase.ts` só cria o cliente quando:

- `VITE_ENABLE_SUPABASE` não é `"0"`;
- a URL corresponde a `https://<ref>.supabase.co`;
- `VITE_SUPABASE_ANON_KEY` existe.

Opções Auth: sessão persistida, refresh automático e detecção de sessão na URL.

O tipo exportado permite `undefined`, mas vários módulos de serviço usam `supabase` sem guarda. Na prática, páginas de CRUD dependem de configuração válida.

## 9.2 Usuários (`src/lib/api/usuarios.ts`)

| Função | Operação |
|---|---|
| `listUsuarios()` | lista perfil sem `password_hash` |
| `createUsuario(input)` | cria usuário; nome/setor em maiúsculas; grava senha no campo legado |
| `updateUsuario(id, input)` | atualiza perfil/senha e sincroniza referências textuais |
| `deleteUsuario(id)` | exclui perfil |

Ao renomear um usuário, o serviço tenta atualizar `equipamentos.usuario`, `chamados.solicitante`, `chamados.usuario`, `termos_responsabilidade.usuario`, `produto_saidas.responsavel` e `setores.responsavel`. Algumas referências não existem no schema-base (`termos_responsabilidade` e `produto_saidas.responsavel`), sendo tratadas apenas parcialmente como best effort.

## 9.3 Setores

CRUD simples sobre `setores`. Nomes são normalizados para maiúsculas na criação e atualização.

## 9.4 Produtos e saídas

- CRUD de produtos.
- CRUD de `produto_saidas`.
- `registrarSaida` insere uma saída.
- Trigger `trg_produto_saidas_after_insert` reduz estoque com `greatest(0, estoque - quantidade)`.

Atualizar/excluir uma saída não possui trigger compensatória no schema-base. O frontend invalida produtos, mas o banco não restaura/recalcula estoque automaticamente.

## 9.5 Equipamentos e imagens

CRUD de equipamentos e operações de imagem:

- `equipamento_pai_id` identifica opcionalmente outro equipamento pelo UUID;
- `validateEquipamentoVinculo` antecipa erros de autorreferência, segundo nível e seleção de um equipamento já vinculado como principal;
- `createEquipamento` e `updateEquipamento` preservam as chamadas existentes e validam o vínculo quando informado;
- helpers resumidos localizam o principal, os vinculados e os candidatos independentes sem consultas recursivas;
- validação de extensão, MIME, tamanho máximo de 10 MB e assinatura binária;
- upload para `equipamento-imagens/<equipamentoId>/<uuid>.<ext>`;
- metadado em `equipamento_imagens`;
- uma imagem principal por equipamento;
- URLs assinadas por 3.600 segundos no ambiente autenticado;
- remoção do metadado e do objeto;
- promoção automática da primeira imagem restante.

Se o insert de metadado falha, o objeto recém-enviado é removido.

## 9.6 Chamados

| Função | Regra |
|---|---|
| `listChamados` | lista por `created_at desc` |
| `createChamado` | insere chamado |
| `updateChamado` | registra início/conclusão e calcula duração |
| `rateChamado` | grava 1–5 estrelas, comentário, data e flag |
| `deleteChamado` | exclui |
| `resetAllEvaluations` | limpa avaliações de todos os chamados |

Ao mudar para “Em Andamento”, define `started_at`. Ao concluir, define `completed_at`, garante início e calcula minutos/texto se ainda não houver duração fixa. Existe fallback que atualiza apenas o status se colunas temporais não existirem, evidenciando compatibilidade com schema antigo.

## 9.7 Consulta pública

`requestPublicEquipment(token)` chama:

```http
GET /api/public/equipment/:token
Cache: no-store
```

Estados normalizados:

- `ready`;
- `unlinked`;
- `not-found`;
- `unavailable` apenas para HTTP 500/503.

O DTO público exclui IDs, usuário/responsável, contato, histórico e token.

## 9.8 Edge Function `auth-migrate-login`

Responsabilidades:

- valida origem, método, tamanho e formato do body;
- normaliza username;
- rate limit por IP e username;
- valida credencial legada no servidor;
- exige upgrade de senha legada menor que 8 caracteres;
- cria usuário técnico no Supabase Auth;
- liga `auth_user_id`;
- substitui `password_hash` legado por marcador `MIGRATED:<hash aleatório>`;
- autentica e retorna a sessão.

## 9.9 Edge Function `equipment-qr-admin`

Exige JWT válido, perfil admin e rate limit. Ações:

- `generate-batch`;
- `lookup`;
- `bind-existing`;
- `equipment-label`;
- `issue-equipment-label`;
- `bind-new`;
- `revoke`;
- `reissue`.

Mutações críticas são delegadas a RPCs `security definer` transacionais.

## 9.10 Edge Function `public-equipment`

- exige feature flag e URL oficial;
- aplica allowlist de origem;
- limita 30 consultas/minuto por IP;
- usa somente hash SHA-256 do token;
- trata etiquetas `UNUSED`, `BOUND`, `REVOKED` e `VOID`;
- consulta campos públicos do equipamento;
- cria URLs de imagem válidas por 300 segundos;
- falha de imagens não impede os dados principais.

---

# 10. Modelos de Dados

## 10.1 Tipos frontend

### `Usuario`

`id`, `name`, `username`, `setor?`, `cargo?`, `tier`, `is_admin?`, `password_hash?`, `created_at?`.

### `Setor`

`id`, `nome`, `responsavel?`, `ramal?`, `localizacao?`, `created_at?`.

### `Equipamento`

`id`, `nome`, `tipo`, `patrimonio`, `marca?`, `modelo?`, `status`, `usuario?`, `setor?`, `ram?`, `armazenamento?`, `processador?`, `polegadas?`, `ghz?`, `equipamento_pai_id?`, `created_at?`.

`EquipamentoVinculoResumo` contém somente identidade, nome, tipo, patrimônio, status, marca/modelo e `equipamento_pai_id`, evitando modelos recursivos para exibição.

### `EquipamentoImagem`

Metadados do Storage mais `url` assinada: `id`, `equipamento_id`, `storage_path`, nome, MIME, tamanho, principal e timestamps.

### `Produto`

`id`, `nome`, `categoria`, `descricao?`, `estoque`, `created_at?`.

### `ProdutoSaida`

`id`, `produto_id`, `quantidade`, `destinatario?`, `data?`, `created_at?`.

### `Chamado`

Identidade, descrição, prioridade/status, usuário/solicitante/setor/tipo, VIP, datas, durações e avaliação.

### QR

- `EquipmentQrLabelStatus`: `UNUSED | BOUND | REVOKED | VOID`.
- `EquipmentQrLabelSize`: `50x30 | 60x40 | 80x50 | 100x40`.
- `EquipmentQrLabel`: metadados e URL pública opcional.
- `EquipmentQrLookupDTO`: identidade, código, status e equipamento.
- `EquipmentQrBatchInput`: quantidade, início, prefixo, dígitos, tamanho e colunas.
- `ZebraPrintableLabel`: etiqueta acrescida de QR/PNG.

### Consulta pública

`PublicEquipmentDTO` possui somente nome, patrimônio, tipo, marca, modelo, status, setor, RAM, armazenamento, CPU e imagens `{ url, principal }`.

## 10.2 Tabelas operacionais do schema-base

### `app_users`

- UUID;
- username único;
- nome, setor e cargo;
- `password_hash` obrigatório;
- tier com check;
- `is_admin` gerado;
- `auth_user_id` adicionado pela migração segura.

### `setores`

Nome único e campos textuais de responsável, ramal e localização.

### `equipamentos`

Patrimônio único, status controlado por check e características técnicas. Usuário e setor são strings, não foreign keys. A migração `202607240001_add_equipment_parent_link.sql` adiciona `equipamento_pai_id`, FK autorreferencial com `ON DELETE SET NULL`, índice e trigger de validação. Registros anteriores permanecem com vínculo nulo.

### `equipamento_imagens`

FK para equipamento com cascade, caminho único, validação de arquivo e índice parcial que garante uma principal.

### `produtos`

Estoque não negativo.

### `produto_saidas`

FK cascade para produto, quantidade positiva e data. Trigger reduz estoque após insert.

### `chamados`

Prioridade/status com checks, referências textuais, timestamps e duração. Migração separada adiciona avaliação.

## 10.3 Tabelas de segurança e QR

- `auth_login_rate_limits`;
- `equipment_qr_rate_limits`;
- `equipment_qr_labels`;
- `equipment_qr_label_audit`.

O token bruto nunca é persistido; apenas `token_hash` SHA-256. O índice parcial permite uma etiqueta `BOUND` por equipamento. A auditoria registra geração, vínculo, revogação, reemissão, anulação e reimpressão.

## 10.4 Tabelas de bot

Migrações isoladas criam:

- `bot_messages`;
- `bot_config`;
- `bot_blocked_numbers`;
- coluna `app_users.whatsapp`.

Não há serviços frontend ou runtime do bot neste repositório. Portanto, seu uso real não pode ser confirmado.

## 10.5 Relacionamentos

```text
auth.users 1 ─── 0..1 app_users

equipamentos 1 ─── N equipamento_imagens
equipamentos 1 ─── N equipment_qr_labels (histórico)
equipamentos (principal) 1 ─── N equipamentos (vinculados)
equipment_qr_labels 1 ─── N equipment_qr_label_audit
app_users 1 ─── N equipment_qr_label_audit (ator)

produtos 1 ─── N produto_saidas

setores ──(texto)── app_users/equipamentos/chamados
app_users ──(nome/username textual)── equipamentos/chamados
```

O vínculo entre equipamentos usa exclusivamente UUID. Cada vinculado possui no máximo um principal; um principal pode ter vários vinculados. A exclusão do principal apenas define `equipamento_pai_id = null` nos vinculados. O trigger impede autorreferência, pai que já seja vinculado e transformação de um equipamento que possua filhos em vinculado, limitando a estrutura a um nível. Os demais relacionamentos textuais explicam a sincronização manual no serviço de usuários e são mais frágeis do que FKs.

## 10.6 DTOs versus models

Não há camada formal de DTO para CRUD; os tipos frontend espelham aproximadamente as tabelas. A exceção é `PublicEquipmentDTO`, desenhado como contrato de exposição mínima, e os DTOs de QR em camelCase retornados pelas Edge Functions.

---

# 11. Integrações

## 11.1 Supabase

Integração central:

- Auth para JWT/sessão;
- PostgREST para CRUD;
- PostgreSQL RPC para transações privilegiadas;
- Storage para imagens;
- Edge Functions para operações server-side.

## 11.2 Vercel

`vercel.json`:

- aplica headers de segurança à consulta pública;
- reescreve rotas da SPA para `index.html`;
- preserva `/api/public/equipment/*` como endpoint;
- hospeda handlers sob `api/`.

## 11.3 Lovable

O README associa o projeto a uma URL Lovable, e `vite.config.ts` possui a dependência de desenvolvimento `lovable-tagger`, embora o plugin não esteja configurado no arquivo atual. Não há chamada runtime à plataforma.

## 11.4 Navegador e hardware

- câmera via MediaDevices;
- leitura QR via `BarcodeDetector`, cuja disponibilidade varia por navegador;
- upload local de imagem;
- impressão pelo browser;
- Canvas para etiqueta;
- download de PDF, CSV e XLSX.

## 11.5 Zebra

Não há comunicação direta com impressora Zebra ou SDK Zebra. A integração é por:

- PNG dimensionado em 300 DPI;
- impressão do navegador;
- XLSX com imagens e aba “Dados Zebra”.

## 11.6 APIs antigas/externas não presentes

Scripts referenciam:

- `http://localhost:3002/bot`;
- `http://localhost:3001`;
- variáveis `VITE_API_URL` e `API_URL`.

O servidor correspondente não está no repositório. Essas integrações devem ser consideradas legadas ou externas até confirmação.

---

# 12. Autenticação

## 12.1 Login

1. Usuário informa username e senha.
2. `Login` chama `AuthContext.login`.
3. O contexto invoca `auth-migrate-login`.
4. A função valida entrada e rate limit.
5. Se `auth_user_id` existe, autentica no Supabase Auth com e-mail técnico `<app_user_id>@internal.invalid`.
6. Se ainda é legado, compara `password_hash` em memória no servidor.
7. Senha menor que oito caracteres exige nova senha.
8. A função cria o usuário Auth, liga o perfil e invalida o segredo legado.
9. Retorna access/refresh tokens.
10. O cliente chama `setSession`, carrega o perfil e redireciona.

Resultados possíveis: `ok`, `invalid`, `upgrade_required`, `rate_limited`, `unavailable`.

## 12.2 Sessão

- persistida pelo Supabase SDK;
- restaurada por `getSession`;
- verificada por `getUser`;
- renovada por `refreshSession`;
- atualizada também pelo listener `onAuthStateChange`;
- UI de carregamento bloqueia o restante da aplicação durante restauração.

## 12.3 Tokens

- access token e refresh token são gerenciados pelo Supabase SDK;
- o código não grava tokens manualmente;
- `persistSession: true` implica armazenamento escolhido pelo SDK no browser;
- operações QR administrativas recebem o bearer automaticamente via `functions.invoke`.

## 12.4 Refresh token

Há refresh automático no cliente e tentativas explícitas:

- se `getSession` retorna erro e há refresh token;
- se `getUser` falha.

Se a renovação falha, a sessão local é encerrada.

## 12.5 Logout

Executa `supabase.auth.signOut({ scope: "local" })`, incrementa revisão, limpa usuário e remove `helpdesk_user`. O escopo local encerra a sessão neste cliente; revogação global de outras sessões não é executada.

## 12.6 Permissões

### Cliente

`ProtectedRoute` controla páginas. O menu também filtra grupos admin, mas não é a fonte de segurança.

### Backend

- `equipment-qr-admin` revalida JWT e exige `app_users.tier="admin"`;
- RPCs QR revalidam o ator admin;
- migração segura aplica RLS a `app_users`;
- migrações privadas de imagens exigem admin;
- consulta pública não exige autenticação, mas expõe DTO mínimo e token de alta entropia.

### Limitação

As funções CRUD operacionais são chamadas diretamente do navegador. O schema-base explicitamente desativa RLS para desenvolvimento. Não há no repositório um conjunto completo de políticas de produção para chamados, equipamentos, produtos, saídas e setores. Assim, a proteção server-side efetiva desses domínios depende do estado remoto, que não pode ser determinado pelo código.

## 12.7 Cadastro e recuperação

- `register` não está implementado.
- criação de usuários é operação administrativa em páginas internas.
- “Esqueceu a senha?” é apenas visual.
- não existe fluxo de alteração de senha após a migração, além do upgrade durante o primeiro login legado.

---

# 13. Segurança

## 13.1 Controles implementados

- allowlist de origem nas Edge Functions;
- headers `no-store`, `nosniff`, `no-referrer` e `noindex`;
- CSP e `X-Frame-Options: DENY` na rota pública;
- JWT validado no servidor para QR admin;
- autorização admin em Edge Function e RPC;
- rate limit distribuído em PostgreSQL;
- tokens QR aleatórios de 32 bytes, base64url;
- persistência apenas de hash SHA-256;
- respostas públicas genéricas para evitar enumeração;
- DTO público com minimização de dados;
- URLs assinadas curtas para imagens públicas (300 s) e internas (3.600 s);
- validação de MIME, extensão, tamanho e magic bytes;
- neutralização de fórmulas em células XLSX;
- transações e auditoria para QR;
- função de login limita body e tamanho de senha;
- erro de login não revela se o usuário existe.

## 13.2 Proteção de rotas

Proteção React melhora UX, mas não substitui RLS/autorização no servidor. Somente operações que passam pela Edge Function possuem autorização administrativa inequivocamente server-side no código.

## 13.3 Variáveis de ambiente

### Públicas no bundle

- `VITE_SUPABASE_URL`;
- `VITE_SUPABASE_ANON_KEY`;
- `VITE_ENABLE_SUPABASE`;
- `VITE_SUPABASE_VERIFY_ON_START`;
- `VITE_BOOTSTRAP_ADMIN`.

Chave anônima não é segredo; deve ser combinada com RLS.

### Server-only

- `SUPABASE_SERVICE_ROLE_KEY`;
- `SUPABASE_DB_URL`;
- `SUPABASE_DB_PASSWORD`;
- `AUTH_RATE_LIMIT_SALT`;
- `SUPABASE_ANON_KEY` nas APIs/Edge Functions;
- `PUBLIC_APP_URL`;
- `ALLOWED_APP_ORIGINS`;
- flags de QR.

Service role nunca deve receber prefixo `VITE_`.

## 13.4 Dados sensíveis

O schema legado exige `password_hash`, mas o comentário da Edge Function confirma que credenciais legadas estão em texto puro. A migração invalida esse valor após criar o usuário Auth. Enquanto existirem perfis não migrados, esse campo é altamente sensível.

O bootstrap `admin/admin` e o cadastro direto que envia senha ao PostgREST são riscos importantes. O código permite esse bootstrap apenas por flag, mas a documentação operacional deve garantir que esteja desligado fora de ambiente controlado.

## 13.5 Riscos de configuração

- `schema.sql` cria bucket de imagens como público e desativa RLS.
- migrações de 22/07 criam/convertem o bucket para privado e políticas admin.
- não é possível saber qual versão está aplicada remotamente.
- URLs oficiais estão hardcoded em funções QR, enquanto outros fluxos usam env.
- `.env.example` não lista todas as variáveis realmente necessárias e usa nomes diferentes em alguns casos.

## 13.6 Boas práticas recomendadas

- consolidar um schema/migração canônica de produção;
- habilitar RLS com políticas por perfil em todas as tabelas operacionais;
- mover criação/edição de usuário e senha para função server-side;
- remover qualquer credencial legada após migração;
- desabilitar bootstrap admin em produção;
- adicionar rotação de senha/recuperação;
- centralizar allowlists e URLs em env validada;
- registrar auditoria de CRUD sensível além de QR;
- adicionar CSP ao restante da aplicação;
- monitorar rate limits, falhas de login e operações QR.

---

# 14. Fluxo de Dados

## 14.1 CRUD operacional

```text
Interação na página
  → validação local básica
  → useMutation
  → função em src/lib/api
  → Supabase JS/PostgREST
  → PostgreSQL (constraint/trigger/RLS)
  → row retornada
  → onSuccess
  → invalidateQueries
  → useQuery busca novamente
  → renderização
```

Erros são geralmente convertidos em toast. Não há camada global de tratamento ou retry customizado.

## 14.2 Chamado

1. Formulário combina solicitante, setor, serviço, prioridade e flag VIP.
2. Usuário não admin tem dados derivados do perfil.
3. `createChamado` insere.
4. Trigger força prioridade alta se `is_vip`.
5. Alterações de status passam por `updateChamado`.
6. O serviço calcula timestamps e duração.
7. Dashboards reutilizam a mesma lista e calculam KPIs no cliente.

## 14.3 Vínculo entre equipamentos

```text
Formulário de equipamento
 → seleção opcional por UUID
 → validação antecipada no cliente/serviço
 → confirmação de troca ou remoção na edição
 → INSERT/UPDATE
 → trigger PostgreSQL valida autorreferência e nível único
 → FK autorreferencial persiste o vínculo
 → invalidação da lista
 → indicação na listagem e relações clicáveis na ficha
```

A listagem carregada continua plana. Os helpers fazem apenas buscas e filtros sobre os registros já carregados. Ao excluir o principal, `ON DELETE SET NULL` mantém os vinculados como equipamentos independentes, sem copiar ou excluir patrimônio, imagens ou QR Code.

## 14.4 Imagem de equipamento

```text
File
 → extensão/MIME/tamanho/magic bytes
 → Storage privado
 → insert de metadado
 → URL assinada
 → UI
```

Em caso de falha do metadado, o upload é compensado. Na exclusão, o metadado é removido antes do objeto; falha no Storage pode deixar objeto órfão.

## 14.5 QR administrativo

```text
Admin UI
 → supabase.functions.invoke + JWT
 → equipment-qr-admin
 → validação JWT/perfil/rate limit
 → geração de token/hash ou validação da ação
 → RPC PostgreSQL transacional
 → tabela de etiquetas + auditoria
 → URL pública com token bruto (somente na resposta)
 → QR/PNG/XLSX/impressão no navegador
```

## 14.6 Consulta pública

```text
QR físico
 → /consulta/equipamento/:token
 → GET /api/public/equipment/:token
 → Vercel proxy
 → Edge Function public-equipment
 → rate limit por IP
 → SHA-256(token)
 → lookup da etiqueta
 → equipamento + imagens
 → URLs assinadas de 5 min
 → DTO mínimo
 → normalização defensiva
 → cartão público
```

## 14.7 Relatórios

Não existe serviço analítico dedicado. Dashboard, análises e relatórios baixam listas completas e executam filtros/agregações com `useMemo`. Isso simplifica a arquitetura, mas transfere custo ao cliente e não escala bem para grandes volumes.

---

# 15. Dependências

## 15.1 Dependências principais

| Dependência | Função no projeto |
|---|---|
| `react`, `react-dom` | runtime da SPA |
| `react-router-dom` | rotas, redirects, parâmetros e navegação |
| `@tanstack/react-query` | estado remoto e cache |
| `@supabase/supabase-js` | Auth, banco, Storage, Functions e RPC |
| `tailwind-merge`, `clsx` | composição segura de classes via `cn` |
| `class-variance-authority` | variantes de componentes UI |
| `lucide-react` | ícones |
| `sonner` | notificações atuais |
| `next-themes` | provider de tema; forçado para light |
| `framer-motion` | animações |
| `recharts` | gráfico do dashboard |
| `qrcode` e `@types/qrcode` | geração e tipos de QR |
| `jspdf` | termo PDF |
| `write-excel-file` | XLSX de etiquetas |

## 15.2 Radix e shadcn

Os pacotes `@radix-ui/react-*` fornecem comportamento acessível para accordion, alert dialog, aspect ratio, avatar, checkbox, collapsible, context menu, dialog, dropdown, hover card, label, menubar, navigation menu, popover, progress, radio group, scroll area, select, separator, slider, slot, switch, tabs, toast, toggle, toggle group e tooltip.

Parte desses primitives está apenas disponível em `components/ui` e não aparece em fluxos atuais.

## 15.3 Controles complementares

| Dependência | Papel |
|---|---|
| `cmdk` | command palette primitive |
| `embla-carousel-react` | carousel primitive |
| `input-otp` | campo OTP |
| `react-day-picker` | calendário |
| `react-hook-form` | adapters de formulário shadcn |
| `@hookform/resolvers` | integração de schemas com formulários |
| `zod` | validação de schema; sem import direto identificado |
| `react-resizable-panels` | painéis redimensionáveis |
| `vaul` | drawer |
| `tailwindcss-animate` | animações Tailwind |
| `date-fns` | suporte de datas da biblioteca de UI; sem uso direto nas páginas |
| `html2canvas` | declarado, sem import identificado no código atual |
| `util-deprecate` | compatibilidade transitiva/declarada; sem uso direto |

## 15.4 Dependências de desenvolvimento

- Vite, plugin React SWC e TypeScript: build/typecheck.
- ESLint, TypeScript ESLint, plugins React Hooks/Refresh e globals: lint.
- Tailwind, typography, PostCSS e Autoprefixer: CSS.
- `dotenv`: scripts Node.
- `pg`: conexão PostgreSQL direta.
- tipos Node/React/React DOM.
- `lovable-tagger`: tooling Lovable; não configurado no Vite atual.

## 15.5 Observações de dependências

- Há `package-lock.json` e `bun.lockb`, abrindo possibilidade de divergência entre gerenciadores.
- Testes importam `fflate`, disponível de forma transitiva; não está declarado diretamente.
- Algumas dependências estão instaladas para a biblioteca shadcn, não para funcionalidades usadas.

---

# 16. Configurações

## 16.1 `vite.config.ts`

- plugin React SWC;
- porta fixa `8082`;
- `strictPort: true`;
- overlay HMR desabilitado;
- alias `@` → `src`.

## 16.2 TypeScript

- projeto referenciado em app e node;
- frontend ES2020, node ES2022;
- module resolution `bundler`;
- `noEmit`;
- JSX automático;
- strict mode desabilitado no app;
- `noImplicitAny`, unused e fallthrough permissivos;
- `skipLibCheck`.

Essa configuração facilita evolução rápida, mas reduz garantias estáticas.

## 16.3 ESLint

Usa recomendações JS/TypeScript, React Hooks e React Refresh. Ignora `dist`, desabilita erro de unused vars e permite exports auxiliares em arquivos de componente.

## 16.4 Tailwind/PostCSS

- dark mode por classe;
- cores semânticas por CSS variables;
- breakpoints/conteúdo padrão;
- sombras e raios personalizados;
- fontes Inter/Manrope com fallback;
- plugin de animação;
- PostCSS com Tailwind e Autoprefixer.

O `ThemeProvider` força tema claro, apesar de diversas classes dark existirem.

## 16.5 `components.json`

Configura shadcn:

- estilo default;
- sem React Server Components;
- TypeScript;
- base slate;
- CSS variables;
- aliases de components/ui/lib/hooks.

## 16.6 `vercel.json`

Define headers da rota pública e rewrite SPA. O negative lookahead exclui somente `api/public/equipment`; o comportamento das demais rotas `/api`, em particular `/api/equipment-qr`, deve ser validado na Vercel, pois o frontend atual não depende desse proxy.

## 16.7 Variáveis

O conjunto real encontrado é:

| Variável | Ambiente | Uso |
|---|---|---|
| `VITE_SUPABASE_URL` | browser/scripts | URL Supabase |
| `VITE_SUPABASE_ANON_KEY` | browser/scripts | chave anônima |
| `VITE_ENABLE_SUPABASE` | browser | habilita cliente |
| `VITE_SUPABASE_VERIFY_ON_START` | browser | smoke check |
| `VITE_BOOTSTRAP_ADMIN` | browser | bootstrap inseguro |
| `SUPABASE_URL` | server/scripts | URL server-side |
| `SUPABASE_ANON_KEY` | server | proxy/Edge Function |
| `SUPABASE_SERVICE_ROLE_KEY` | server/scripts | privilégio total |
| `SUPABASE_DB_URL` | scripts | PostgreSQL direto |
| `SUPABASE_DB_PASSWORD` | scripts | composição de conexão |
| `AUTH_RATE_LIMIT_SALT` | Edge Functions | chave de hash de rate limit |
| `ALLOWED_APP_ORIGINS` | auth Edge Function | CORS |
| `PUBLIC_APP_URL` | QR Edge Functions | URL pública |
| `ENABLE_PUBLIC_EQUIPMENT_QR` | Edge Function | feature flag |
| `ENABLE_EQUIPMENT_QR_LABELS` | documentação/env example | ativação operacional; não lida diretamente no código mostrado |
| `VITE_API_URL`, `API_URL` | scripts legados | APIs externas |

`.env.example` está incompleto e usa `HELPDESK_BASE_URL`, `ADMIN_NUMBERS`, `BOT_PORT`, `CHROME_PATH` e `WPP_HEADLESS`, que não são lidas pelo código runtime presente.

## 16.8 Scripts npm

- `dev`, `build`, `build:dev`, `preview`, `lint`;
- `test:equipment-qr`;
- `db:apply`, `db:verify`, `db:verify:http`, `db:test:schema`;
- `db:reset-seed:kmz`.

O script de teste nomeado executa apenas `equipment-qr-labels.test.mjs`, não os outros dois arquivos de teste.

---

# 17. Pontos de Atenção

## 17.1 Débitos técnicos

1. **Páginas monolíticas:** seis páginas concentram centenas de linhas, múltiplos modais, regras e serviços.
2. **Tipos duplicados/adaptados:** páginas criam `User`, `Ticket`, `Product` e aliases próprios.
3. **Relações textuais:** usuário e setor são copiados como texto, exigindo sincronização manual.
4. **Serviços sem guarda de cliente:** `supabase` pode ser `undefined`, mas muitos serviços assumem existência.
5. **Ausência de paginação:** listas completas são carregadas.
6. **Analytics no cliente:** custo cresce linearmente com os dados.
7. **Tratamento de erro inconsistente:** toast, alert, confirm nativo e mensagens locais coexistem.
8. **Código legado/dormante:** layouts, hooks, components e scripts sem uso.
9. **Configuração TypeScript permissiva:** muitos `any` e null checks não estritos.
10. **Sem camada de testes de páginas/serviços CRUD.**

## 17.2 Inconsistências funcionais

- VIP tem permissão de rota para análises, mas menu não mostra links.
- Usuário padrão vê link Dashboard, mas não tem permissão.
- `register` e recuperação de senha não funcionam.
- editar/excluir saída não recalcula estoque no schema-base.
- atualização de usuário tenta tabelas/colunas não definidas no schema-base.
- título da página Equipamentos é “Análise de Equipamentos”, apesar de ser gestão CRUD.
- formato QR `100x40` não é aceito diretamente pelo backend e é convertido.
- o endpoint proxy QR existe, mas os componentes invocam a Edge Function diretamente.

## 17.3 Divergência de schema e migrações

O schema-base:

- desativa RLS;
- cria bucket público;
- não inclui `auth_user_id`, QR, rate limit e satisfação em sua forma principal.

Migrações posteriores:

- habilitam RLS seletivo;
- tornam imagens privadas/admin;
- introduzem Auth e QR.

Executar apenas `db:apply` não reproduz necessariamente o estado esperado pelo código mais recente. É necessário definir uma sequência canônica.

## 17.4 Riscos de segurança

- credenciais legadas em texto puro até migração;
- bootstrap `admin/admin`;
- criação/alteração de usuário e senha via frontend/PostgREST;
- RLS incompleto para domínios operacionais;
- autorização de tela não protege API;
- URLs oficiais hardcoded;
- ausência de recuperação/rotação de senha;
- deleção de usuário pode divergir do correspondente `auth.users`.

## 17.5 Riscos operacionais

- `reset-seed-kmz` é destrutivo;
- scripts podem usar anon key para operações administrativas;
- dois lockfiles;
- ambientes podem estar em versões distintas do schema;
- `BarcodeDetector` não é universal;
- impressão física depende de configuração externa do navegador/impressora;
- PDF/Canvas podem variar por browser e fonte instalada;
- nenhum monitoramento/telemetria é visível.

## 17.6 Melhorias possíveis

- decompor páginas por feature;
- introduzir adaptadores/DTOs e validação Zod;
- centralizar autorização em matriz única;
- criar APIs/RPCs server-side para CRUD sensível;
- substituir relações textuais por FKs, preservando snapshots quando necessário;
- criar migration baseline única e ferramenta de status;
- adicionar paginação/filtros server-side;
- criar testes de integração, componentes e E2E;
- declarar dependências de teste diretas;
- alinhar `.env.example`;
- padronizar erros e confirmações;
- implementar recuperação e gestão de senha;
- documentar/automatizar deployment de Edge Functions.

## 17.7 Elementos cujo estado não pode ser determinado

- quais migrações foram aplicadas no Supabase remoto;
- se o bucket está público ou privado em produção;
- políticas RLS adicionais criadas fora do repositório;
- secrets e flags efetivamente configurados;
- existência das APIs de bot;
- existência de CI/CD externo;
- volume de dados e requisitos de performance;
- requisitos formais de SLA, retenção e LGPD;
- quais componentes legados ainda são usados por branches/deploys externos.

---

# 18. Guia para Novos Desenvolvedores

## 18.1 Pré-requisitos

- Node.js compatível com Vite 5;
- npm;
- projeto Supabase autorizado;
- variáveis públicas de desenvolvimento;
- para administração de banco: PostgreSQL connection string ou password;
- para Edge Functions: Supabase CLI/Deno conforme processo da equipe, não documentado integralmente no repositório.

## 18.2 Início local

```bash
npm install
npm run dev
```

A aplicação usa a porta `8082` e falha se estiver ocupada.

Configuração mínima do frontend:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_ENABLE_SUPABASE=1
VITE_SUPABASE_VERIFY_ON_START=0
VITE_BOOTSTRAP_ADMIN=0
```

Não use `SUPABASE_SERVICE_ROLE_KEY` em variável `VITE_*`.

## 18.3 Banco

Antes de aplicar SQL:

1. identificar o estado atual do banco;
2. ler `supabase/schema.sql`;
3. ler as migrações de autenticação, QR e imagens;
4. conferir os documentos de rollout;
5. executar verificações em ambiente não produtivo;
6. não usar o reset seed em ambiente com dados reais.

Comandos disponíveis:

```bash
npm run db:verify
npm run db:verify:http
npm run db:test:schema
```

`db:apply` aplica somente `schema.sql`; não representa automaticamente todas as migrações posteriores.

## 18.4 Leitura recomendada

1. `src/App.tsx`;
2. `src/contexts/AuthContext.tsx`;
3. `src/components/Layout/MainLayout.tsx` e `Sidebar.tsx`;
4. `src/lib/api/*`;
5. página do domínio a alterar;
6. `supabase/schema.sql` e migrações relacionadas;
7. Edge Function, se a operação for privilegiada;
8. testes existentes.

## 18.5 Convenções observadas

- alias `@/`;
- entidades em português no banco/frontend;
- DTO público e QR em camelCase;
- queries por chave de entidade;
- invalidar cache depois de mutação;
- toasts Sonner para feedback;
- Tailwind para estilo;
- campos de nome/setor frequentemente normalizados para maiúsculas;
- funções server-side retornam mensagens genéricas em cenários sensíveis.

## 18.6 Validação de mudanças

```bash
npm run lint
npm run test:equipment-qr
node --experimental-strip-types --test tests/equipment-images.test.mjs
node --experimental-strip-types --test tests/public-equipment-response.test.mjs
npm run build
```

Além disso:

- testar perfis admin, VIP e padrão;
- testar viewport móvel;
- verificar sessão expirada/refresh;
- validar RLS no ambiente alvo;
- para QR, testar origem oficial, token revogado e rate limit;
- para imagens, validar Storage privado e URLs assinadas;
- para estoque, confirmar efeitos de edição/exclusão de saída.

## 18.7 Como adicionar funcionalidade

- UI reutilizável → `components/shared`;
- primitive → `components/ui`;
- regra de domínio pura → `lib`;
- acesso a dados → `lib/api`;
- segredo/privilégio → Edge Function/API server-side;
- operação multi-tabela → RPC transacional;
- tipo público → DTO explícito e minimizado;
- mudança de banco → migração aditiva, verificação e rollback.

---

# 19. Glossário

| Termo | Significado no sistema |
|---|---|
| Chamado | Solicitação de atendimento |
| Solicitante | Pessoa em nome de quem o chamado é aberto |
| Usuário | Campo do chamado usado como responsável/técnico; também entidade de acesso, conforme contexto |
| VIP | Usuário com prioridade diferenciada; chamado VIP é forçado para alta |
| Padrão | Usuário sem privilégios administrativos/VIP |
| Admin | Perfil com acesso completo e operações QR |
| Setor | Unidade organizacional textual |
| Ativo/equipamento | Item do inventário de TI |
| Patrimônio | Código único do equipamento e, em muitos fluxos, código visível da etiqueta |
| Produto | Consumível ou item controlado em estoque |
| Saída | Registro de redução de estoque |
| `UNUSED` | Etiqueta gerada e ainda não vinculada |
| `BOUND` | Etiqueta ativa vinculada |
| `REVOKED` | Etiqueta invalidada por revogação |
| `VOID` | Etiqueta anulada; tipo suportado, sem fluxo de UI explícito |
| Reissue | Rotação do token de uma etiqueta |
| Token QR | Segredo aleatório presente na URL pública |
| Token hash | SHA-256 persistido no banco |
| DTO | Objeto de transferência com contrato controlado |
| RLS | Row Level Security do PostgreSQL/Supabase |
| RPC | Função PostgreSQL chamada via Supabase |
| Service role | Chave server-side que ignora RLS; altamente sensível |
| Chave anônima | Chave pública do Supabase, segura somente quando combinada com RLS |
| Edge Function | Função Deno executada na infraestrutura Supabase |
| PostgREST | API REST gerada sobre PostgreSQL |
| URL assinada | Link temporário para objeto privado no Storage |
| Query key | Identificador de cache do TanStack Query |
| Invalidação | Marcação de cache para nova busca |
| Magic bytes | Assinatura binária usada para validar o conteúdo da imagem |
| Zebra | Alvo de impressão de etiquetas; integração atual é por arte/XLSX, não SDK |
| Migração legada | Conversão gradual de login antigo para Supabase Auth |
| E-mail técnico | `<uuid-do-perfil>@internal.invalid`, usado internamente pelo Auth |

---

# 20. Resumo Final

O CONCREM Help Desk é uma SPA React/TypeScript que usa Supabase como plataforma de autenticação, banco, Storage e execução server-side. O frontend é organizado por páginas, componentes e módulos de serviço, com TanStack Query para estado remoto e Context API para autenticação, responsividade e layout.

O núcleo funcional cobre chamados, inventário, usuários, setores, produtos, saídas, relatórios e indicadores. Administradores possuem a experiência mais ampla; VIPs acessam dashboard e análises por permissão de rota; usuários padrão operam chamados. O subsistema QR é a área arquiteturalmente mais protegida: tokens de alta entropia, hash no banco, rate limit, autorização dupla, RPCs transacionais, auditoria e contrato público reduzido.

A autenticação está em transição de um modelo legado, no qual `app_users.password_hash` contém credencial em texto puro, para Supabase Auth. A Edge Function migra cada usuário no login, exige upgrade de senhas curtas e passa a usar sessão com access/refresh tokens. O contexto restaura e renova essa sessão no navegador.

Os principais riscos estão na coexistência de schema-base de desenvolvimento e migrações de produção, RLS não documentado integralmente para entidades operacionais, criação de usuários/senhas pelo frontend, bootstrap admin inseguro quando habilitado, relações textuais e páginas muito grandes. Também há código e scripts possivelmente legados.

Para operar a solução com segurança, a equipe deve tratar as migrações mais recentes — e não apenas `schema.sql` — como parte essencial do deploy, confirmar RLS e Storage no ambiente remoto, manter secrets somente no servidor e desativar flags de bootstrap. Para evoluir, as prioridades técnicas são consolidar o baseline do banco, mover operações sensíveis para o backend, unificar autorização e decompor páginas por domínio.

Este documento não afirma o estado do ambiente hospedado, porque credenciais, políticas remotas e histórico de aplicação das migrações não estão disponíveis no repositório. Tudo que depende desse estado deve ser validado diretamente no projeto Supabase/Vercel antes de decisões operacionais.
