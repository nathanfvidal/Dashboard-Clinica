

## Plano: Correção dos problemas visuais identificados

### Problemas reais que verifiquei no preview

**1. Prévia da semana (modal de Horários) — crítico**
Colunas espremidas truncando horários ("08:0", "06:3"), spinners verticais nativos do `<input type="time">` aparecem em cada linha do scroll do preview, badge "108 slots/semana" muito grande competindo com "Prévia da semana", coluna DOM vazia ocupando mesma largura. A prévia tenta mostrar 20 slots por dia em colunas de ~70px — não cabe.

**2. Inputs de hora em formato AM/PM**
Os campos "08:00 AM" / "06:00 PM" no editor de horários aparecem em formato 12h porque o navegador respeita a locale do SO. Precisa forçar 24h via atributo + CSS para esconder o seletor AM/PM.

**3. Inputs de data em formato US (mm/dd/yyyy)**
Filtro de "Data" na agenda e "Gerar agenda" mostram placeholder US. Mesmo problema — locale.

**4. Mês com capitalização errada**
"Abril De 2026" — "De" capitalizado no meio (causa: `capitalize` no Tailwind aplica em cada palavra).

**5. Botões "Horários" e "Gerar agenda" ainda muito grandes em relação aos ícones de editar/excluir**
Na linha do médico, os 4 botões têm tamanhos muito diferentes (botão com texto vs. ícone puro). Falta hierarquia.

### O que vou fazer

**A. Refazer a Prévia da semana** (`PreviewSemana.tsx`)
- Trocar lista vertical de horários por **heatmap compacto**: cada dia vira uma coluna com blocos coloridos representando faixas horárias (não cada slot individual). Tipo: bloco verde 08–12, bloco verde 14–18.
- Mostrar contagem total no topo do dia (ex: "20") como badge discreto.
- No hover de um dia, abrir popover com a lista completa de horários daquele dia.
- Remover o scroll vertical interno em cada coluna — fica plano.

**B. Forçar 24h nos inputs de tempo e PT-BR nos inputs de data**
- Criar componentes leves `TimeInput24` e `DateInputBR` em `src/components/ui/` que envolvem `<input>` com:
  - `lang="pt-BR"` no input
  - CSS escondendo `::-webkit-calendar-picker-indicator` quando necessário
  - Para tempo: validação que aceita só formato HH:MM
- Substituir nos pontos críticos: `LinhaHorarioSortable`, filtro de data em `Agenda.tsx`, `GerarAgendaButton`.

**C. Corrigir capitalização do título do mês**
- Em `CalendarioMes.tsx`, trocar `capitalize` por uma função `capitalizeFirst` que só capitaliza o primeiro caractere → "Abril de 2026".
- Aplicar mesmo fix em `CalendarioSemana` se necessário.

**D. Padronizar ações na linha de médico**
- Na `MedicosTab`, agrupar "Horários" e "Gerar agenda" como botões `outline` `size=sm h-8` com mesmo padding, e separá-los visualmente dos ícones de editar/excluir com `Separator` vertical.
- Ou alternativa: transformar "Gerar agenda" num item dentro de um menu `…` (DropdownMenu) ao lado dos ícones, deixando só "Horários" como botão visível.

### Arquivos afetados

- `src/components/cadastros/PreviewSemana.tsx` — refazer como heatmap
- `src/components/cadastros/LinhaHorarioSortable.tsx` — input 24h
- `src/components/ui/time-input.tsx` (novo) — wrapper 24h
- `src/components/ui/date-input.tsx` (novo) — wrapper PT-BR
- `src/pages/Agenda.tsx` — usar DateInputBR no filtro
- `src/components/cadastros/GerarAgendaButton.tsx` — usar DateInputBR
- `src/components/agenda/CalendarioMes.tsx` — fix capitalização
- `src/components/cadastros/MedicosTab.tsx` — padronizar botões da linha

### Fora de escopo

- Não vou refatorar a estrutura do dialog (grid, dnd-kit) — está funcional.
- Não vou mexer no dashboard nem nas visões Semana/Mês da agenda — visualmente estão ok.
- Não adiciono libs novas (uso só Tailwind + componentes existentes).

