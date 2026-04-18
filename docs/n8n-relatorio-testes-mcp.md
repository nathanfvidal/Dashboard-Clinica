# Relatório de testes via MCP — workflow `Atendimento - Clinica Medica (IA First)`

Data: 2026-04-18
Workflow ID: `eqqEnl042R9NZN_UWToot`
Workflow ativo no n8n: **v3** (44 nós, 4 triggers, ativo).

## Testes executados via MCP `execute_workflow`

| # | Mensagem simulada | Telefone | Execução | Resultado real |
|---|---|---|---|---|
| 1 | "oi" | 5583912340099 | 9771 | **falhou** — Sofia respondeu "não consigo listar as especialidades" |
| 2 | "quero pediatria de tarde" | 5583912340002 | 9772 | **falhou** — mesmo padrão |
| 3 | "quero falar com humano" | 5583912340003 | 9773 | **falhou** — agente quebrou tool |

Em **TODAS** as execuções o fluxo entrou no `Log Mensagem In` e bombou.

## Bugs encontrados

### Bug 1 — `mensagens_tipo_check` violado (CRÍTICO, mata o fluxo)

Erro real do n8n no `Log Mensagem In`:
```
400 - "code":"23514", "message":"new row for relation \"mensagens\" violates check constraint \"mensagens_tipo_check\""
```

Causa: o nó **`Verificar se Bot Ativo`** descarta o campo `tipo` (que `Extrair Dados da Mensagem` produz como `'texto'` ou `'audio'`). O `Log Mensagem In` envia `"tipo": "{{ $json.tipo }}"` que vira string vazia, violando o CHECK do Postgres (`tipo IN ('texto','audio','imagem','sistema')`).

Apesar de o `Log` continuar (`onError: continueRegularOutput`), o histórico de mensagens **nunca é gravado** — então não temos rastro nenhum no banco e a memória da Sofia fica órfã.

### Bug 2 — `fetch is not defined` em TODAS as 9 tools (CRÍTICO, "não agenda nada")

Erro real capturado na execução 9771:
```
Tool: [{"response":"{\"success\":false,\"erro\":\"fetch is not defined\"}"}]
```

Causa: o ambiente do `@n8n/n8n-nodes-langchain.toolCode` **não expõe `fetch` global** (não é Deno, não é browser). As 9 tools (`buscar_paciente`, `salvar_paciente`, `listar_especialidades`, `buscar_agenda`, `buscar_agenda_por_periodo`, `confirmar_agendamento`, `registrar_feedback`, `criar_solicitacao`, `transferir_humano`) usam `await fetch(...)` direto e **falham 100% das vezes**.

Resultado prático: a Sofia chama `listar_especialidades`, recebe erro, e responde "não consigo listar as especialidades agora". Por isso nunca agenda.

A API correta nesse contexto é `this.helpers.httpRequest({ method, url, headers, body, json })`.

### Bug 3 (menor) — `Digitando...` com payload inválido

Erro: `400 - "response":{"message":["[object Object]"]}` na chamada do Evolution API quando o paciente vem com `tipo` vazio (efeito colateral do bug 1). Some quando bug 1 estiver corrigido.

## Status do banco (validado por SQL real)

Tudo OK — não é gargalo:
- 6 especialidades ativas: Cardiologia, Clínica Geral, Dermatologia, Ginecologia, Ortopedia, Pediatria
- 6 médicos ativos, todos com horários cadastrados
- 2.264 slots disponíveis entre hoje e 2026-05-18

## Correção aplicada — v6

Arquivo: `/mnt/documents/Atendimento_-_Clinica_Medica_IA_First_v6.json`

Mudanças:
1. **`Verificar se Bot Ativo`**: passa a propagar `tipo` (default `'texto'`) e `messageId`.
2. **9 tools reescritas** trocando todo `await fetch(...)` por `await this.helpers.httpRequest({...})`. Inclui:
   - normalização NFD/lowercase/trim para nomes de especialidade;
   - validação de `missingFields` antes de chamar Supabase;
   - fallback retornando `especialidades_disponiveis` quando o nome não bate;
   - `Tool Confirmar Agendamento` só faz PATCH em slot existente com `status='disponivel'`;
   - `Tool Transferir Humano` notifica o admin `5583999915242` via Evolution.
3. Diagnóstico contagem final: **0** ocorrências de `fetch(` nas tools, **44** chamadas `this.helpers.httpRequest`.

## Como aplicar

1. https://n8n.nateksoft.com/ → workflow `Atendimento - Clinica Medica (IA First) v3` → Settings → **Deactivate**.
2. Menu → **Import from File** → `Atendimento_-_Clinica_Medica_IA_First_v6.json`.
3. Reabrir o nó **`Extrair Dados da Mensagem`** e colar a Groq key no `Bearer COLE_SUA_GROQ_KEY_AQUI` (só pra áudio funcionar).
4. Conferir credencial do `Google Gemini Chat Model`.
5. **Activate**.

## Validação pós-import

```sql
-- mensagens dos últimos minutos
SELECT direcao, tipo, agente, conteudo, created_at
FROM mensagens ORDER BY created_at DESC LIMIT 20;

-- slots ocupados após teste de confirmação
SELECT data_consulta, horario, especialidade, medico, status, paciente_telefone
FROM agendamentos WHERE status='confirmado' ORDER BY created_at DESC LIMIT 10;

-- handoffs criados
SELECT * FROM atendimentos_humanos ORDER BY created_at DESC LIMIT 5;
```

Critério de aceite: enviar "quero pediatria" → Sofia chama `listar_especialidades` (sucesso) → chama `buscar_agenda` → devolve até 5 horários reais → paciente escolhe → `confirmar_agendamento` ocupa o slot → linha `confirmado` aparece em `agendamentos`.
