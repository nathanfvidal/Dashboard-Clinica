

## Teste de fogo TOTAL — v10 + workflows auxiliares (crons, feedbacks, lembretes)

Objetivo: validar **tudo** — Sofia (workflow principal), workflows agendados (lembretes D-1 / 2h, pedido de feedback, limpeza de sessão humana), todas as tools, efeito em banco e reflexo na UI. Sofia precisa responder em tópicos.

## Fase 0 — Descoberta de workflows auxiliares (NOVO)

1. `mcp_n8n_eJdzs--search_workflows` query "clinica" / "lembrete" / "feedback" / "cron" → listar todo workflow do projeto.
2. Para cada workflow auxiliar encontrado: `get_workflow_details` para mapear:
   - Trigger (Schedule? Webhook? Manual?)
   - Cron expression
   - Tabelas que lê/escreve (`agendamentos.lembrete_d1_enviado_at`, `lembrete_2h_enviado_at`, `feedback_solicitado_at`)
   - Última execução (se acessível)
3. Listar SQL: agendamentos elegíveis para cada cron (D-1, 2h, feedback) — base de teste.

Esperado descobrir 3-4 workflows: `Lembrete D-1`, `Lembrete 2h`, `Pedir Feedback`, possivelmente `Reativar Sessão` (timeout humano).

## Fase 1 — Auditoria do principal (v10)

1. `get_workflow_details` no `eqqEnl042R9NZN_UWToot` → confirmar v10 ativo, listar 9 tools, ler system prompt atual.
2. SQL baseline: agendamentos disponíveis, contagens (`pacientes`, `atendimentos_humanos`, `feedbacks`, `solicitacoes`, `mensagens`), timestamp de corte.

## Fase 2 — Reescrever system prompt da Sofia (v11)

Regras obrigatórias:
- Sempre tópicos com `•` e quebras de linha — nunca parágrafo corrido.
- Horários agrupados por **data → médico → lista de horários**, IDs guardados em contexto (não exibir UUID).
- Confirmar especialidade/médico/data/horário/nome **antes** de `confirmar_agendamento`.
- Fora de escopo (clima, piada, política): 1 linha educada + redireciona pro menu.
- Mensagem sem sentido / só emoji: pede esclarecimento listando o que ela faz.
- Toda ação que altera banco termina com "Pronto, registrei isso aqui." + resumo em tópicos.

## Fase 3 — Bateria principal (16 cenários, telefones `5583912350001..016`)

**A. Fluxo feliz (1-5):** "oi" / "quero pediatria de tarde" / agendar+confirmar / remarcar / cancelar.
**B. Tools auxiliares (6-9):** especialidades, médicos por especialidade, agenda por período, feedback nota 5.
**C. Handoff humano (10-11):** pedir humano / segunda mensagem do mesmo telefone (bot tem que ficar mudo).
**D. Caos (12-16):** só emoji, pergunta filosófica, médico inexistente, mensagem ameaçadora, SQL injection.

## Fase 4 — Crons e workflows auxiliares (NOVO)

Para cada workflow auxiliar descoberto na Fase 0:

1. **Preparar dado de teste**: inserir/atualizar agendamento do telefone `5583912350020` para cair na janela do cron:
   - Lembrete D-1: `data_consulta = amanhã`, `lembrete_d1_enviado_at = NULL`
   - Lembrete 2h: `data_consulta = hoje`, `horario = now+2h`, `lembrete_2h_enviado_at = NULL`
   - Feedback: `data_consulta < hoje`, `status='confirmado'`, `feedback_solicitado_at = NULL`
2. **Disparar manualmente** via `mcp_n8n_eJdzs--execute_workflow` (workflows agendados também podem ser executados manualmente).
3. **Validar SQL pós-execução**:
   - Coluna `lembrete_*_enviado_at` ou `feedback_solicitado_at` preenchida.
   - Linha em `mensagens` com `direcao='out'`, `agente='cron-lembrete'` ou similar, conteúdo correto.
4. **Reativação automática** (se existir workflow de timeout): forçar `pacientes.ultima_atividade_bot` antiga, executar, validar `status_sessao='ia'`.

## Fase 5 — Validação SQL geral

`mensagens` (in/out/cron), `agendamentos` (status antes/depois + colunas de lembrete), `pacientes.status_sessao`, `atendimentos_humanos`, `feedbacks`, `solicitacoes`.

## Fase 6 — Validação visual da UI (browser tool)

- `/` Dashboard → KPIs (agendamentos hoje, fila humana, feedback médio), gráficos, listas atualizadas.
- `/agenda` → slot confirmado colorido com nome do paciente, semana e mês.
- `/cadastros` → contagens batem.
- Screenshot de cada tela + checklist (overflow, cores, badges, responsivo 1952px).

## Fase 7 — Relatório final

Arquivo `docs/n8n-teste-de-fogo-v11.md`:
- **Tabela 1**: 16 cenários Sofia × execution_id × tools × SQL antes/depois × resposta literal × ✅/❌.
- **Tabela 2**: N workflows auxiliares × cron × dado de teste × execução × efeito SQL × ✅/❌.
- Screenshots da UI anotados.
- Bugs encontrados + patch v11 (se mexer em prompt) ou patches dedicados pra workflows auxiliares.
- Recomendações de hardening (alertas, retries, idempotência).

## Detalhes técnicos

- Telefones isolados `5583912350xxx` (Sofia) e `5583912350020+` (crons) — não polui histórico.
- Entre testes: 2s pra realtime React propagar antes do screenshot.
- Falha de tom/formato → ajusto só system prompt (v11). Falha de tool → patch cirúrgico no JSON correspondente.
- Quota: ~16 execuções principal + ~4 execuções auxiliares + ~40 SELECTs + 3 screenshots. OK.

## Critério de aceite

- 16/16 cenários Sofia ✅ + 100% em tópicos.
- 100% dos workflows auxiliares disparam, marcam coluna de controle e logam em `mensagens`.
- Zero crash de tool, zero violação de constraint, zero loop de cron (idempotência verificada).
- Dashboard/Agenda/Cadastros refletem mudanças em < 3s.

