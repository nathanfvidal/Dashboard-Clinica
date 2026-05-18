## Patch direto no JSON do workflow n8n

API do n8n respondendo (HTTP 200, 194 KB, 55 nós). Vou baixar, editar in-place via Python e dar `PUT` de volta.

### Edições

1. **Nó `Tool Cancelar_agendamento`** (HTTP Request Tool)
   - method=PATCH, url=`{{$env.SUPABASE_URL}}/rest/v1/agendamentos?id=eq.{{ $fromAI('id') }}`
   - body JSON: `{"status":"cancelado","paciente_telefone":"disponivel","paciente_nome":null}`
   - headers: `apikey`, `Authorization: Bearer SERVICE_ROLE`, `Content-Type`, `Prefer: return=representation`
   - toolDescription claro

2. **Nó `Tool Remarcar_agendamento`** (HTTP Request Tool)
   - method=POST, url=`{{$env.SUPABASE_URL}}/rest/v1/rpc/remarcar_agendamento`
   - body JSON: `{"p_antigo":"{{ $fromAI('id_antigo') }}","p_novo":"{{ $fromAI('id_novo') }}"}`
   - mesmos headers

3. **Nó `AI Agent Sofia`**
   - `parameters.options.returnIntermediateSteps = false`
   - `parameters.options.passthroughErrors = false`
   - Inserir/atualizar `systemMessage` com:
     - bloco de hora SP + regra de saudação
     - regra "não pedir nome/número se paciente já existe"
     - fluxo REMARCAR (listar via Tool Buscar Ultimo Agendamento, sem perguntar "pra quem é")
     - fluxo CANCELAR sem expor IDs/trace

### Estratégia segura

- Backup do JSON original em `/mnt/documents/n8n-workflow-backup.json`
- Antes do PUT eu mostro o diff dos 3 nós no chat pra você ver o que mudou
- PUT só envia os campos editáveis (`name`, `nodes`, `connections`, `settings`) — n8n bloqueia `active`/`id`/`versionId` no PUT
- Se algo falhar, restore com 1 comando

### Tools usadas
- `code--exec` (curl + python3) — sem mexer em arquivos do projeto

Aprovar e eu disparo.