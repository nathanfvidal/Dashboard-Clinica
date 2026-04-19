

## Análise da screenshot

A visão **Semana** está visualmente quebrada quando há muitos agendamentos:
- Cards no mesmo horário ficam **sobrepostos** ocupando toda a largura da coluna (left:1, right:1), gerando textos ilegíveis tipo "DraCarlosSilva14:0014:30".
- Sem cálculo de **altura por duração** — todos têm `minHeight:32px` e ocupam só o slot inicial.
- Sem **agrupamento de colisões** — quando 4 médicos atendem 14:00 no mesmo dia, os 4 cards ficam um em cima do outro.
- Texto do médico+horário se mistura porque o card é muito estreito e o `truncate` falha em containers flex aninhados.

E os outros pontos do dashboard que também merecem atenção:
- **Mês**: cards mostram `HH:MM medico` num span único — texto fica colado, sem hierarquia.
- **KPIs**: ok, mas sem trend/comparativo (semana vs semana).
- **ChartAgendamentos / ChartEspecialidades**: não vi mas provavelmente sem estados vazios elegantes.
- **ListaAtendimentos / ListaFeedbacks**: densidade alta, sem skeleton.

## Plano de melhorias visuais

### 1. Visão Semana — fix crítico de sobreposição (prioridade máxima)
- Implementar algoritmo de **lanes** (faixas verticais): para cada dia, agrupar agendamentos que se sobrepõem temporalmente e dividir a largura da coluna entre N lanes.
- Calcular `left` e `width` em % com base no índice da lane e total de lanes do grupo.
- Adicionar **altura proporcional à duração** (default 30 min = 28px). Como a tabela não tem `duracao_minutos`, assumir 30 min por padrão; tornar configurável depois.
- Reduzir conteúdo do card quando largura < 80px: mostrar só horário + iniciais do médico.
- Card com **flex-col** real, `overflow-hidden`, `text-ellipsis`, sem misturar horário com nome.

### 2. Visão Semana — refinamento visual
- Linhas de meia-hora sutis (border-dashed mais clara) pra dar referência sem poluir.
- Hover do card mostra tooltip com nome completo + paciente + status.
- Borda esquerda colorida (4px) por status em vez de tingir o card todo — fica mais legível em alta densidade.

### 3. Visão Mês — limpeza
- Quebrar conteúdo em duas linhas: `HH:MM` em mono pequeno + nome em peso normal.
- Limitar visíveis a **2** (não 3) em viewports menores; sempre mostrar `+N mais` clicável que abre Tabela filtrada no dia.
- Indicador de **densidade** (barra fina colorida no topo da célula proporcional ao nº de agendamentos).

### 4. Dashboard — polimento
- KPIs: adicionar **comparativo** vs ontem/semana passada (delta % com seta).
- Estado vazio (empty state) bonito nas listas e gráficos quando não há dados.
- Gráficos: paleta consistente com tokens HSL, gradient fill suave, eixos com labels truncadas.
- Skeletons enquanto carrega (substitui o "Carregando..." cru).

### 5. Tabela de Agenda — pequeno ajuste
- Larguras de coluna fixas pra evitar dança quando filtros mudam.
- Linha por status com borda esquerda colorida (mesma lógica dos cards).

## Detalhes técnicos

**Algoritmo de lanes (Semana)** — em `CalendarioSemana.tsx`:
```text
1. Para cada dia, ordenar agendamentos por (horario, duração).
2. Manter array de lanes; cada lane guarda fim do último evento.
3. Para cada agendamento: encontrar 1ª lane livre (fim <= início atual)
   ou criar nova. Atribuir laneIndex.
4. Após distribuir, agrupar agendamentos que colidem entre si
   (transitivamente) → totalLanes do grupo.
5. Renderizar com:
     left  = `${(laneIndex / totalLanes) * 100}%`
     width = `${(1 / totalLanes) * 100}%`
   menos 4px de gap interno.
```

**Sem nova tabela / migration** — usar duração default 30 min via constante `DURACAO_DEFAULT_MIN`. Quando o schema tiver `duracao_minutos`, é trocar a constante por `a.duracao_minutos ?? 30`.

**Arquivos a tocar**:
- `src/components/agenda/CalendarioSemana.tsx` — refatorar render dos cards (lanes + altura).
- `src/components/agenda/CalendarioMes.tsx` — melhorar tipografia das pílulas + densidade.
- `src/components/dashboard/KpiCard.tsx` — adicionar prop `delta` e renderização opcional.
- `src/pages/Index.tsx` — calcular deltas (hoje vs ontem, semana vs anterior).
- `src/components/dashboard/ChartAgendamentos.tsx` e `ChartEspecialidades.tsx` — empty state + paleta.
- `src/components/dashboard/ListaAtendimentos.tsx` e `ListaFeedbacks.tsx` — skeleton.

**Sem dependências novas** — tudo com Tailwind + lucide existentes.

## Escopo sugerido (foco no que dói mais)

Round 1 (essencial — resolve a screenshot):
- Lanes na Semana + altura proporcional + borda lateral por status.
- Tipografia limpa nos cards Mês.

Round 2 (polimento):
- KPIs com delta + skeletons + empty states + paleta de gráficos.

Posso fazer Round 1 + Round 2 em uma única passada se você confirmar.

