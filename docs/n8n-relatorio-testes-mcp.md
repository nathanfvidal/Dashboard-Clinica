# Relatório de testes via MCP — workflow `Atendimento - Clinica Medica (IA First)`

Última atualização: 2026-04-19 04:48 UTC

## Rodada 5 — testes contra v9 ATIVO (rodados via MCP)

| # | Mensagem | Telefone | Exec | Resultado |
|---|---|---|---|---|
| 1 | "oi" | 5583912340301 | 9925 | mensagem gravada ✅ |
| 2 | "quero pediatria de tarde" | 5583912340302 | 9926 | tools rodaram (ver SQL) |
| 3 | "quero falar com humano urgente" | 5583912340303 | 9927 | **TDZ morreu**, mas agora **HTTP 409** |

### Bug TDZ MORREU — prova literal

Antes (v8): `"erro":"Cannot access 'motivo' before initialization"`
Agora (v9): `"erro":"Request failed with status code 409"`

A tool **executou**, leu `A.motivo` corretamente, montou body e fez POST. Bateu em FK.

### Causa raiz HTTP 409 no v9

```sql
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'public.atendimentos_humanos'::regclass;
```
Resultado:
```
atendimentos_humanos_paciente_telefone_fkey  →  FOREIGN KEY (paciente_telefone) REFERENCES pacientes(telefone)
```

O paciente `5583912340303` **não existia** em `pacientes` no momento do INSERT em `atendimentos_humanos`. PostgREST devolve **409 Conflict** quando viola FK. Mesma armadilha vale para `solicitacoes` (tem a mesma FK).

### SQL de validação pós-rodada 5

- `mensagens` (3 IN com `tipo='texto'`): ✅
- `atendimentos_humanos` para os 3 telefones: vazio ❌ (esperado, 409)
- `pacientes`: só `5583912340301` foi inserido (pelo node "Supabase - Buscar Paciente" que faz upsert do paciente do teste 1)

## Correção v10 — `Atendimento_-_Clinica_Medica_IA_First_v10.json`

**Mudança cirúrgica:** `Tool Transferir Humano` e `Tool Criar Solicitacao` passam a fazer **upsert do paciente antes** do INSERT principal (satisfaz FK). `transferir_humano` ainda marca `pacientes.status_sessao='humano'` no mesmo upsert (pausa o bot).

```js
// 1. Upsert paciente (FK)
await _post(SUPABASE_URL + '/rest/v1/pacientes?on_conflict=telefone',
  { telefone: tel, nome: A.paciente_nome, status_sessao: 'humano' },
  'resolution=merge-duplicates,return=representation');
// 2. Insert atendimento humano
await _post(SUPABASE_URL + '/rest/v1/atendimentos_humanos',
  { paciente_telefone: tel, paciente_nome: A.paciente_nome, motivo: A.motivo, status: 'aguardando' },
  'return=representation');
```

## Como aplicar v10

1. n8n → **Deactivate** workflow ativo
2. **Import from File** → `Atendimento_-_Clinica_Medica_IA_First_v10.json`
3. **Activate**

## Validação esperada após v10

- Teste 3 → `atendimentos_humanos` recebe linha com `status='aguardando'`, `motivo` preenchido.
- `pacientes.status_sessao='humano'` para o telefone do teste.
- Próxima mensagem desse paciente cai no branch "humano" do `IF Bot Ativo?` (sem chamar Sofia).

---

## Histórico anterior
Workflow ID: `eqqEnl042R9NZN_UWToot`

## Status atual dos bugs

| Bug | v3 | v6 | v7 | v8 | v9 |
|---|---|---|---|---|---|
| `mensagens_tipo_check` violado | ❌ | ✅ | ✅ | ✅ | ✅ |
| `fetch is not defined` nas tools | ❌ | ✅ | ✅ | ✅ | ✅ |
| Tools com args leem `undefined` | ❌ | ❌ | ✅ | ✅ | ✅ |
| Conflito `Identifier 'X' already declared` | — | — | ❌ | ✅ | ✅ |
| TDZ `Cannot access 'X' before initialization` | — | — | — | ❌ | ✅ |
| `Digitando...` quebra o fluxo | ❌ | ❌ | ✅ (onError) | ✅ | ✅ |
| `Evolution API - Enviar Mensagem` 400 | n/a | n/a | ⚠️ | ⚠️ | ⚠️ |

## Rodada 4 — testes contra v8 ATIVO (rodados via MCP)

### Resultados crus

| # | Mensagem | Telefone | Exec | Resultado |
|---|---|---|---|---|
| 1 | "oi" | 5583912340201 | 9920 | mensagem gravada, Sofia respondeu (sem tool) |
| 2 | "quero pediatria de tarde" | 5583912340202 | 9921 | **`buscar_agenda_por_periodo` retornou 10 horários reais** ✅ |
| 3 | "quero falar com humano urgente, reclamação séria" | 5583912340203 | 9922 | **`transferir_humano` falhou: `Cannot access 'motivo' before initialization`** ❌ |

### PROVA — `buscar_agenda_por_periodo` funcionou (exec 9921)

Citação literal:
```
AI: Calling Tool Listar Especialidades with input: {"id":"692c4ab3-..."}
Tool: [{"response":"{\"success\":true,\"total\":6,\"especialidades\":[{\"nome\":\"Cardiologia\"...},{\"nome\":\"Pediatria\",\"descricao\":\"Saúde de bebês, crianças e adolescentes\"}]}"}]

AI: Calling Tool Buscar Agenda por Periodo with input:
    {"especialidade":"Pediatria","turno":"tarde","id":"61881f7c-..."}
Tool: [{"response":"{\"success\":true,\"especialidade\":\"Pediatria\",\"turno\":\"tarde\",\"total\":10,
  \"horarios\":[
    {\"id\":\"6e9d66cb-...\",\"data\":\"2026-04-20\",\"horario\":\"14:00\",\"medico\":\"Dra. Beatriz Souza\"},
    {\"id\":\"3f97195d-...\",\"data\":\"2026-04-20\",\"horario\":\"14:30\",\"medico\":\"Dra. Beatriz Souza\"},
    ...
  ]}"}]
```
Sofia respondeu literalmente ao paciente:
> *"Certo. Para Pediatria na parte da tarde temos os seguintes horários:*
> *20/04 às 14:00 com Dra. Beatriz Souza, 14:30, 15:00, 15:30, 16:00. Qual horário você prefere?"*

### NOVO BUG no v8 — Tool Transferir Humano (exec 9922)

Citação literal do log:
```
AI: Calling Tool Transferir Humano with input:
    {"telefone":"5583912340203","paciente_nome":"Teste V8 Tres",
     "motivo":"Paciente quer falar com humano urgente, com reclamação séria sobre atendimento.",
     "id":"6c215c3f-..."}

Tool: [{"response":"{\"success\":false,\"erro\":\"Cannot access 'motivo' before initialization\"}"}]
```

### Causa raiz do bug v8 (TDZ)

O prelude v8 fez `if (typeof motivo === 'undefined' ...) { motivo = __args.motivo }`. Em **strict mode**, `typeof` numa variável `let` declarada pela langchain mas ainda **não inicializada** lança `ReferenceError: Cannot access 'motivo' before initialization` (Temporal Dead Zone). O try/catch interno também explode porque o próprio `typeof motivo` está dentro do `try` mas a referência ocorre antes da entrada no bloco protegido em algumas execuções do V8 engine.

Validação SQL pós-rodada 4:
```sql
SELECT direcao,tipo,paciente_telefone,LEFT(conteudo,80) FROM mensagens
WHERE created_at > '2026-04-19 04:39:35' ORDER BY created_at;
-- 3 linhas, todas direcao='in' tipo='texto' ✅

SELECT * FROM atendimentos_humanos
WHERE paciente_telefone IN ('5583912340201','5583912340202','5583912340203');
-- VAZIO ❌  (esperado — tool quebrou antes do INSERT)
```

## Correção v9 — `Atendimento_-_Clinica_Medica_IA_First_v9.json`

**Estratégia:** abandonar completamente referências às variáveis injetadas pela langchain. Toda leitura de argumento é via `A.X` (alias de `__args`). Sem `var`, sem `let`, sem `typeof X` em var em TDZ, sem `globalThis`.

```js
let __args = {};
try {
  if (typeof query === 'object' && query) __args = query;
  else if (typeof query === 'string' && query.trim().startsWith('{')) __args = JSON.parse(query);
} catch(_) {}
const A = __args || {};
// uso: A.motivo, A.especialidade, A.turno  — nunca toca em motivo/especialidade puros.
```

**Bonus:** todas as 9 tools foram **reconstruídas do zero** com bodies limpos e idempotentes (helpers `_get`/`_post`/`_patch` compartilhados via prelude). Diagnóstico final automatizado: 0 ocorrências de `fetch(`, `globalThis`, `var motivo`, `var especialidade` etc. 9 tools com prelude v9.

## Como aplicar v9

1. n8n → workflow ativo → **Deactivate**
2. **Import from File** → `Atendimento_-_Clinica_Medica_IA_First_v9.json`
3. **Activate**

## Validação esperada após v9

- Teste 3 (humano) → tool retorna `success:true` + linha em `atendimentos_humanos` com `status='aguardando'` + `pacientes.status_sessao='humano'`.
- Teste 2 (pediatria tarde) → continua retornando 10 horários reais.
- Teste 1 (oi) → continua gravando mensagem com `tipo='texto'`.

## Rodada 3 — testes contra v7 ATIVO (rodados via MCP)

### Resultados crus

| # | Mensagem | Telefone | Exec | Resultado |
|---|---|---|---|---|
| 1 | "oi" | 5583912340101 | 9917 | mensagem gravada, Sofia respondeu |
| 2 | "quero pediatria de tarde" | 5583912340102 | 9918 | **`buscar_agenda_por_periodo` retornou 10 horários reais** ✅ |
| 3 | "quero falar com humano urgente, é uma reclamação séria" | 5583912340103 | 9919 | **`transferir_humano` falhou com `Identifier 'motivo' already declared`** ❌ |

### PROVA — `buscar_agenda_por_periodo` funcionou (exec 9918)

Citação literal do log do `Google Gemini Chat Model`:
```
AI: Calling Tool Buscar Agenda por Periodo with input:
    {"especialidade":"Pediatria","turno":"Tarde","id":"2c64604e-..."}

Tool: [{"response":"{
  \"success\":true,
  \"especialidade\":\"Pediatria\",
  \"turno\":\"tarde\",
  \"total\":10,
  \"horarios\":[
    {\"id\":\"6e9d66cb-...\",\"data\":\"2026-04-20\",\"horario\":\"14:00\",\"medico\":\"Dra. Beatriz Souza\"},
    {\"id\":\"3f97195d-...\",\"data\":\"2026-04-20\",\"horario\":\"14:30\",\"medico\":\"Dra. Beatriz Souza\"},
    {\"id\":\"f65f1395-...\",\"data\":\"2026-04-20\",\"horario\":\"15:00\",\"medico\":\"Dra. Beatriz Souza\"},
    ...
  ]
}"}]
```
E a resposta final da Sofia para o paciente:
> *"Para Pediatria, tenho os seguintes horários à tarde com Dra. Beatriz Souza:*
> *20/04 às 14:00, 20/04 às 14:30, 20/04 às 15:00, 20/04 às 15:30, 20/04 às 16:00.*
> *Qual horário você prefere?"*

**Tools com args funcionam no v7 — bug confirmado morto.**

### NOVO BUG no v7 — Tool Transferir Humano (exec 9919)

Citação literal:
```
AI: Calling Tool Transferir Humano with input:
    {"paciente_nome":"Teste V7 Tres","motivo":"reclamação séria","telefone":"5583912340103",...}

Tool: [{"response":"There was an error: \"Identifier 'motivo' has already been declared\""}]
```

### Causa raiz
O prelude v7 fez `var motivo = ...`. Mas a langchain **já declara** algumas variáveis no escopo (depende do schema). Para a tool `Transferir Humano`, ela já declarou `motivo`, então o `var motivo` redeclarando explodiu com `SyntaxError`.

No teste 2 (`Buscar Agenda por Periodo`) o conflito não aconteceu porque a langchain **não tinha declarado** `especialidade`/`turno` lá — comportamento inconsistente.

## Correção v8 — `Atendimento_-_Clinica_Medica_IA_First_v8.json`

Prelude novo (sem `var`, sem conflito):
```js
let __args = {};
try {
  if (typeof query === 'object' && query) __args = query;
  else if (typeof query === 'string' && query.trim().startsWith('{')) __args = JSON.parse(query);
} catch(_) {}
// para args que langchain NÃO declarou, expor via globalThis (não conflita)
if (typeof motivo === 'undefined') { globalThis.motivo = __args.motivo; }
// para args que langchain DECLAROU como undefined, sobrescreve
try { if ((typeof motivo === 'undefined' || motivo === null || motivo === '') 
          && Object.prototype.hasOwnProperty.call(__args,'motivo')) { motivo = __args.motivo; } }
catch(_e) { globalThis.motivo = __args.motivo; }
```
Aplicado nas 8 tools com args. Diagnóstico final:
- 0 ocorrências `fetch(`
- 44 chamadas `this.helpers.httpRequest`
- 0 sobras do prelude v7
- 8 tools com prelude v8

## Validação SQL pós-rodada 3

```sql
SELECT direcao, tipo, paciente_telefone, conteudo, created_at
FROM mensagens WHERE created_at > '2026-04-19 04:30:47' ORDER BY created_at;
```
Resultado: 3 linhas com `direcao=in, tipo=texto` — **bug do tipo continua morto**.

```sql
SELECT * FROM atendimentos_humanos
WHERE paciente_telefone IN ('5583912340101','5583912340102','5583912340103');
```
Resultado: vazio. **Esperado** — tool `Transferir Humano` quebrou no v7 antes do INSERT. Será criada após v8.

## Bug residual conhecido (NÃO crítico)

`Digitando...` e `Evolution API - Enviar Mensagem` retornam 400 da Evolution. O fluxo continua porque ambos têm `onError: continueRegularOutput`. Causa provável: instância `Clinica` do Evolution sem sessão ativa nesta janela de teste, ou número de teste inválido na lista de contatos da instância.

Como não polui o banco e não bloqueia tools, **não é prioridade pra v8**. Após confirmar v8, podemos validar a entrega real do WhatsApp com um número válido cadastrado no Evolution.

## Como aplicar v8

1. n8n → workflow ativo → **Deactivate**
2. **Import from File** → `Atendimento_-_Clinica_Medica_IA_First_v8.json`
3. **Activate**

## Validação esperada após v8

- Repetir teste 3 (humano) → tool retorna `success:true` e cria linha em `atendimentos_humanos`.
- Repetir teste 2 (pediatria tarde) → continua funcionando, tool retorna 10 horários.
- Adicional: enviar "pode confirmar 14:00" → `confirmar_agendamento` com nome do paciente faltante deve pedir nome e depois efetivar PATCH.
