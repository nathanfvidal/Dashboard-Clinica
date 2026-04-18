

## Plano: Cadastro de Médicos, Especialidades e Horários (com integração total ao n8n)

### Diagnóstico do estado atual

**No n8n (tool `Buscar Agenda`):**
- Especialidades estão hardcoded em um `espMap` de 6 itens
- Tool consulta `agendamentos WHERE especialidade=X AND status='disponivel' AND data>=hoje` — ou seja, espera "slots" pré-criados na própria tabela `agendamentos`
- Médicos só existem como string livre (`agendamentos.medico`)
- Não há cadastro de especialidades nem de horários por médico

**No app:**
- Form de agendamento pede `especialidade` e `medico` como input texto livre — qualquer typo quebra o match com o n8n
- Banco está vazio, bot da Sofia nunca acha horários

**Problema central:** dados não-normalizados. Vamos criar estrutura relacional + ajustar n8n e app pra usá-la.

### 1. Banco de dados (migration)

Três novas tabelas:

```text
especialidades (id, nome UNIQUE, descricao, icone, ativo)
medicos        (id, nome, especialidade_id FK, crm, telefone, ativo)
horarios_medico (id, medico_id FK, dia_semana 0-6, hora_inicio, hora_fim,
                 duracao_consulta_min, ativo)
```

**Seed inicial** com as 6 especialidades atuais + 2 médicos exemplo (Dr. Carlos Silva — Cardiologia, Dra. Ana Santos — Dermatologia) + horários padrão (seg-sex 08:00-18:00, sáb 08:00-12:00, slots de 30min).

**Alterar `agendamentos`:** adicionar colunas `medico_id uuid` e `especialidade_id uuid` (mantém os campos texto pra compatibilidade durante transição).

RLS permissivo (mesmo padrão atual).

### 2. Nova tela `/cadastros` no app

Tabs com 3 sub-páginas:

- **Especialidades**: lista + criar/editar/desativar (nome, descrição, ícone emoji)
- **Médicos**: lista + criar/editar (nome, especialidade dropdown, CRM, telefone, ativo)
- **Horários**: ao abrir um médico, mostrar grade semanal editável (dia da semana × hora início/fim × duração). Botão "Aplicar template padrão".

Componentes shadcn: Tabs, Table, Dialog, Form, Select, Switch, Input.

### 3. Atualizar form de agendamento

Substituir os Inputs livres de `especialidade` e `medico` por **Selects populados do banco**. Ao escolher médico, mostrar apenas datas/horários compatíveis com `horarios_medico`.

### 4. Geração de slots disponíveis

Função SQL `gerar_slots_disponiveis(medico_id, data_inicio, data_fim)` que:
- Lê `horarios_medico` do médico
- Gera todos os slots possíveis no intervalo
- Subtrai os já ocupados em `agendamentos` (status confirmado/pendente)
- Retorna lista de `{data, horario}` disponíveis

Botão "Gerar agenda do mês" no cadastro do médico que cria registros em `agendamentos` com `status='disponivel'` — assim a tool atual do n8n continua funcionando sem mudança no JS.

### 5. Atualizações no fluxo n8n

Vou editar via MCP:

- **Tool `Listar Especialidades`**: trocar lista hardcoded por GET em `/rest/v1/especialidades?ativo=eq.true`
- **Tool `Buscar Agenda`**: remover `espMap` hardcoded — buscar especialidade no banco por nome (ILIKE), depois buscar slots disponíveis
- **Tool `Buscar Agenda por Periodo`**: mesma mudança
- **Tool `Confirmar Agendamento`**: passar a salvar `medico_id` e `especialidade_id` além dos textos
- **System prompt da Sofia**: remover lista fixa de 6 especialidades — instruir a SEMPRE chamar `listar_especialidades` antes de oferecer opções

### 6. Estrutura de arquivos

```text
src/pages/Cadastros.tsx
src/components/cadastros/EspecialidadesTab.tsx
src/components/cadastros/MedicosTab.tsx
src/components/cadastros/HorariosMedicoDialog.tsx
src/components/cadastros/GerarAgendaButton.tsx
src/components/agenda/AgendamentoForm.tsx  (refactor pra usar selects)
src/hooks/useEspecialidades.ts
src/hooks/useMedicos.ts
supabase/migrations/*.sql                  (tabelas + seed + função)
```

Adicionar item "Cadastros" no `AppShell`.

### 7. Diagrama do fluxo final

```text
App /cadastros          n8n Sofia
   │                       │
   ├─ cria especialidade ──┼──► busca via tool
   ├─ cria médico         │
   ├─ define horários ────┼──► tool gera/lê slots
   └─ "gerar agenda mês"  │
            │             │
            ▼             ▼
         agendamentos (slots disponiveis)
            │             ▲
            └── paciente confirma via WhatsApp
```

### O que falta no app vs n8n (resumo)

| Item | n8n hoje | App hoje | Depois |
|------|----------|----------|--------|
| Especialidades | hardcoded (6) | texto livre | tabela + CRUD + tool dinâmica |
| Médicos | texto livre | texto livre | tabela + CRUD |
| Horários por médico | inexistente | inexistente | tabela + UI grade |
| Slots disponíveis | espera linha em `agendamentos` | não cria | botão "gerar agenda" |
| Pagamento/endereço | "consultar recepção" | inexistente | (fora deste plano) |
| Feedback pós-consulta | tool documentada, não criada no n8n | tabela existe | criar tool no n8n |

