

## Plano: Redesign geral — pegada Apple/Glassmorphism

### Diagnóstico visual atual

Inspecionei `/cadastros`, dashboard (`Index.tsx`), `HorariosMedicoDialog`, `ListaFeedbacks`, `KpiCard`, `AppShell` e `index.css`. Problemas reais encontrados:

1. **Inconsistência de tamanhos** — botões "Horários" (`size=sm`), "Gerar agenda" (`size=sm` com texto longo) e ícones de editar/remover (`size=icon` 36px) brigam visualmente na linha de ações.
2. **Cards de feedback** — `ListaFeedbacks` usa `Card` cru, sem hierarquia, com estrelas pequenas e nome em peso igual ao comentário. KPIs (`KpiCard`) já têm glow, mas feedbacks/listas não acompanham.
3. **HorariosMedicoDialog compacto** — `LinhaHorarioSortable` espreme drag handle + select + 2 inputs hora + duração + 2 botões em uma única linha sem respiro; preview semana abaixo aparece colado.
4. **Falta linguagem visual unificada** — não existe "glass surface" reutilizável; cards usam `bg-card` chapado em cima do gradiente do body, perdendo a profundidade que o `index.css` já prepara.
5. **Tipografia** — sem hierarquia clara (tudo `text-sm`/`text-base`), sem tracking apertado nos títulos (estilo Apple).
6. **Sidebar/AppShell** — funcional mas sem o blur/translucidez que define glassmorphism.

### O que vou entregar

**Não vou reescrever tudo** — vou criar **primitivos** e aplicar nos pontos críticos.

#### 1. Sistema de design (tokens + classes)
- `src/index.css`: adicionar tokens `--glass-bg`, `--glass-border`, `--glass-blur` e classes utilitárias `.glass-card`, `.glass-panel`, `.glass-subtle` (backdrop-blur + bg translúcido + borda 1px com gradiente sutil).
- Refinar tipografia: `font-feature-settings` com `cv11`, headings com `tracking-tight` e `font-semibold`.
- Adicionar `--shadow-soft` e `--shadow-pop` para hierarquia de elevação Apple-like.

#### 2. Componente novo: `GlassCard`
- `src/components/ui/glass-card.tsx` — wrapper sobre `Card` com blur, borda gradiente sutil e hover lift opcional. Reutilizável em feedbacks, KPIs futuros, dialogs.

#### 3. Refatorar `LinhaHorarioSortable`
- Layout em **2 linhas** dentro de um glass-row: linha 1 = handle + dia (chip maior) + ações; linha 2 = inputs hora-início → hora-fim → duração com labels micro acima.
- Aumentar altura, espaço entre campos, ícones 16px alinhados verticalmente.
- Estado de conflito (já existente) ganha borda animada vermelha + ícone `AlertTriangle` lucide.

#### 4. Refatorar `HorariosMedicoDialog`
- Header com avatar/inicial do médico em círculo glass + nome grande.
- Botões "Aplicar template" e "Adicionar linha" mesma altura (`size="default"`), agrupados em toolbar com separador.
- `PreviewSemana` ganha card próprio com título e fica em coluna lateral em telas ≥1280px (grid 2 col), empilhado abaixo em telas menores.

#### 5. Refatorar `ListaFeedbacks` (e `ListaAtendimentos` por consistência)
- Cada item vira `GlassCard` com: avatar circular (inicial + cor por nota), nome em `font-semibold tracking-tight`, estrelas maiores (16px) com cor `--accent-amber`, comentário em `text-muted-foreground` itálico, timestamp à direita.
- Hover: lift sutil + glow.

#### 6. Padronizar botões da `MedicosTab`
- Todos os botões de ação na mesma altura (`size="sm"` h-9), ícones 14px, gap consistente. "Gerar agenda" e "Horários" como `variant="outline"` com hover primary; editar/remover como `variant="ghost" size="icon" className="h-9 w-9"` para casar altura.

#### 7. AppShell / Sidebar
- Sidebar ganha `backdrop-blur-xl` + `bg-sidebar/70` para flutuar sobre o gradiente do body.
- Topbar (se houver) idem.

### Arquivos afetados

```text
src/index.css                                       ← tokens glass + tipografia
src/components/ui/glass-card.tsx                    ← NOVO
src/components/cadastros/LinhaHorarioSortable.tsx   ← layout 2 linhas
src/components/cadastros/HorariosMedicoDialog.tsx   ← header + grid + toolbar
src/components/cadastros/MedicosTab.tsx             ← padronizar alturas botões
src/components/cadastros/PreviewSemana.tsx          ← card próprio + título
src/components/dashboard/ListaFeedbacks.tsx         ← GlassCard + avatar + estrelas
src/components/dashboard/ListaAtendimentos.tsx      ← mesma linguagem
src/components/dashboard/KpiCard.tsx                ← migrar para glass-card
src/components/layout/AppShell.tsx                  ← sidebar translúcida
```

### Fora de escopo

- Não troco paleta de cores (azul-marinho + acentos já está coerente com Apple dark).
- Não mudo estrutura de rotas, lógica de queries ou n8n.
- Não adiciono libs novas — `backdrop-blur` é nativo do Tailwind.
- Não mexo em `/agenda` ainda; se ficar bom no dashboard + cadastros, replicamos depois.

### Resultado esperado

Visual coeso tipo macOS Sonoma / iOS 17: superfícies translúcidas com blur sobre o gradiente do body, hierarquia tipográfica clara, botões com mesma altura, cards de feedback respiráveis, dialog de horários organizado em grid com preview lateral.

