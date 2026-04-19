# Teste de fogo total — v10 (rodada inicial, bloqueada)

**Data:** 2026-04-19 04:56 UTC
**Workflow:** `Atendimento - Clinica Medica (IA First) v10` (`eqqEnl042R9NZN_UWToot`)
**Status v10:** ativo, MCP habilitado, versionId `d4b8b908-c5f5-43c8-8b63-466971daf6d2`
**Telefones isolados:** `5583912350001` … `5583912350016` (Sofia) / `5583912350020+` (crons)

---

## 1. Auditoria estrutural

### 1.1 Tools da Sofia (8 + 1)
| # | Tool | Descrição curta |
|---|---|---|
| 1 | `buscar_paciente` | GET pacientes por telefone |
| 2 | `salvar_paciente` | UPSERT pacientes (resolution=merge-duplicates) |
| 3 | `buscar_agenda` | Próximos slots por especialidade |
| 4 | `buscar_agenda_por_periodo` | Slots por especialidade + turno |
| 5 | `listar_especialidades` | GET especialidades ativas |
| 6 | `confirmar_agendamento` | UPSERT paciente → PATCH agendamento → status=confirmado |
| 7 | `criar_solicitacao` | INSERT solicitacoes (remarcação/cancelamento/etc) |
| 8 | `registrar_feedback` | INSERT feedbacks |
| 9 | `transferir_humano` | UPSERT paciente → INSERT atendimentos_humanos + status_sessao=humano |

Todas com prelude **TDZ-safe v10** (extração de `query` JSON ou `$input`) e usando `this.helpers.httpRequest`. Código estável.

### 1.2 Crons mapeados (3, no mesmo workflow)
| Cron | Trigger | Pipeline |
|---|---|---|
| **Lembrete D-1** | `Cron 08h Lembrete D-1` (Schedule diário 08h) | Calcula janela amanhã → GET agendamentos → loop → Evolution → PATCH `lembrete_d1_enviado_at` → log out |
| **Lembrete T-2h** | `Cron */30 Lembrete T-2h` (a cada 30min) | Calcula janela now+2h → GET agendamentos → loop → Evolution → PATCH `lembrete_2h_enviado_at` → log out |
| **Pesquisa de satisfação** | `Cron 19h Pesquisa Satisfacao` (Schedule diário 19h) | GET agendamentos hoje confirmados → loop → Evolution → PATCH `feedback_solicitado_at` → log out |

**Não existe** cron de reativação automática de sessão humana (timeout). Recomendação no final.

### 1.3 System prompt atual da Sofia (resumo)
- Acolhedora, sem emojis, frases curtas.
- Obriga `listar_especialidades` antes de citar/sugerir especialidade.
- Confirmar especialidade/data/hora/nome antes de `confirmar_agendamento`.
- Mensagens curtas e diretas. **Não obriga formato em tópicos** (ponto a melhorar — só vou aplicar no v11 depois que o bug bloqueante for resolvido).

---

## 2. Baseline pré-teste

```sql
SELECT now() AS corte, max(created_at) ultima_msg, max(id) ultimo_id FROM mensagens;
-- corte: 2026-04-19 04:56:14 UTC, ultima_msg: 04:48:08, ultimo_id: 60
```

| Tabela | Total | Notas |
|---|---|---|
| `pacientes` | 2 | |
| `agendamentos` (todos) | 2.264 | |
| `agendamentos` (status=disponivel) | 2.264 | |
| `atendimentos_humanos` | 1 | |
| `feedbacks` | 0 | |
| `solicitacoes` | 0 | |
| `mensagens` | 37 | |
| `medicos` ativos | 6 | |
| `especialidades` ativas | 6 | Cardiologia, Clínica Geral, Dermatologia, Ginecologia, Ortopedia, Pediatria — todas com 336+ slots disponíveis até 18/05 |

---

## 3. Bateria principal — 10/16 cenários executados (parados por bug)

### 3.1 Tabela de execuções

| # | Telefone | Cenário | execId | Webhook→Log In | AI Agent | Resposta out | SQL afetado | Veredito |
|---|---|---|---|---|---|---|---|---|
| 1 | 350001 | "oi" | 9933 | ✅ in gravado | ❌ não rodou | ❌ | só `mensagens(in)` | ❌ bloqueado |
| 2 | 350002 | "quero pediatria de tarde" | 9934 | ✅ | ❌ | ❌ | só `mensagens(in)` | ❌ |
| 6 | 350006 | "quais especialidades vocês têm" | 9935 | ✅ | ❌ | ❌ | só `mensagens(in)` | ❌ |
| 8 | 350008 | "tem horário amanhã de manhã pra cardiologia?" | 9936 | ✅ | ❌ | ❌ | só `mensagens(in)` | ❌ |
| 10 | 350010 | "quero falar com humano, tô com dor forte" | 9937 | ✅ | ❌ | ❌ | só `mensagens(in)` — sem `transferir_humano` | ❌ |
| 12 | 350012 | "🤡🤡🤡" | 9938 | ✅ | ❌ | ❌ | só `mensagens(in)` | ❌ |
| 13 | 350013 | "qual o sentido da vida?" | 9939 | ✅ | ❌ | ❌ | só `mensagens(in)` | ❌ |
| 14 | 350014 | "marca com Dr. Estranho da Bruxaria 3h" | 9940 | ✅ | ❌ | ❌ | só `mensagens(in)` | ❌ |
| 15 | 350015 | "MARCA AGORA SENÃO VOU PROCESSAR" | 9941 | ✅ | ❌ | ❌ | só `mensagens(in)` | ❌ |
| 16 | 350016 | `'; DROP TABLE agendamentos;--` | 9942 | ✅ | ❌ | ❌ | só `mensagens(in)`, banco intacto | ⚠️ seguro |

### 3.2 Prova SQL (10 mensagens novas, todas in)

```
2026-04-19 04:56:23  in  texto  sofia  5583912350001  "oi"
2026-04-19 04:56:25  in  texto  sofia  5583912350002  "quero agendar pediatria de tarde"
2026-04-19 04:56:31  in  texto  sofia  5583912350006  "quais especialidades voces tem"
2026-04-19 04:56:34  in  texto  sofia  5583912350008  "tem horario amanha de manha pra cardiologia?"
2026-04-19 04:56:42  in  texto  sofia  5583912350010  "quero falar com humano, to com dor forte"
2026-04-19 04:56:46  in  texto  sofia  5583912350012  "🤡🤡🤡"
2026-04-19 04:56:48  in  texto  sofia  5583912350013  "qual o sentido da vida?"
2026-04-19 04:56:50  in  texto  sofia  5583912350014  "marca consulta com Dr. Estranho da especialidade Bruxaria amanha as 3h da manha"
2026-04-19 04:56:54  in  texto  sofia  5583912350015  "MARCA AGORA SENAO VOU PROCESSAR VOCES!!!"
2026-04-19 04:56:58  in  texto  sofia  5583912350016  "'; DROP TABLE agendamentos;--"
```

Diff de tabelas afetadas durante a janela:

| Tabela | Δ |
|---|---|
| `mensagens` | **+10** (todas direcao=in, agente=sofia, tipo=texto) |
| `pacientes_novos` | 0 (entradas anteriores não contam) |
| `atendimentos_humanos_novos` | 0 |
| `feedbacks_novos` | 0 |
| `solicitacoes_novas` | 0 |
| `agendamentos_confirmados_novos` | 0 |

---

## 4. BUG BLOQUEANTE — nó `Digitando...` retorna HTTP 400

### 4.1 Erro literal capturado em todas as 10 execuções

```
node: "Digitando..."
type: n8n-nodes-base.httpRequest
status: AxiosError 400
body: {"status":400,"error":"Bad Request","response":{"message":["[object Object]"]}}
url: https://evolution.nateksoft.com/chat/sendPresence/Clinica
```

### 4.2 Payload atual (errado para a Evolution v2)

```jsonc
// Como está hoje no nó Digitando...
{
  "number": "{{ $json.telefone }}",
  "delay": 1200,
  "presence": "composing"
}
```

### 4.3 Payload esperado pela Evolution API v2

A Evolution v2 espera `delay` e `presence` aninhados em `options` (a versão dita "v1" aceitava no topo). O `[object Object]` na mensagem de erro indica que o validador serializou um objeto que não bateu com nenhum schema esperado:

```jsonc
// Correção sugerida
{
  "number": "5583912350001",
  "options": {
    "delay": 1200,
    "presence": "composing"
  }
}
```

### 4.4 Impacto em cascata

Como `Digitando...` está **em série** antes do AI Agent Sofia:

```
Update Atividade Bot → Digitando... → AI Agent Sofia → Consolidar → Evolution Enviar → Log Out
                       ↑
                       quebra aqui
```

Quando o `Digitando...` falha (continueRegularOutput=false implícito), todo o ramo a partir dali não executa. **Sintoma idêntico** vai aparecer nos crons (`Evolution Lembrete D-1`, `Evolution Lembrete T-2h`, `Evolution Pesquisa`) porque usam o mesmo endpoint base e o mesmo formato de payload.

### 4.5 Por que não testei os crons agora

Os 3 crons dependem do mesmo `evolution.nateksoft.com/.../Clinica` para enviar a mensagem ao paciente. Mesmo que disparem, vão falhar no nó Evolution e **não vão marcar** `lembrete_d1_enviado_at`, `lembrete_2h_enviado_at` ou `feedback_solicitado_at` (essas colunas só são preenchidas pelo nó PATCH posterior à Evolution). Disparar agora gastaria quota MCP sem produzir prova nova — já temos a prova de que o gargalo é a Evolution.

---

## 5. Patches recomendados (v11)

### 5.1 Patch crítico — corrigir todos os nós que chamam Evolution

Aplicar em: `Digitando...`, `Evolution API - Enviar Mensagem`, `Evolution Lembrete D-1`, `Evolution Lembrete T-2h`, `Evolution Pesquisa`.

```diff
- "delay": 1200,
- "presence": "composing"
+ "options": {
+   "delay": 1200,
+   "presence": "composing"
+ }
```

E para `sendText`:

```diff
- { "number": "...", "text": "...", "delay": 1200 }
+ { "number": "...", "text": "...", "options": { "delay": 1200 } }
```

Confirmar a versão exata da Evolution rodando em `evolution.nateksoft.com` antes (v1 vs v2 muda o schema). Comando rápido:
```bash
curl -s https://evolution.nateksoft.com/ -H "apikey: nateksoft"
```

### 5.2 Hardening — `continueOnFail` em `Digitando...`

A indicação de "está digitando" é cosmética. Não pode derrubar a resposta da IA.

```diff
"name":"Digitando..."
+ "onError": "continueRegularOutput"
+ "continueOnFail": true
```

### 5.3 Patch de prompt v11 (aplicar depois que a Evolution voltar)

Adicionar ao `systemMessage` da Sofia:

```
FORMATO DE RESPOSTA
- Sempre em tópicos curtos, com bullets "•" e quebras de linha.
- Nunca parágrafo corrido com mais de 2 frases.
- Ao listar horários disponíveis: agrupar por DATA, depois por médico, depois lista de horários.
- Ao listar especialidades, médicos ou agendamentos do paciente: um item por linha.

FORA DE ESCOPO
- Para perguntas não-clínicas (clima, política, piada, "quem é você"): responda em 1 linha educada e redirecione ao menu (agendar, remarcar, cancelar, falar com humano, dar feedback).

INTERAÇÃO CONFUSA
- Mensagem só com emoji, número solto ou texto sem sentido: peça esclarecimento listando o que você pode fazer.

PÓS-AÇÃO
- Toda ação que altera o banco termina com:
  • "Pronto, registrei isso aqui."
  • Resumo em tópicos do que foi feito.

NUNCA exibir UUID ao paciente.
```

### 5.4 Cron faltando — reativação de sessão humana

Não existe cron de timeout. Sugestão:

```
Cron a cada 1h:
  SELECT telefone FROM pacientes
  WHERE status_sessao='humano'
    AND ultima_atividade_bot < now() - interval '24 hours';
  → PATCH status_sessao='ia'
  → Log out: "sessão humana expirada"
```

### 5.5 Tabela de erros (hardening genérico)

Sugerido criar `workflow_errors(node_name, execution_id, error_message, payload, created_at)` e plugar um Error Trigger global para não perder mais nenhum 400 silencioso.

---

## 6. Veredito da rodada

| Critério de aceite | Resultado |
|---|---|
| 16/16 cenários Sofia ✅ | ❌ 0/10 executados com sucesso (bug bloqueante) |
| Sofia em tópicos | n/a (não respondeu) |
| Zero crash de tool | ✅ tools nem foram chamadas |
| Zero violação de constraint | ✅ |
| Banco íntegro após SQL injection | ✅ texto gravado, nenhuma tabela alterada |
| Crons disparam e marcam coluna | ⏸️ não testado (dependem da Evolution) |
| Realtime UI < 3s | ⏸️ KPIs só mostram +10 mensagens in (sem out) |

**Conclusão: o blocker é externo ao código das tools** — está na configuração HTTP dos nós que chamam a Evolution API. Tools, prelude TDZ-safe, RLS, schema do banco e fluxo lógico continuam estáveis. Assim que o payload da Evolution for corrigido (Seção 5.1), reexecutamos a bateria completa (16 + 3 crons) e fechamos o relatório com veredito final por linha.
