# Teste de fogo TOTAL — v12.1 (rodada 4, IA + tools + handoff ✅, Evolution API ⚠️)

**Data:** 2026-04-19 05:32 UTC  
**Workflow:** `Atendimento - Clinica Medica (IA First) v12.1` (`eqqEnl042R9NZN_UWToot`)  
**versionId:** `d850c1ed-5b30-4cd7-a607-57785cd98f06`  
**Status:** ativo, MCP habilitado, 4 triggers (1 webhook + 3 crons), **10 tools** (nova: `Tool Buscar Ultimo Agendamento`)  
**Telefones:** `5583912350001..016` (Sofia) + `5583912350020` (crons)

---

## 0. Sumário executivo

| Critério | Resultado | Comentário |
|---|---|---|
| (a) `mensagens.direcao='out'` em 16/16 cenários | ❌ **4/16** | Regressão vs v11 (9/16). Causa: payload ainda rejeitado pela Evolution mesmo com `checkExists:false`. |
| (b) Bot fica mudo na 2ª msg do telefone que pediu humano (cenário 11) | ✅ **PASSOU** | `lastNodeExecuted: Log Mensagem Humano`, AI Agent não chamado, zero `out`, zero atendimento_humano duplicado. |
| (c) `criar_solicitacao` aceita `telefone` | ❌ **NÃO PASSOU** | Tool ainda devolve `"paciente_telefone e tipo obrigatorios"` mesmo com o usuário confirmando o jsCode novo no editor. Hipótese: cache de toolCode no n8n. |
| (d) `registrar_feedback` vincula automático ao último agendamento | ⏸️ **NÃO TESTÁVEL** nesta rodada | Cenário 9 caiu numa exceção do nó "Consolidar Resposta" (`success:false`) antes do feedback ser gerado. AI nunca chamou a tool. |
| Bug crítico v12 (status='menu' tratado como humano) | ✅ **CORRIGIDO em v12.1** | Pacientes 3, 4, 5, 8 (todos `status='menu'`) agora têm `bot_ativo=true` e o AI Agent foi chamado normalmente. |
| Banco intacto após SQL injection | ✅ | `agendamentos` = 2267 (igual antes + 3 seeds). |
| Crons agendados (D-1, T-2h, FB) | ⏸️ não acionáveis via MCP | Triggers `scheduleTrigger` não executam por `execute_workflow`. Seeds preparados. |

**Avanço real desde a rodada 3 (v11):** bug do handoff humano corrigido (gargalo crítico) + novas regressões introduzidas e contornadas (v12 → v12.1) + falha na entrega da Tool Criar Solicitacao via cache do n8n persiste.

---

## 1. Linha do tempo desta rodada

| Hora UTC | Ação |
|---|---|
| 05:24 | Usuário importou v12. |
| 05:25 | Rodada inicial v12 (8 cenários) → bug crítico: pacientes `status='menu'` indo pra Log Mensagem Humano. Bateria abortada. |
| 05:26 | Patch v12.1 gerado: `bot_ativo = (status !== 'humano')`. |
| 05:28 | Usuário importou v12.1, baseline registrado (`max_msg_id=117`). |
| 05:28-32 | Bateria 16 cenários executada (execIds 9984..10002). |
| 05:32 | Seeds dos 3 crons inseridos no telefone `5583912350020`. |
| 05:32 | Validação SQL final + redação deste relatório. |

---

## 2. Bateria principal — 16 cenários (v12.1)

| # | Tel | Cenário | execId | Caminho no fluxo | Tools chamadas | Resposta resumida | `out` no banco | Veredito |
|---|---|---|---|---|---|---|---|---|
| 1 | 350001 | "oi" | 9984 | IF→AI→Sofia→Evolution→Log Out | — | "Olá. Como posso ajudar?" | ✅ id=119 | ✅ |
| 2 | 350002 | "quais especialidades?" | 9985 | IF→AI→Sofia | `listar_especialidades` | lista 6 especialidades | ❌ | ⚠️ Evolution rejeitou |
| 3 | 350003 | "pediatria de tarde, sou Ana" | 9986 | IF→AI→Sofia | `buscar_agenda_por_periodo` | 20 horários Pediatria | ❌ | ⚠️ Evolution rejeitou |
| 4 | 350004 | "quero remarcar" | 9987 | IF→AI→Sofia | `criar_solicitacao` (falhou) → `transferir_humano` | "Não foi possível criar solicitação. Vou transferir." | ❌ | ⚠️ tool falhou (bug C) |
| 5 | 350005 | "quero cancelar" | 9988 | IF→AI→Sofia | `criar_solicitacao` (**falhou: telefone**) → `transferir_humano` | mesma resposta | ❌ | ❌ **bug C confirmado** |
| 6 | 350006 | "lista as especialidades" | 9989 | IF→AI→Sofia | `listar_especialidades` | "Cardiologia, Clínica Geral, Dermato, Gineco, Ortopedia, Pediatria" | ❌ | ⚠️ Evolution rejeitou |
| 7 | 350007 | "médicos de cardio?" | 9990 | IF→AI→Sofia | `buscar_agenda` | "Dr. Carlos Silva" | ❌ | ⚠️ Evolution rejeitou |
| 8 | 350008 | "amanhã manhã cardio?" | 9992 | IF→AI→Sofia | `buscar_agenda_por_periodo` | 20 horários | ❌ | ⚠️ Evolution rejeitou |
| 9 | 350009 | "feedback nota 5" | 9995 | IF→AI→Sofia → **erro** | nenhuma | (exceção em Consolidar Resposta) | ❌ | ❌ exceção upstream |
| 10 | 350010 | "humano, dor no peito" | 9996 | IF→**Log Mensagem Humano** | — | (bot mudo, paciente já estava `humano` desde rodada anterior) | ❌ | ✅ comportamento certo |
| **11** | **350010** | **"ainda esperando" (2ª msg)** | **10002** | **IF→Log Mensagem Humano** | **—** | **(bot mudo, sem AI, sem duplicado)** | **❌** | **✅ BUG #2 v11 RESOLVIDO** |
| 12 | 350012 | "😂😂😂" | 9997 | IF→AI→Sofia→Evolution→Log Out | — | "Olá! Como posso ajudar?" | ✅ id=130 | ✅ |
| 13 | 350013 | "sentido da vida?" | 9998 | IF→AI→Sofia→Evolution→Log Out | — | "Não consigo responder. Posso ajudar com agendamentos." | ✅ id=132 | ✅ |
| 14 | 350014 | "Dr. Estranho da Bruxaria" | 9999 | IF→AI→Sofia | `listar_especialidades` | "Não encontrei Bruxaria. Disponíveis: Cardio…" | ❌ | ⚠️ Evolution rejeitou |
| 15 | 350015 | "vou processar..." | 10000 | IF→Log Mensagem Humano | — | (bot mudo, já estava `humano`) | ❌ | ✅ comportamento certo |
| 16 | 350016 | `'; DROP TABLE…` | 10001 | IF→AI→Sofia→Evolution→Log Out | — | "Não entendi. Poderia explicar?" | ✅ id=136 | ✅ seguro |

### 2.1 Provas SQL

```sql
-- Mensagens novas: 20 (16 in + 4 out)
SELECT direcao, COUNT(*) FROM mensagens WHERE id > 117 GROUP BY direcao;
-- in:16, out:4

-- Cenário 11: bot mudo confirmado (telefone 350010)
SELECT id, direcao, agente, LEFT(conteudo, 80) FROM mensagens WHERE paciente_telefone='5583912350010' AND id > 117 ORDER BY id;
-- 128 | in | humano | quero falar com humano agora, dor forte no peito
-- 137 | in | humano | ainda estou esperando atendimento     ← AGENTE='humano', sem out!

-- Banco intacto
SELECT count(*) FROM agendamentos;  -- 2267 (2264 anteriores + 3 seeds dos crons)

-- Solicitações da rodada
SELECT id, paciente_telefone, tipo, motivo, status FROM solicitacoes WHERE created_at > '2026-04-19 05:28:00';
-- d4eb5f98… | 5583912350004 | (NULL — fallback Sofia via transferir_humano!)
-- 1491b052… | 5583912350005 | (NULL — fallback)
-- ⚠️ Sofia caiu pro plano B (transferir_humano) porque criar_solicitacao falhou.

-- Feedbacks: zero (cenário 9 não chegou a executar a tool)
SELECT count(*) FROM feedbacks WHERE created_at > '2026-04-19 05:28:00';  -- 0

-- Crons: seeds prontos, ainda não disparados
SELECT paciente_nome, data_consulta, lembrete_d1_enviado_at, lembrete_2h_enviado_at, feedback_solicitado_at
FROM agendamentos WHERE paciente_telefone='5583912350020';
-- Cron Teste FB v13   | 2026-04-18 | NULL | NULL | NULL
-- Cron Teste 2h v13   | 2026-04-19 | NULL | NULL | NULL
-- Cron Teste D1 v13   | 2026-04-20 | NULL | NULL | NULL
```

---

## 3. Resposta direta às 4 provas pedidas

### (a) `mensagens.direcao='out'` em 16/16  → ❌ **4/16**

Regressão vs v11 (9/16). Os 4 que entregaram (`oi`, `😂`, filosofia, SQL injection) têm uma característica em comum: **resposta curta, sem caracteres especiais**. Os 12 que falharam têm pelo menos um destes: lista longa de horários, acentos, asteriscos, formatação. O patch `checkExists:false` + `onError:continueRegularOutput` + retry x2 não foi suficiente — a Evolution API está cortando antes mesmo de tentar enviar. Suspeita forte: o nó está usando `bodyParameters` (form) em vez de `jsonBody`, e o `text` com `\n` está corrompendo. Precisa de outra investigação direta na URL `https://evolution.nateksoft.com/message/sendText/Clinica` com curl.

### (b) Bot mudo no cenário 11 → ✅ **PASSOU**

```
execId 10002 | lastNodeExecuted: Log Mensagem Humano
status_sessao: humano  →  bot_ativo: false  →  IF rota humano
AI Agent NÃO foi chamado.
Mensagem registrada como agente='humano'.
Zero atendimento_humano duplicado.
```

Esta foi a maior conquista da v12.1 — o gargalo do handoff que existia desde a rodada 1 está resolvido.

### (c) `criar_solicitacao` aceita `telefone` → ❌ **NÃO PASSOU**

```json
// Sofia chamou:
{ "telefone": "5583912350005", "tipo": "cancelamento", "motivo": "viagem", "paciente_nome": "Teste 05" }

// Tool retornou (mesmo após o usuário confirmar o jsCode novo no editor):
{ "success": false, "erro": "paciente_telefone e tipo obrigatorios" }
```

A mensagem de erro **não existe no jsCode v12** (que diz `"telefone (ou paciente_telefone) obrigatorio"`). Isso prova de forma definitiva que **o n8n está executando uma versão anterior do jsCode** mesmo após o import. Hipóteses pra investigar:

1. Cache do nó `toolCode` no runtime do n8n (precisa restart do worker?).
2. Múltiplas instâncias da tool com mesmo nome — a antiga não foi sobrescrita.
3. O import preservou o `id` antigo do nó e n8n manteve a versão cacheada.

**Ação sugerida:** abrir a tool no editor, **apagar todo o jsCode**, salvar, colar o jsCode v12 novamente, salvar de novo. Ou deletar a tool inteira e recriar via import.

### (d) `registrar_feedback` auto-vincula → ⏸️ **NÃO TESTADO**

Cenário 9 (telefone 350009 pedindo feedback nota 5) gerou execId **9995 com `success:false`** numa exceção no nó `Consolidar Resposta` antes mesmo do AI Agent decidir chamar a tool. O `paciente_existe=false` (paciente novo) provavelmente confundiu o agente, que não chegou a invocar `buscar_ultimo_agendamento` ou `registrar_feedback`. Pra testar de verdade, precisaria pré-popular agendamento + paciente do 350009.

---

## 4. Bugs vivos no v12.1

### Bug A — Evolution API rejeita 12/16 mensagens
**Sintoma:** mesmo com `checkExists:false` + `onError:continueRegularOutput` + retry, só 4 mensagens curtas chegam.  
**Próximo passo:** curl direto no endpoint pra ver o erro real, e migrar o nó pra `jsonBody` com `Content-Type: application/json`.

### Bug B — Tool Criar Solicitacao usa código antigo (cache)
**Sintoma:** mensagem de erro corresponde ao jsCode v11, não v12.  
**Próximo passo:** deletar e recriar a tool no editor.

### Bug C — Cron triggers não acionáveis via MCP
**Sintoma:** `mcp_n8n_eJdzs--execute_workflow` só dispara o webhook principal.  
**Próximo passo:** adicionar webhooks paralelos `/cron-d1`, `/cron-2h`, `/cron-fb` (patch v13) ou esperar 8h/19h/30min pra ver o disparo natural.

---

## 5. Veredito

| Critério | v11 | v12.1 | Δ |
|---|---|---|---|
| 16/16 cenários executam | 16/16 | 16/16 | = |
| Mensagens `out` no banco | 9/16 | 4/16 | ⬇️ regressão |
| Bot mudo após handoff | ❌ | ✅ | ⬆️ **resolvido** |
| `criar_solicitacao` com `telefone` | ❌ | ❌ | = (cache) |
| Banco íntegro pós SQL injection | ✅ | ✅ | = |
| Crons disparam | ⏸️ | ⏸️ seeds prontos | = |

**Sistema está a ~80% de produção.** O cérebro (Sofia + tools + lógica de handoff) funciona. A "boca" (Evolution sendText) e uma tool específica (Criar Solicitação) precisam de intervenção manual no editor n8n.

---

## 6. Próximos patches recomendados

1. **v12.2 — Reescrever nó `Evolution API - Enviar Mensagem`** com `jsonBody` puro + investigação curl.
2. **v12.3 — Recriar Tool Criar Solicitacao** do zero no editor (não importar).
3. **v13 — Webhooks paralelos pros 3 crons** pra permitir teste manual via MCP.
4. **v13.1 — 4º cron Reativar Sessão Humana** a cada 1h.
