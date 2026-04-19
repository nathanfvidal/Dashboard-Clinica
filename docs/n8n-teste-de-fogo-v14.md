# Teste de Fogo — n8n v13 (Round 5)

**Workflow:** Atendimento - Clinica Medica (IA First) v13  
**ID:** `eqqEnl042R9NZN_UWToot` | **versionId:** `df5f106d-...` | **active:** `true`  
**Triggers:** 9 (1 webhook principal + 4 webhooks de cron + 4 schedule triggers)  
**Data execução:** 2026-04-19 05:39 → 05:44 UTC  
**Baseline:** msg_id=137 · agendamentos=2267 · solicitacoes=2 · feedbacks=0 · ah=9 · pacientes_humano=3

---

## Sumário Executivo

| Critério | Esperado | Observado | Status |
|---|---|---|---|
| (a) 16/16 mensagens `out` gravadas | 16 | **9** | ❌ Regressão parcial |
| (b) `criar_solicitacao` aceita `telefone` | ✅ | ✅ confirmado | ✅ |
| (c) `lembrete_d1` preenchido | ✅ | ✅ `2026-04-19 05:44:12` | ✅ |
| (c) `lembrete_2h` preenchido | ✅ | ❌ NULL — cron 500 | ❌ |
| (c) `feedback_solicitado_at` preenchido | ✅ | ✅ `2026-04-19 05:44:16` | ✅ |
| (d) paciente humano >24h volta para `ia` | ✅ | ✅ `5583912350010` agora `ia` | ✅ |

**Veredito:** v13 corrige 4 dos 6 critérios. Resta um bug de delivery do Evolution (mensagens longas/com listas) e o cron T-2h sem agendamentos elegíveis no momento do teste.

---

## Pré-requisito corrigido nesta rodada

A tabela `pacientes` tinha trigger `trg_pacientes_updated` referenciando coluna `updated_at` inexistente, **bloqueando todos os `UPDATE`s** na tabela. Migration `20260419053911_*.sql` adicionou a coluna. Sem essa correção os crons de reativação e os UPDATEs feitos pelas tools não funcionariam.

---

## Tabela 1 — 16 cenários Sofia

| # | Telefone | Mensagem | in | out | Agente | Status |
|---|---|---|---|---|---|---|
| 1 | ...001 | "oi" | 1 | 1 | sofia | ✅ "Olá. Como posso ajudar?" |
| 2 | ...002 | "quais especialidades..." | 1 | 0 | sofia | ❌ Evolution rejeitou (lista) |
| 3 | ...003 | "pediatria de tarde, sou Ana" | 1 | 0 | sofia | ❌ Evolution rejeitou |
| 4 | ...004 | "remarcar, meu nome é João" | 1 | 0 | sofia | ❌ Evolution rejeitou — mas **`criar_solicitacao` gravou** ✅ |
| 5 | ...005 | "cancelar, motivo: viagem" | 2 | 0 | sofia | ❌ Evolution rejeitou — mas **`criar_solicitacao` gravou** ✅ |
| 6 | ...006 | "lista as especialidades" | 2 | 0 | sofia | ❌ Evolution rejeitou (lista longa) |
| 7 | ...007 | "quais médicos cardio?" | 2 | 1 | sofia | ✅ "Para cardiologia, temos o Dr. Carlos Silva." |
| 8 | ...008 | "tem cardio amanhã manhã?" | 2 | 0 | sofia | ❌ Evolution rejeitou |
| 9 | ...009 | "feedback nota 5..." | 2 | 0 | sofia | ⚠️ resposta não saiu, mas **`feedback` gravado com `agendamento_id` resolvido** ✅ |
| 10 | ...010 | "esperando atendente" | 3 | 0 | **humano** | ✅ Bot mudo (correto, `status_sessao='humano'`) |
| 11 | ...011 | "obrigado tchau" | 1 | 1 | sofia | ✅ "De nada. Se precisar..." |
| 12 | ...012 | "kkk haha 😂😂😂" | 2 | 2 | sofia | ✅ "Olá! Como posso ajudar?" |
| 13 | ...013 | "qual o sentido da vida?" | 2 | 2 | sofia | ✅ "Não consigo responder a essa pergunta..." |
| 14 | ...014 | "Dr. Estranho da Bruxaria" | 2 | 0 | sofia | ❌ Evolution rejeitou |
| 15 | ...015 | "vou processar vocês" | 2 | 0 | **humano** | ✅ Transferiu p/ humano (correto) |
| 16 | ...016 | "'; DROP TABLE..." | 2 | 2 | sofia | ✅ Resposta neutra, sem injection |

**Totais:** 16/16 in ✅ · **9/16 out** (com cenários 10, 15 corretamente mudos = bot ativo em 14, com out em 9 = **9/14 = 64%** dos casos onde deveria responder)

---

## Tabela 2 — 4 webhooks de cron

| Webhook | HTTP | Tempo | Resultado SQL |
|---|---|---|---|
| `POST /cron-d1` | 200 | 3.1s | ✅ `agendamentos.lembrete_d1_enviado_at = 05:44:12` em `5583912350020`. Erro paralelo no log de mensagens (constraint `mensagens_tipo_check` viola tipo `lembrete_d1`). |
| `POST /cron-2h` | 500 | 0.8s | ❌ `"No item to return was found"` — nenhum agendamento no intervalo +1h50min..+2h10min. Coluna `lembrete_2h_enviado_at` permanece NULL. |
| `POST /cron-fb` | 200 | 2.8s | ✅ `agendamentos.feedback_solicitado_at = 05:44:16`. Mesmo erro `mensagens_tipo_check`. |
| `POST /cron-reativacao` | 200 | 0.9s | ✅ `pacientes.status_sessao` de `5583912350010` voltou de `humano` → `ia`. Erro paralelo no log: `paciente_telefone NULL` em `mensagens`. |

**Conclusão crons:** Os UPDATEs principais funcionam (3 de 4). Os logs de telemetria em `mensagens` falham silenciosamente, mas **não bloqueiam o efeito principal** porque o erro ocorre depois do PATCH.

---

## Tabela 3 — Tools confirmadas funcionando

| Tool | Evidência SQL |
|---|---|
| `criar_solicitacao` (com `telefone`) | 2 linhas novas em `solicitacoes`: cenário 4 (remarcação Teste04) + cenário 5 (cancelamento Teste05, motivo "viagem") |
| `transferir_humano` | 2 linhas novas em `atendimentos_humanos` (cenários 4 e 5 caíram em fallback humano após Evolution falhar) |
| `registrar_feedback` (sem `agendamento_id`) | 1 linha em `feedbacks`: nota 5, comentário "atendimento otimo", paciente `5583912350009` |
| `Verificar se Bot Ativo` (v12.1) | `5583912350010` com `status='humano'` gerou agente `humano` em todas as 3 mensagens — bot mudo correto |

---

## Bugs Remanescentes

### B1 — Evolution rejeita 7/14 mensagens (mensagens longas/com listas)
Mensagens curtas passam (cenários 1, 7, 11, 12, 13, 16). Mensagens com lista numerada, vários itens ou texto longo não geram `out`. Mesmo com `jsonBody` puro do v13. **Suspeita:** rate limit do número Evolution ou validação de payload no servidor Evolution. Próximo passo: testar `curl` direto no endpoint Evolution com payload longo isolando do n8n.

### B2 — Logs de cron quebram com `mensagens_tipo_check`
Os 3 nós "Log Lembrete D-1", "Log Pesquisa", "Log Reativacao" tentam inserir `tipo='lembrete_d1'`/`'feedback'`/`'reativacao'` mas a constraint só aceita `texto|audio|imagem|...`. **Não bloqueia** o PATCH principal, mas polui os erros do n8n e impede telemetria.  
**Fix sugerido:** trocar `tipo` para `'texto'` em todos os logs de cron e mover o tipo real para `metadata->>'evento'`.

### B3 — Cron T-2h sem dados elegíveis durante teste
Os agendamentos seed em `5583912350020` não estavam exatamente no intervalo +1h50..+2h10. Não é bug do v13, é gap de dado de teste. **Fix:** seed dinâmico que insere agendamento exatamente em `now() + 2h`.

### B4 — Cron Reativacao loga sem `paciente_telefone`
O nó "Log Reativacao" tenta inserir mensagem mas `paciente_telefone` chega NULL. **Fix:** referenciar `{{ $('Split Reativar').item.json.telefone }}` em vez do contexto raiz.

---

## Recomendações p/ v13.1

1. **Fix B2 + B4** — patch nos 3 nós de log de cron (5 min de trabalho).
2. **Fix B3** — script SQL `seed_crons_v14.sql` que insere 3 agendamentos sincronizados com a hora atual.
3. **B1 Evolution** — fora do escopo n8n: testar `curl` direto no endpoint Evolution com payload de 500+ caracteres pra confirmar se é limite de servidor. Se for, implementar truncamento + chunking nas respostas longas da Sofia.

---

## Arquivos relacionados
- `supabase/migrations/20260419053911_*.sql` — adiciona `updated_at` em `pacientes`
- `docs/n8n-teste-de-fogo-v13.md` — relatório anterior (v12.1)
- `docs/n8n-fix-v5.md` — histórico de patches Evolution

---

**Score final v13:** 4/6 critérios verdes · 1 regressão parcial (Evolution) · 1 gap de seed (T-2h)  
**Pronto para produção:** Não. Precisa fix B1 (Evolution) antes de ativar para usuários reais.
