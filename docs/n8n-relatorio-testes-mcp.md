# Relatório de testes via MCP — workflow `Atendimento - Clinica Medica (IA First)`

Última atualização: 2026-04-19 04:30 UTC
Workflow ID: `eqqEnl042R9NZN_UWToot`
Workflow ativo no n8n: **v6** (importado pelo usuário, confirmado via `get_workflow_details` — versionId `fbe223bd-e131-4f25-adea-446d6e9095b3`).

## Resumo executivo

| Bug | Status no v6 |
|---|---|
| `mensagens_tipo_check` violado | ✅ **CORRIGIDO** (provado por SQL) |
| `fetch is not defined` nas tools | ✅ **CORRIGIDO** (provado pelo log da execução 9914) |
| Tools de args (`buscar_agenda`, `confirmar_agendamento`, etc) leem args errado | ❌ **NOVO BUG ENCONTRADO** — patch v7 abaixo |
| `Digitando...` retorna 400 na Evolution API | ⚠️ corrigido no v7 com `onError:continueRegularOutput` + delay reduzido |

## Testes executados (rodada 2 — contra v6)

| # | Mensagem | Telefone | Execution ID | Resultado |
|---|---|---|---|---|
| 1 | "oi" | 5583912340099 | 9913 | mensagem gravada, Sofia respondeu pedindo dados |
| 2 | "quero pediatria de tarde" | 5583912340002 | 9914 | mensagem gravada, listar_especialidades **OK**, buscar_agenda_por_periodo **falhou por leitura de args** |
| 3 | "quero falar com humano urgente" | 5583912340003 | 9916 | mensagem gravada, transferir_humano **falhou pelo mesmo motivo** |

### Prova SQL — bug do `tipo` morreu

```sql
SELECT direcao, tipo, agente, paciente_telefone, conteudo, created_at
FROM mensagens WHERE created_at > '2026-04-19 02:00:02'
ORDER BY created_at;
```
Retorno real:
```
direcao=in tipo=texto agente=sofia 5583912340099 "oi"            04:30:26
direcao=in tipo=texto agente=sofia 5583912340002 "quero pediatria de tarde" 04:30:37
direcao=in tipo=texto agente=sofia 5583912340003 "quero falar com humano urgente" 04:30:47
```
Antes: ZERO inserts (constraint quebrava). Agora: **3 de 3** com `tipo='texto'` válido.

### Prova log — `fetch is not defined` morreu

Execução 9914 (`Tool Listar Especialidades`), citação literal do retorno:
```
Tool: [{"response":"{\"success\":true,\"total\":6,\"especialidades\":[
  {\"nome\":\"Cardiologia\"...},{\"nome\":\"Pediatria\"...}
]}"}]
```
Antes (v3): `{"response":"{\"success\":false,\"erro\":\"fetch is not defined\"}"}`. Agora retorna 6 especialidades reais do Supabase.

## Bug NOVO descoberto no v6 — leitura de args nas tools

### Sintoma
Na execução 9914, a Sofia chamou:
```
Calling Tool Buscar Agenda por Periodo with input: {"especialidade":"Pediatria","turno":"tarde","id":"..."}
```
Mas a tool retornou:
```
{"success":false,"missingFields":["especialidade","turno"],"mensagem":"Informe especialidade e turno."}
```

### Causa raiz
O `@n8n/n8n-nodes-langchain.toolCode` **não injeta os argumentos como variáveis JS soltas** (ex.: `especialidade`, `turno`). O padrão usado nas 8 tools com args:
```js
const espIn = (typeof especialidade !== 'undefined' && especialidade) ? ... : '';
```
sempre cai em `undefined` porque `especialidade` não existe no escopo do jsCode. Os args chegam dentro do objeto `query` (ou pelo `$input.first().json`).

Por isso `Listar Especialidades` (tool sem args) funcionou e **as 8 tools que precisam de input falham**.

### Tools afetadas
`buscar_paciente`, `salvar_paciente`, `buscar_agenda`, `buscar_agenda_por_periodo`, `confirmar_agendamento`, `registrar_feedback`, `criar_solicitacao`, `transferir_humano`.

## Correção aplicada — v7

Arquivo: `/mnt/documents/Atendimento_-_Clinica_Medica_IA_First_v7.json`

Mudanças nas 8 tools — prelude injetado logo após `try {`:
```js
let __args = {};
try {
  if (typeof query === 'object' && query) __args = query;
  else if (typeof query === 'string' && query.trim().startsWith('{')) __args = JSON.parse(query);
  else if (typeof $input !== 'undefined') {
    const it = $input.first ? $input.first() : null;
    if (it && it.json) __args = it.json;
  }
} catch(_) {}
var especialidade = (typeof especialidade !== 'undefined' && especialidade) ? especialidade : __args.especialidade;
var turno = ...;
// (e assim por diante para cada arg da tool)
```
O resto do código original permanece — as variáveis nomeadas agora caem para `__args.X` quando `undefined`.

Outras mudanças:
- **`Digitando...`**: `delay` reduzido de 15000 → 1200 (Evolution rejeita delay alto com `[object Object]`) e `onError: continueRegularOutput` para nunca quebrar o fluxo.

Diagnóstico final do v7:
- 0 ocorrências de `fetch(` nas tools
- 44 chamadas `this.helpers.httpRequest`
- 8 tools com prelude `extrai args injetados`

## Como aplicar v7

1. n8n → workflow ativo → **Deactivate**.
2. **Import from File** → `Atendimento_-_Clinica_Medica_IA_First_v7.json`.
3. Reconferir credencial do `Google Gemini Chat Model` e a Groq key no `Extrair Dados da Mensagem` (só pra áudio).
4. **Activate**.

## Validação esperada após v7

Repetir teste 2: paciente diz "quero pediatria de tarde". Resultado esperado:
1. `listar_especialidades` → 6 especialidades (já funciona)
2. `buscar_agenda_por_periodo({especialidade:"Pediatria", turno:"tarde"})` → retorna até 5 horários reais (corrige no v7)
3. paciente escolhe → `confirmar_agendamento` ocupa o slot

```sql
-- após paciente confirmar
SELECT data_consulta, horario, especialidade, medico, status, paciente_telefone
FROM agendamentos WHERE status='confirmado' ORDER BY created_at DESC LIMIT 5;
```
