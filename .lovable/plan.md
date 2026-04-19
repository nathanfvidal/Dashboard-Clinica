

Vou refazer toda a bateria de testes assumindo que o v11 (com `checkExists: false`) já está importado e ativo. Plano enxuto:

## Execução

**Fase 0 — Descoberta** (`mcp_n8n_eJdzs--search_workflows` + `get_workflow_details`)
- Mapear v11 principal + 3 crons (D-1, T-2h, Pesquisa) + verificar se há "Reativar Sessão".
- Confirmar que os 4 nós Evolution estão com `options.checkExists=false`.

**Fase 1 — Baseline SQL** (`supabase--read_query`)
- Contar `mensagens`, `agendamentos`, `pacientes`, `atendimentos_humanos`, `feedbacks`, `solicitacoes`.
- Capturar timestamp de corte.

**Fase 2 — Bateria Sofia (16 cenários)** via `mcp_n8n_eJdzs--execute_workflow` com webhook nos telefones `5583912350001..016`:
- A. Fluxo feliz (1-5): oi, pediatria tarde, agendar+confirmar, remarcar, cancelar
- B. Tools (6-9): especialidades, médicos cardio, agenda período, feedback nota 5
- C. Handoff (10-11): pedir humano, segunda mensagem (bot mudo)
- D. Caos (12-16): emoji, filosofia, médico inexistente, ameaça, SQL injection

Entre cenários: 2s de espera. Após cada: SELECT pra provar efeito.

**Fase 3 — Crons auxiliares** no telefone `5583912350020`:
1. Inserir agendamento amanhã → executar cron D-1 → validar `lembrete_d1_enviado_at` + `mensagens.direcao='out'`
2. Inserir agendamento hoje+2h → executar cron T-2h → validar `lembrete_2h_enviado_at`
3. Inserir agendamento ontem confirmado → executar cron Pesquisa → validar `feedback_solicitado_at`

**Fase 4 — Validação SQL final**
- Provar 16 mensagens `in` + 16 mensagens `out` da Sofia + 3 mensagens `out` dos crons.
- Provar `agendamentos.status='confirmado'` no cenário 3, `cancelado` no 5.
- Provar linhas em `atendimentos_humanos`, `feedbacks`, `solicitacoes`.

**Fase 5 — Validação visual UI** (`browser--navigate_to_sandbox` + `browser--screenshot`)
- `/` Dashboard → KPIs subiram, gráficos, listas
- `/agenda` → slot confirmado colorido com nome
- `/cadastros` → contagens batem
- Screenshot 1952px de cada tela

**Fase 6 — Relatório** em `docs/n8n-teste-de-fogo-v12.md`:
- Tabela 1: 16 cenários × execId × tools × SQL × resposta × ✅/❌
- Tabela 2: 3 crons × dado teste × execId × efeito SQL × ✅/❌
- Screenshots anotados
- Bugs remanescentes + recomendações de hardening

## Critério de aceite
- 16/16 Sofia ✅ com mensagem `out` no banco (graças ao `checkExists:false`)
- 3/3 crons marcam coluna de controle + logam em `mensagens`
- Dashboard/Agenda refletem em <3s
- Zero crash, zero violação de constraint

