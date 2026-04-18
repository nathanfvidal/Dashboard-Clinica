

## Plano: Feedback no n8n + Tela de Agenda + Dashboard

Três entregas paralelas: nova tool no fluxo n8n, página de gestão da agenda, e dashboard com tempo real.

### 1. Banco de dados (migration)

Criar tabela `feedbacks` para armazenar avaliações pós-consulta:

- `id` uuid PK
- `agendamento_id` uuid (referência opcional ao agendamento)
- `paciente_telefone` text
- `paciente_nome` text
- `nota` int (1 a 5)
- `comentario` text
- `created_at` timestamptz default now()

RLS habilitado. Como o app ainda não tem auth, aplico policies públicas de leitura (dashboard) e insert (n8n usa anon key, igual às outras tabelas). Aviso o usuário sobre necessidade de auth para produção.

### 2. Nova tool no n8n — "Tool Registrar Feedback"

Adiciono um novo node `@n8n/n8n-nodes-langchain.toolHttpRequest` conectado ao `AI Agent Sofia` via `ai_tool`, seguindo o mesmo padrão das tools existentes (Salvar Paciente, Confirmar Agendamento).

- Método: POST
- URL: `https://opzeqlcpmbmaugtdaipx.supabase.co/rest/v1/feedbacks`
- Headers: apikey + Authorization (anon key) + `Content-Type: application/json` + `Prefer: return=representation`
- Body com placeholders descritos para a IA: `paciente_telefone`, `paciente_nome`, `nota` (1-5), `comentario`, `agendamento_id` (opcional)
- Descrição da tool orientando a Sofia a chamar após a consulta concluída, perguntando nota e comentário curto

Atualizo também o system prompt do AI Agent Sofia para incluir instrução de coletar feedback quando o paciente sinalizar fim do atendimento.

### 3. Tela de gestão da agenda — `/agenda`

Nova rota com CRUD manual de `agendamentos`:

- **Lista**: tabela com data, horário, médico, especialidade, paciente, telefone, status (badge colorido)
- **Filtros**: por data (date picker), médico, especialidade, status
- **Ações por linha**: Confirmar, Cancelar, Editar (dialog)
- **Botão "Novo agendamento"**: dialog com form (especialidade, médico, data, horário, telefone, nome) — usa `@hookform/resolvers` + zod
- Realtime subscription no Supabase para refletir mudanças vindas do bot

Componentes shadcn: Table, Dialog, Form, Input, Select, Calendar, Badge, Button.

### 4. Dashboard tempo real — `/` (Index)

Substitui o placeholder atual. Layout:

```text
┌──────────────────────────────────────────────────┐
│  KPIs: Agend. hoje | Pacientes | Fila humana | Feedback médio │
├─────────────────────────┬────────────────────────┤
│  Agendamentos por dia   │  Por especialidade     │
│  (gráfico linha)        │  (gráfico pizza)       │
├─────────────────────────┴────────────────────────┤
│  Últimos atendimentos humanos (tabela + ação finalizar) │
├──────────────────────────────────────────────────┤
│  Últimos feedbacks (estrelas + comentário)       │
└──────────────────────────────────────────────────┘
```

- Filtros globais: status + especialidade
- Realtime via `supabase.channel()` em `agendamentos`, `atendimentos_humanos`, `pacientes`, `feedbacks`
- Recharts para gráficos
- Navegação topo entre Dashboard e Agenda

### 5. Estrutura de arquivos

- `src/pages/Index.tsx` → dashboard
- `src/pages/Agenda.tsx` → gestão de agenda
- `src/components/layout/AppShell.tsx` → header com nav
- `src/components/dashboard/*` → KpiCard, ChartAgendamentos, ChartEspecialidades, ListaAtendimentos, ListaFeedbacks
- `src/components/agenda/*` → AgendamentoForm, AgendamentoTable, AgendamentoFilters
- `src/hooks/useRealtimeTable.ts` → hook genérico de subscription
- `src/App.tsx` → adicionar rota `/agenda`

### 6. Detalhes técnicos

- React Query para fetch + invalidação após realtime event
- Datas formatadas com `date-fns` (locale pt-BR já implícito via formato)
- Status com cores: confirmado=verde, pendente=amarelo, cancelado=vermelho, finalizado=cinza
- Toda a UI em português, sem menções a "Lovable"
- Tailwind + tokens do design system existente

### 7. Aviso importante

As tabelas estão sem policies RLS hoje. Vou criar policies permissivas (igual padrão atual do projeto pra o bot continuar funcionando com anon key), mas recomendo fortemente adicionar autenticação antes de publicar — caso contrário qualquer pessoa com a URL pode ver/alterar agendamentos.

