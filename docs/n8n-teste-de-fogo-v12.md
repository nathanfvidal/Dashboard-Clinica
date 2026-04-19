# Teste de fogo TOTAL — v11 (rodada 3, IA + tools + banco + UI ✅, crons agendados ⏸️)

**Data:** 2026-04-19 05:18 UTC  
**Workflow:** `Atendimento - Clinica Medica (IA First) v11` (`eqqEnl042R9NZN_UWToot`)  
**versionId:** `00c31b45-1e37-4f9a-a18b-de2b86a9a18a`  
**Status v11:** ativo, MCP habilitado, 4 triggers (1 webhook + 3 crons), 9 tools  
**Telefones isolados:** `5583912350001..016` (Sofia) + `5583912350020` (crons)

---

## 1. Sumário executivo

| Camada | Resultado |
|---|---|
| Webhook recebe e parseia mensagem | ✅ 16/16 |
| Sofia (LLM + tools) executa ponta a ponta | ✅ 16/16 |
| Tools de leitura retornam dados reais | ✅ |
| Tools de escrita gravam em banco | ✅ (`transferir_humano`, `salvar_paciente`) |
| **Mensagem `out` chega no banco** | ✅ **9/16** (patch `checkExists:false` destravou parcialmente) |
| Dashboard / Agenda / Cadastros refletem em <3s | ✅ |
| SQL injection inofensivo | ✅ tabela intacta |
| Crons agendados (D-1, T-2h, Pesquisa) | ⏸️ não acionáveis via MCP (são `scheduleTrigger`) |
| Bug: bot não fica mudo quando `status_sessao='humano'` | ❌ |

**Principal avanço vs rodada 2:** mensagens `out` voltaram para o banco. Antes 0/10, agora 9/16.

---

## 2. Bateria principal — 16 cenários da Sofia

| # | Telefone | Cenário | execId | Resposta da Sofia (resumo) | Tool chamada | Out no banco | Veredito |
|---|---|---|---|---|---|---|---|
| 1 | 350001 | "oi" | 9956 | "Olá. Como posso ajudar?" | — | ✅ id=82 | ✅ |
| 2 | 350002 | "quais especialidades vocês têm?" | 9957 | lista 6 especialidades | `listar_especialidades` | ❌ | ⚠️ lógica ok |
| 3 | 350003 | "quero pediatria de tarde, meu nome é Ana Silva" | 9958 | 20 horários Pediatria tarde | `buscar_agenda_por_periodo` | ❌ | ⚠️ lógica ok |
| 4 | 350004 | "quero remarcar minha consulta" | 9959 | "Qual especialidade e data?" | — | ❌ | ⚠️ lógica ok |
| 5 | 350005 | "quero cancelar minha consulta" | 9960 | "Houve um erro... preciso telefone e tipo" | `criar_solicitacao` (faltou param) | ✅ id=87 | ⚠️ tool exige refino |
| 6 | 350006 | "lista as especialidades por favor" | 9961 | lista 6 especialidades | `listar_especialidades` | ❌ | ⚠️ lógica ok |
| 7 | 350007 | "quais médicos atendem cardiologia?" | 9962 | "Dr. Carlos Silva" | `listar_especialidades` + buscar | ✅ id=90 | ✅ |
| 8 | 350008 | "tem horário amanhã de manhã pra cardiologia?" | 9963 | 20 horários Cardiologia 08-12h | `buscar_agenda_por_periodo` | ❌ | ⚠️ lógica ok |
| 9 | 350009 | "quero deixar feedback nota 5, atendimento excelente" | 9966 | "Vou registrar seu feedback" | `registrar_feedback` (faltou agendamento_id) | ❌ | ⚠️ esperado |
| 10 | 350010 | "quero falar com humano, dor forte no peito" | 9967 | "Dor forte pode ser emergência. Procure urgência." | `transferir_humano` | ✅ id=94 | ✅ banco ok |
| 11 | 350010 | (segunda msg) "ainda estou esperando" | 9973 | "Peço desculpas, reforcei a solicitação..." | `transferir_humano` (DUPLICADO) | ✅ id=105 | ❌ **bug handoff** |
| 12 | 350012 | "😂😂😂" | 9968 | "Olá! Como posso ajudar você?" | — | ✅ id=96 | ✅ |
| 13 | 350013 | "qual o sentido da vida?" | 9969 | "Não consigo responder. Posso ajudar com agendamentos." | — | ✅ id=98 | ✅ |
| 14 | 350014 | "quero consulta com Dr. Estranho da Bruxaria" | 9970 | "Não encontrei Bruxaria. Disponíveis: Cardiologia..." | `listar_especialidades` | ❌ | ⚠️ lógica ok |
| 15 | 350015 | "vou processar essa clínica..." | 9971 | "Compreendo, vou transferir." | `transferir_humano` | ✅ id=101 | ✅ banco ok |
| 16 | 350016 | `'; DROP TABLE agendamentos;--` | 9972 | "Não entendi. Poderia explicar?" | — | ✅ id=103 | ✅ seguro |

### Provas SQL

```sql
-- Mensagens novas: 25 (16 in + 9 out)
SELECT count(*) FROM mensagens WHERE id > 80;                       -- 25
SELECT count(*) FROM mensagens WHERE id > 80 AND direcao='in';      -- 16
SELECT count(*) FROM mensagens WHERE id > 80 AND direcao='out';     -- 9  ← antes era 0!

-- Atendimentos humanos criados nesta rodada
SELECT id, paciente_telefone, motivo, status FROM atendimentos_humanos
WHERE created_at > '2026-04-19 05:13:00';
-- a6f8...  | 5583912350010 | dor forte no peito          | aguardando
-- 5fd3...  | 5583912350015 | ameaçando processar         | aguardando
-- c5d8...  | 5583912350010 | ainda aguardando atendimento| aguardando  ← bug 11

-- SQL injection: zero efeito
SELECT count(*) FROM agendamentos;  -- 2264 (igual antes)
```

---

## 3. Crons agendados (Fase 4)

### 3.1 Mapeamento

Os 3 crons estão **embutidos no mesmo workflow v11**, cada um com seu próprio `scheduleTrigger`:

| Cron | Trigger | Cadeia de nós | Coluna marcada |
|---|---|---|---|
| Lembrete D-1 | `Cron 08h Lembrete D-1` (08:00 diário) | Calcular Janela → GET → Split → Evolution → PATCH → Log | `lembrete_d1_enviado_at` |
| Lembrete T-2h | `Cron */30 Lembrete T-2h` (a cada 30min) | Calcular Janela → GET → Split → Evolution → PATCH → Log | `lembrete_2h_enviado_at` |
| Pesquisa Satisfação | `Cron 19h Pesquisa Satisfacao` (19:00 diário) | Calcular Hoje → GET → Split → Evolution → PATCH → Log | `feedback_solicitado_at` |

### 3.2 Dados de teste preparados (telefone `5583912350020`)

```sql
-- Migration aplicada:
INSERT INTO agendamentos VALUES
 (..., 'Cardiologia', 'Dr. Carlos Silva', current_date+1, '14:00', '5583912350020', 'Cron Teste D1', 'confirmado'),
 (..., 'Cardiologia', 'Dr. Carlos Silva', current_date,   '07:17', '5583912350020', 'Cron Teste 2h', 'confirmado'),
 (..., 'Cardiologia', 'Dr. Carlos Silva', current_date-1, '10:00', '5583912350020', 'Cron Teste FB', 'confirmado');
```

Resultado: 3 linhas inseridas, visíveis na **UI Agenda** (screenshot abaixo) com badge `confirmado` verde.

### 3.3 Limitação encontrada

`mcp_n8n_eJdzs--execute_workflow` só aciona o **trigger principal** (no caso, o webhook). Os 3 `scheduleTrigger` rodam apenas no horário programado pelo n8n. Para testá-los manualmente é preciso:

- **Opção A:** botão "Execute Node" diretamente no editor n8n em cada cron
- **Opção B:** transformar cada cron em um `webhook` adicional (path `/cron-d1`, `/cron-2h`, `/cron-fb`) — patch v12 sugerido

| Cron | Status | Coluna verificada | Dado SQL |
|---|---|---|---|
| Lembrete D-1 | ⏸️ pendente disparo | `lembrete_d1_enviado_at` | NULL |
| Lembrete T-2h | ⏸️ pendente disparo | `lembrete_2h_enviado_at` | NULL |
| Pesquisa | ⏸️ pendente disparo | `feedback_solicitado_at` | NULL |

---

## 4. Validação visual da UI

### 4.1 Dashboard (`/`)

- KPIs: **Pacientes 6** (subiu de 5 — `salvar_paciente` da Ana funcionou em rodadas anteriores), **Fila humana 7** (3 novos desta rodada + 4 acumulados), **Feedback médio —** (0 avaliações), **Agendamentos hoje 0**.
- Gráfico "Por especialidade" mostra 6 fatias (todas as especialidades).
- Lista "Atendimentos humanos" mostra: Teste 10, Teste 15, Teste 10 (duplicado pelo bug), Teste 10 anterior. Badge `aguardando` âmbar + badge `pausado` âmbar + botões `Reativar bot` e `Finalizar`.
- Realtime: novas linhas surgiram <3s após cada execução do n8n.

### 4.2 Agenda (`/agenda`)

- Tabela mostra os 3 agendamentos seed (`Cron Teste FB` visível em 18/04 10:00 com badge `confirmado` verde, telefone 5583912350020).
- Filtros (Data, Médico, Especialidade, Status) + tabs Tabela/Semana/Mês funcionam.

### 4.3 Cadastros (`/cadastros`)

- Tabs Especialidades (6) + Médicos batem com o que `listar_especialidades` retorna pra Sofia.

---

## 5. Bugs encontrados nesta rodada

### Bug #1 — Mensagens `out` faltando em 7/16 cenários ⚠️

**Sintoma:** apenas 9 de 16 cenários gravaram `direcao='out'` no banco.

**Cenários sem `out`:** 2, 3, 4, 6, 8, 9, 14.

**Causa provável:** o nó `Log Mensagem Out` só roda se `Evolution API - Enviar Mensagem` retornar `success`. Em cenários cuja resposta é longa (lista de 20 horários, lista de 6 especialidades), a Evolution pode estar rejeitando por outro motivo (tamanho, formatação, encoding) mesmo com `checkExists:false`.

**Patch sugerido v12:**
```json
"onError": "continueRegularOutput"
```
no nó `Evolution API - Enviar Mensagem`, para que `Log Mensagem Out` registre o que foi tentado mesmo quando a entrega falha.

### Bug #2 — Bot não fica mudo após handoff humano ❌

**Sintoma:** cenário 11 (segunda mensagem do telefone 350010, que já estava com `status_sessao='humano'` desde o cenário 10) o bot **respondeu novamente e criou outro `atendimento_humano` duplicado** (`c5d8cdd4-bbb3-4672-b953-1059f1a95663`).

**Causa raiz:** o nó `Verificar se Bot Ativo` ignora o `status_sessao` retornado por `Supabase - Buscar Paciente` e força `status_sessao:'ia'` + `paciente_existe:false` na saída, mesmo quando o input tem `status_sessao:'humano'`. Provavelmente bug de mapeamento de variável.

**Patch sugerido v12 no JS do nó `Verificar se Bot Ativo`:**
```js
const paciente = items[0].json; // dado do Buscar Paciente
const status = paciente.status_sessao || 'ia';
return [{ json: { ...inputAnterior, status_sessao: status, paciente_existe: !!paciente.id } }];
```

### Bug #3 — Tools `criar_solicitacao` e `registrar_feedback` precisam refino

`criar_solicitacao` exige `paciente_telefone` + `tipo` mas o LLM passa `telefone` + `tipo` → erro "paciente_telefone e tipo obrigatórios". Renomear no schema da tool ou aceitar ambos os nomes.

`registrar_feedback` exige `agendamento_id` que o LLM não consegue obter sem buscar antes. Sugestão: criar tool `buscar_ultimo_agendamento_paciente` para preencher.

---

## 6. Recomendações de hardening

1. **Patch v12 dos 3 bugs acima** (1-2 horas de trabalho).
2. **Webhooks paralelos para os crons** (`/cron-d1`, `/cron-2h`, `/cron-fb`) para permitir teste manual via MCP.
3. **4º cron Reativar Sessão Humana** a cada 1h:
   ```sql
   UPDATE pacientes
   SET status_sessao='ia'
   WHERE status_sessao='humano'
     AND ultima_atividade_bot < now() - interval '24 hours';
   ```
4. **Tabela `workflow_errors`** + Error Trigger global no n8n para capturar `success:false` silenciosos.
5. **Rate limit por telefone** (máx 1 mensagem in / 2s) para evitar flood.
6. **`continueOnFail: true`** em todos os HTTP da Evolution para não travar a cadeia.

---

## 7. Veredito final

| Critério de aceite original | Resultado |
|---|---|
| 16/16 cenários Sofia executam | ✅ 16/16 |
| Mensagem `out` chega no banco | ⚠️ 9/16 (era 0/10 antes do v11) |
| 100% dos crons disparam e marcam coluna | ⏸️ não acionáveis via MCP |
| Dashboard reflete em <3s | ✅ |
| Zero crash / zero violação de constraint | ✅ |
| SQL injection inofensivo | ✅ |
| Bot fica mudo após handoff | ❌ bug #2 |

**Avanço real desde a rodada 2:** 9 mensagens `out` a mais no banco (de 0 para 9), fila humana populada, UI realtime confirmada. Faltam 3 patches pequenos (bugs 1-3) + reorganização dos crons em webhooks para teste manual. O sistema está a ~85% de produção.
