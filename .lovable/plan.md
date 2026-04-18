

## Objetivo
Reescrever o JSON `Atendimento_-_Clinica_Medica_IA_First.json` para refletir 100% das Sprints 1, 2 e 3, entregando **um único workflow** importável no n8n. Admin para handoff: `5583999915242`. Groq key hardcoded como placeholder.

## Estado atual vs alvo

```text
HOJE                                    DEPOIS
Webhook → Extrair → Buscar Pac.         Webhook → Extrair (com áudio Groq) → Buscar Pac.
  → Verificar Bot → Digitando             → Verificar Bot → IF Bot Ativo?
  → AI Agent → Consolidar → Enviar          ├─ false → Log msg humano (fim)
                                            └─ true  → Log msg in
                                                       → Update ultima_atividade
                                                       → Digitando → AI Agent
                                                       → Consolidar → Enviar
                                                       → Log msg out
+ 3 Schedule Triggers paralelos no mesmo workflow:
   • Cron 08h  → Lembrete D-1
   • Cron */30min → Lembrete T-2h
   • Cron 19h  → Pesquisa de satisfação
+ Tool transferir_humano  (handoff)
+ Tool criar_solicitacao  (já existe parcial — vou padronizar)
+ Memory: sessionKey dinâmico com janela de 6h
```

## Mudanças node-a-node

### 1. `Extrair Dados da Mensagem` (substituir jsCode)
Detecta `audioMessage`. Se for áudio: baixa via Evolution `/chat/getBase64FromMediaMessage/Clinica`, manda pro Groq Whisper (`https://api.groq.com/openai/v1/audio/transcriptions`, model `whisper-large-v3`) e retorna a transcrição como `mensagem`. Mantém todo o resto (texto, caption, comando `/bot`).

### 2. Novo nó `IF Bot Ativo?` (após `Verificar se Bot Ativo`)
Condição: `status_sessao === 'ia'` OU `mensagem === '__REATIVAR_BOT__'`.
- **true** → segue fluxo normal
- **false** → vai para `Log Mensagem Humano` (POST em `mensagens` com `agente='humano'`, `direcao='in'`) → fim sem responder.

### 3. Novos nós HTTP de log
- `Log Mensagem In` (depois do IF true): POST em `/rest/v1/mensagens` com `{paciente_telefone, direcao:'in', conteudo, tipo, agente:'sofia'}`.
- `Log Mensagem Out` (depois de Enviar): mesmo POST com `direcao:'out'`.
- `Update Atividade Bot`: PATCH em `/rest/v1/pacientes?telefone=eq.X` com `{ultima_atividade_bot: now}`.

### 4. `Window Buffer Memory` → sessionKey 6h
```js
={{ (() => { const tel=$('Verificar se Bot Ativo').first().json.telefone; const b=Math.floor(Date.now()/(6*60*60*1000)); return tel+'_'+b; })() }}
```

### 5. Nova **Tool `transferir_humano`** (ligada a `ai_tool` do Sofia)
- POST `atendimentos_humanos` `{paciente_telefone, paciente_nome, motivo, status:'aguardando'}`
- PATCH `pacientes?telefone=eq.X` `{status_sessao:'humano'}`
- POST `mensagens` log evento
- Envia WhatsApp para `5583999915242` via Evolution avisando da transferência.

### 6. Tool `Tool Cancelar Remarcar` → renomear para **`criar_solicitacao`**
Schema: `{telefone, tipo, motivo, paciente_nome?}`. Grava em `solicitacoes` (campos da tabela real: `paciente_telefone, tipo, motivo, status='pendente'`). Remove `data_agendada` que não existe na tabela.

### 7. Tool `Tool Registrar Feedback` → adicionar `inputSchema` ausente
Cola o schema do doc (telefone, nota 1-5, comentario, agendamento_id, nome).

### 8. System prompt do Sofia
Adicionar 2 seções (mantém emojis conforme pedido):
- **Quando chamar `transferir_humano`**: pedido explícito de humano, reclamação grave, dúvida clínica complexa, urgência não-emergência.
- **Quando chamar `criar_solicitacao`**: pedido de retorno de ligação, exame, receita, atestado fora do fluxo de agenda.

### 9. Três Schedule Triggers paralelos (todos no mesmo workflow)

**A. Lembrete D-1 — todo dia 08:00**
```text
Schedule(08:00 daily) → HTTP GET agendamentos
  ?status=eq.confirmado&data_consulta=eq.{amanhã}&lembrete_d1_enviado_at=is.null
→ Split In Batches (1) → Evolution sendText (msg D-1)
→ HTTP PATCH agendamentos?id=eq.X { lembrete_d1_enviado_at: now }
→ HTTP POST mensagens (log out)
```

**B. Lembrete T-2h — a cada 30 min**
```text
Schedule(*/30 min) → HTTP GET agendamentos
  ?status=eq.confirmado
  &data_consulta=eq.{hoje}
  &horario=gte.{now+1h45}&horario=lte.{now+2h15}
  &lembrete_2h_enviado_at=is.null
→ Split → Evolution sendText → PATCH lembrete_2h_enviado_at → log
```

**C. Pesquisa Satisfação — todo dia 19:00**
```text
Schedule(19:00 daily) → HTTP GET agendamentos
  ?status=eq.confirmado&data_consulta=eq.{hoje}
  &feedback_solicitado_at=is.null
→ Split → Evolution sendText (pede nota 1-5)
→ PATCH feedback_solicitado_at → log
```

Cada cron usa um Function node "Calcular janela" para montar as datas/horas em Brasília (UTC-3).

## Entregável
- `/mnt/documents/Atendimento_-_Clinica_Medica_IA_First_v2.json` — workflow único pronto para importar no n8n via "Import from File", substituindo o atual.
- Marcadores `COLE_SUA_GROQ_KEY_AQUI` no nó de transcrição (1 ocorrência) — você troca antes de ativar.
- Doc curto `docs/n8n-import-v2.md` listando: o que mudou, onde colar a Groq key, ordem de teste (texto → áudio → handoff → cron manual via "Execute Workflow").

## Riscos / observações
- O n8n pode reorganizar IDs dos nós ao importar; mantenho IDs estáveis e `versionId` novo para evitar conflito.
- Os 3 Schedule Triggers ficam no mesmo workflow → se você desativar o workflow para manutenção, pausa todos juntos. Confirmou que prefere assim.
- Tabela `solicitacoes` real **não tem** `data_agendada`. A tool atual está gravando esse campo e provavelmente falhando silenciosamente — vou corrigir.
- Filtro de horário do T-2h por string `time` no Postgres funciona (`gte`/`lte` lexicográfico bate com cronologia para HH:MM:SS).

