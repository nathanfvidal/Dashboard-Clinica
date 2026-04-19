# Patch v13.1 — Fix dos 3 Logs de Cron

**Workflow:** `Atendimento - Clinica Medica (IA First) v13`  
**ID:** `eqqEnl042R9NZN_UWToot`

## Bugs corrigidos

| # | Nó | Bug v13 | Fix v13.1 |
|---|---|---|---|
| B2.1 | `Log Lembrete D-1` | `tipo='lembrete_d1'` viola `mensagens_tipo_check` | `tipo='texto'` + `metadata.evento='lembrete_d1'` |
| B2.2 | `Log Pesquisa` | `tipo='feedback'` viola constraint | `tipo='texto'` + `metadata.evento='pesquisa_satisfacao'` |
| B2.3 | `Log Reativacao` | `tipo='reativacao'` + `paciente_telefone=NULL` | `tipo='texto'` + `metadata.evento='reativacao_humana'` + telefone do `Split Reativar` |

---

## Como aplicar

### Opção A — Editar os 3 nós manualmente no n8n

Abra o workflow v13 no editor e substitua os parâmetros HTTP de cada um dos 3 nós abaixo.

---

### Nó 1: `Log Lembrete D-1` (HTTP Request POST)

**URL:** `https://opzeqlcpmbmaugtdaipx.supabase.co/rest/v1/mensagens`

**Headers:** (mantém os existentes — apikey, Authorization, Content-Type, `Prefer: return=minimal`)

**Body (jsonBody):**
```json
={{ JSON.stringify({
  paciente_telefone: $('Split D-1').item.json.paciente_telefone,
  direcao: 'out',
  agente: 'sistema',
  tipo: 'texto',
  conteudo: 'Lembrete D-1 enviado: consulta amanhã às ' + $('Split D-1').item.json.horario,
  metadata: {
    evento: 'lembrete_d1',
    agendamento_id: $('Split D-1').item.json.id,
    data_consulta: $('Split D-1').item.json.data_consulta,
    horario: $('Split D-1').item.json.horario
  }
}) }}
```

---

### Nó 2: `Log Pesquisa` (HTTP Request POST)

**URL:** `https://opzeqlcpmbmaugtdaipx.supabase.co/rest/v1/mensagens`

**Body (jsonBody):**
```json
={{ JSON.stringify({
  paciente_telefone: $('Split FB').item.json.paciente_telefone,
  direcao: 'out',
  agente: 'sistema',
  tipo: 'texto',
  conteudo: 'Pesquisa de satisfação enviada após consulta de ' + $('Split FB').item.json.data_consulta,
  metadata: {
    evento: 'pesquisa_satisfacao',
    agendamento_id: $('Split FB').item.json.id,
    data_consulta: $('Split FB').item.json.data_consulta,
    horario: $('Split FB').item.json.horario
  }
}) }}
```

---

### Nó 3: `Log Reativacao` (HTTP Request POST)

**URL:** `https://opzeqlcpmbmaugtdaipx.supabase.co/rest/v1/mensagens`

**Body (jsonBody):**
```json
={{ JSON.stringify({
  paciente_telefone: $('Split Reativar').item.json.telefone,
  direcao: 'out',
  agente: 'sistema',
  tipo: 'texto',
  conteudo: 'Sessão humana expirou (>24h sem atividade). Bot reativado automaticamente.',
  metadata: {
    evento: 'reativacao_humana',
    paciente_id: $('Split Reativar').item.json.id,
    ultima_atividade_anterior: $('Split Reativar').item.json.ultima_atividade_bot,
    horas_inativo: $('Split Reativar').item.json.horas_inativo
  }
}) }}
```

> **Importante:** o nó `Split Reativar` deve emitir `telefone` (não `paciente_telefone`) na coluna do output. Se o nome do campo no seu Split for diferente, ajuste o `$('Split Reativar').item.json.<campo>` correspondente.

---

## Opção B — Importar JSON parcial

O arquivo `docs/n8n-patch-v13.1.json` (abaixo) contém os 3 nós completos prontos pra substituir via "Replace node" no editor n8n.

```json
{
  "nodes": [
    {
      "parameters": {
        "method": "POST",
        "url": "https://opzeqlcpmbmaugtdaipx.supabase.co/rest/v1/mensagens",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "apikey", "value": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wemVxbGNwbWJtYXVndGRhaXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NDAxNjcsImV4cCI6MjA5MTAxNjE2N30.5sGz56SVTnPqwMnHTxiy0bg-6QPNaJo70Xi1Nyz1YI8" },
            { "name": "Authorization", "value": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wemVxbGNwbWJtYXVndGRhaXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NDAxNjcsImV4cCI6MjA5MTAxNjE2N30.5sGz56SVTnPqwMnHTxiy0bg-6QPNaJo70Xi1Nyz1YI8" },
            { "name": "Content-Type", "value": "application/json" },
            { "name": "Prefer", "value": "return=minimal" }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify({ paciente_telefone: $('Split D-1').item.json.paciente_telefone, direcao: 'out', agente: 'sistema', tipo: 'texto', conteudo: 'Lembrete D-1 enviado: consulta amanhã às ' + $('Split D-1').item.json.horario, metadata: { evento: 'lembrete_d1', agendamento_id: $('Split D-1').item.json.id, data_consulta: $('Split D-1').item.json.data_consulta, horario: $('Split D-1').item.json.horario } }) }}",
        "options": {}
      },
      "name": "Log Lembrete D-1",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "onError": "continueRegularOutput"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://opzeqlcpmbmaugtdaipx.supabase.co/rest/v1/mensagens",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "apikey", "value": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wemVxbGNwbWJtYXVndGRhaXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NDAxNjcsImV4cCI6MjA5MTAxNjE2N30.5sGz56SVTnPqwMnHTxiy0bg-6QPNaJo70Xi1Nyz1YI8" },
            { "name": "Authorization", "value": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wemVxbGNwbWJtYXVndGRhaXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NDAxNjcsImV4cCI6MjA5MTAxNjE2N30.5sGz56SVTnPqwMnHTxiy0bg-6QPNaJo70Xi1Nyz1YI8" },
            { "name": "Content-Type", "value": "application/json" },
            { "name": "Prefer", "value": "return=minimal" }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify({ paciente_telefone: $('Split FB').item.json.paciente_telefone, direcao: 'out', agente: 'sistema', tipo: 'texto', conteudo: 'Pesquisa de satisfação enviada após consulta de ' + $('Split FB').item.json.data_consulta, metadata: { evento: 'pesquisa_satisfacao', agendamento_id: $('Split FB').item.json.id, data_consulta: $('Split FB').item.json.data_consulta, horario: $('Split FB').item.json.horario } }) }}",
        "options": {}
      },
      "name": "Log Pesquisa",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "onError": "continueRegularOutput"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://opzeqlcpmbmaugtdaipx.supabase.co/rest/v1/mensagens",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "apikey", "value": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wemVxbGNwbWJtYXVndGRhaXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NDAxNjcsImV4cCI6MjA5MTAxNjE2N30.5sGz56SVTnPqwMnHTxiy0bg-6QPNaJo70Xi1Nyz1YI8" },
            { "name": "Authorization", "value": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wemVxbGNwbWJtYXVndGRhaXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NDAxNjcsImV4cCI6MjA5MTAxNjE2N30.5sGz56SVTnPqwMnHTxiy0bg-6QPNaJo70Xi1Nyz1YI8" },
            { "name": "Content-Type", "value": "application/json" },
            { "name": "Prefer", "value": "return=minimal" }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify({ paciente_telefone: $('Split Reativar').item.json.telefone, direcao: 'out', agente: 'sistema', tipo: 'texto', conteudo: 'Sessão humana expirou (>24h sem atividade). Bot reativado automaticamente.', metadata: { evento: 'reativacao_humana', paciente_id: $('Split Reativar').item.json.id, ultima_atividade_anterior: $('Split Reativar').item.json.ultima_atividade_bot } }) }}",
        "options": {}
      },
      "name": "Log Reativacao",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "onError": "continueRegularOutput"
    }
  ]
}
```

---

## Validação pós-import

Após substituir os 3 nós e salvar o workflow, dispare os 3 webhooks:

```bash
N8N="https://n8n.nateksoft.com/webhook"
for path in cron-d1 cron-fb cron-reativacao; do
  echo "=== POST $path ==="
  curl -s -X POST "$N8N/$path" -H "Content-Type: application/json" -d '{}' | head -c 200
  echo ""
done
```

Depois, valide via SQL:

```sql
SELECT paciente_telefone, agente, tipo, metadata->>'evento' AS evento, conteudo, created_at
FROM mensagens
WHERE agente = 'sistema' AND created_at > now() - interval '5 minutes'
ORDER BY created_at DESC;
```

**Esperado:** 3 linhas com `tipo='texto'`, `agente='sistema'`, `metadata.evento` em `('lembrete_d1','pesquisa_satisfacao','reativacao_humana')`, e nenhum erro de constraint nos logs do n8n.

---

## Critério de aceite v13.1

- [ ] `Log Lembrete D-1` insere com `tipo='texto'` + `metadata.evento='lembrete_d1'`
- [ ] `Log Pesquisa` insere com `tipo='texto'` + `metadata.evento='pesquisa_satisfacao'`
- [ ] `Log Reativacao` insere com `paciente_telefone` correto (não NULL) + `metadata.evento='reativacao_humana'`
- [ ] Zero erros de `mensagens_tipo_check` nos execution logs do n8n
- [ ] PATCHes de `lembrete_d1_enviado_at`, `feedback_solicitado_at` e `pacientes.status_sessao` continuam funcionando como no v13
