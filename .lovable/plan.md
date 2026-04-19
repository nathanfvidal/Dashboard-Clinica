

## Entendi

Remover totalmente a aba **Agenda** (página + rota + link no menu + componentes de calendário) e mostrar os agendamentos de forma simples direto no **Dashboard**, sem calendário/visões semana/mês — apenas uma lista/tabela enxuta dos próximos agendamentos.

## O que vou fazer

### 1. Excluir a aba Agenda
- Remover rota `/agenda` em `src/App.tsx`.
- Remover link "Agenda" do menu lateral em `src/components/layout/AppShell.tsx`.
- Deletar arquivos:
  - `src/pages/Agenda.tsx`
  - `src/components/agenda/CalendarioMes.tsx`
  - `src/components/agenda/CalendarioSemana.tsx`
  - `src/components/agenda/AgendamentoForm.tsx` (mover lógica de criar/editar pra um dialog simples no Dashboard, se necessário — ver pergunta abaixo)

### 2. Adicionar bloco "Agendamentos" no Dashboard
Em `src/pages/Index.tsx`, adicionar um card novo abaixo dos KPIs/gráficos com:
- Título "Próximos agendamentos"
- Tabela enxuta: Data | Hora | Médico | Especialidade | Paciente | Status
- Filtro inline simples: input de data + select de status (sem o overhead da página atual)
- Limite ~20 linhas, ordenado por data/hora ascendente, escondendo `disponivel`
- Reaproveitar `statusBadgeClass` e `useRealtimeTable("agendamentos", ...)`

### 3. Manter o que importa
- Botões de **confirmar/cancelar** inline (ícones lucide CheckCircle2/XCircle) usando o mesmo mutation pattern.
- Sem calendário, sem drag-and-drop, sem visão semana/mês.

## Pergunta rápida

Antes de executar preciso confirmar uma coisa:
