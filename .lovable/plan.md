

Vou fazer um redesign visual focado em deixar o painel com cara profissional/premium, mantendo dark mode como padrão.

## Plano: Refinamento visual do painel (dark profissional)

### 1. Paleta dark enriquecida (`src/index.css`)

Substituir os tokens HSL atuais por uma paleta mais rica:

- **`--background`**: azul-marinho profundo (`222 47% 6%`) ao invés do quase-preto chapado
- **`--card`**: tom levemente mais claro com leve azul (`222 40% 9%`) para destacar do fundo
- **`--primary`**: azul vibrante elétrico (`217 91% 60%`) — substitui o branco atual
- **`--primary-foreground`**: branco puro
- **`--secondary` / `--muted`**: `217 33% 14%` (mais frio, com personalidade)
- **`--border`**: `217 33% 18%` com sutil tonalidade azul
- **`--ring`**: alinhar com o novo primary
- Novos tokens para acentos KPI: `--accent-emerald`, `--accent-amber`, `--accent-violet`, `--accent-rose` (cada um com hue rica)
- Novos tokens de gradiente: `--gradient-surface`, `--gradient-primary`, `--gradient-glow`
- Novos tokens de sombra: `--shadow-card`, `--shadow-glow` (sombras coloridas com primary)

### 2. Tailwind config (`tailwind.config.ts`)

- Adicionar as cores semânticas novas (accent-emerald, etc.) referenciando os tokens HSL
- Adicionar `backgroundImage` com os gradientes (`gradient-surface`, `gradient-primary`, `gradient-glow`)
- Adicionar `boxShadow` (`card`, `glow`, `glow-primary`)
- Manter HSL puro nos tokens (sem hardcode de cor nos componentes)

### 3. Body com gradiente sutil (`src/index.css`)

- Aplicar `background-image` radial sutil no body (dois pontos de luz azul/violeta bem suaves no canto superior) para dar profundidade sem distrair

### 4. KpiCard com acentos coloridos (`src/components/dashboard/KpiCard.tsx`)

- Trocar paleta hardcoded (`emerald-500/15`, `amber-500/15`) pelos novos tokens semânticos
- Adicionar gradiente sutil no fundo do card (`bg-gradient-surface`)
- Adicionar glow/sombra colorida sutil no ícone que combina com o accent
- Borda mais refinada (`border-border/60`)
- Hover state com leve elevação

### 5. AppShell mais polido (`src/components/layout/AppShell.tsx`)

- Header com `bg-background/60` + `backdrop-blur-xl` + borda sutil
- Logo box com `bg-gradient-primary` ao invés de `bg-primary` chapado + glow
- Item de nav ativo: `bg-primary/15` + `text-primary` + borda inferior animada (mais sofisticado que botão sólido)
- Subtítulo do header em `text-primary/70` para um toque de cor

### 6. Cards do dashboard

- Aplicar `shadow-card` + borda `border-border/60` consistentemente
- Charts (`ChartAgendamentos`, `ChartEspecialidades`): atualizar cores de série para usar a nova paleta vibrante (azul primary + accents emerald/violet/amber/rose)
- Headers de seção com hierarquia tipográfica mais clara

### 7. Status badges (`src/lib/status.ts`)

- Refinar cores dos status para combinar com a nova paleta (mais saturadas/legíveis no novo dark)

### Princípios

- **Tudo via tokens HSL** — zero cor hardcoded em componentes
- **Português** em todo texto novo
- **Dark-first**: o tema claro é mantido funcional mas o foco é o dark
- **Sutil, não barulhento**: gradientes a 5-10% de opacidade, glows discretos

### Arquivos editados

```
src/index.css
tailwind.config.ts
src/components/dashboard/KpiCard.tsx
src/components/layout/AppShell.tsx
src/components/dashboard/ChartAgendamentos.tsx
src/components/dashboard/ChartEspecialidades.tsx
src/lib/status.ts
```

