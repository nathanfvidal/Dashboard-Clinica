

Vou inspecionar o workflow no n8n via MCP para validar que tudo foi aplicado corretamente.
<lov-tool-use id="toolu_vrtx_013LKigrEVriWMmuR5ckmKuQ" name="mcp_n8n_eJdzs--get_workflow_details" integration-id="mcp_n8n_eJdzs" integration-display-name="n8n" connector-id="n8n" data="{\"workflowId\": \"eqqEnl042R9NZN_UWToot\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01JqBEBWZqa6QWxJsijcMTEA" name="mcp_n8n_eJdzs--search_workflows" integration-id="mcp_n8n_eJdzs" integration-display-name="n8n" connector-id="n8n" data="{\"query\": \"Clinica\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01NBsGSdpTpjSKGCdhuZMT1c" name="mcp_n8n_eJdzs--get_workflow_details" integration-id="mcp_n8n_eJdzs" integration-display-name="n8n" connector-id="n8n" data="{\"workflowId\": \"eqqEnl042R9NZN_UWToot\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_013GUMPS7ARxk518uEx3YFEJ" name="mcp_n8n_eJdzs--search_workflows" integration-id="mcp_n8n_eJdzs" integration-display-name="n8n" connector-id="n8n" data="{\"query\": \"Clinica\"}">
</lov-tool-use>
O workflow está ativo (`active: true`), com 4 triggers (1 webhook + 3 crons) e todos os 44 nós da v2 estão presentes. Vou verificar pontos específicos: a Groq key foi colada? O system prompt do agente, e detalhes dos nós críticos.
<lov-tool-use id="toolu_vrtx_01KqD8pMpT956HENJHVxRQjP" name="code--exec" integration-id="code" data="{\"command\": \"cat \\\"tool-results://mcp_n8n_eJdzs--get_workflow_details/20260418-154254-278096\\\" 2>/dev/null | head -c 200 || ls /tmp/ | head\", \"user_facing_description\": \"Verificando arquivo temporário do n8n\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_018ve47qz4BpWzYLLR2NZ6PA" name="code--view" integration-id="code" data="{\"file_path\": \"tool-results://mcp_n8n_eJdzs--get_workflow_details/20260418-154254-278096\", \"lines\": \"1-1\"}">
</lov-tool-use>
Já tenho o suficiente para fazer a análise. Vou verificar dois pontos críticos: (1) Groq key ainda como placeholder, (2) memória sessionKey 6h, (3) tool transferir_humano. Vou checar pelo sandbox o JSON local que o usuário aplicou.
<lov-tool-use id="toolu_vrtx_012or9Vdf97Y6mwj7NAg78gn" name="code--exec" integration-id="code" data="{\"command\": \"grep -c \\\"COLE_SUA_GROQ_KEY_AQUI\\\" /mnt/documents/Atendimento_-_Clinica_Medica_IA_First_v2.json 2>/dev/null; grep -c \\\"5583999915242\\\" /mnt/documents/Atendimento_-_Clinica_Medica_IA_First_v2.json 2>/dev/null; grep -c \\\"6\\\\\\\\*60\\\\\\\\*60\\\\\\\\*1000\\\" /mnt/documents/Atendimento_-_Clinica_Medica_IA_First_v2.json 2>/dev/null\", \"user_facing_description\": \"Conferindo Groq key, admin e sessionKey\"}">
</lov-tool-use>
O JSON entregue tem 1 ocorrência do placeholder Groq, 1 do admin e 1 da janela de 6h. No n8n online o nó `Extrair Dados da Mensagem` ainda mostra `Bearer COLE_SUA_GROQ_KEY_AQUI` — ou seja, **a Groq key não foi colada**. Áudio vai falhar.

<lov-plan>

## Análise do MCP n8n — workflow `Atendimento - Clinica Medica (IA First)`

### Status geral
- Workflow **ativo** (`active: true`), `versionId` novo, `availableInMCP: true`.
- **44 nós** presentes, **4 triggers** (1 Webhook + 3 Crons). Bate 100% com a v2.
- Topologia (`connections`) confere com o plano:
  - Principal: `Webhook → Extrair → Buscar Pac → Verificar Bot → IF → (true: Log In → Update Atividade → Digitando → AI Agent → Consolidar → Enviar → Log Out) (false: Log Mensagem Humano)`
  - Cron D-1: `Schedule → Calcular Janela → GET → Split (loop) → Evolution → PATCH → Log → volta pro Split`
  - Cron T-2h e Cron 19h FB: mesma estrutura.
- Tools ligadas ao agente Sofia: `buscar_paciente, salvar_paciente, buscar_agenda, buscar_agenda_por_periodo, listar_especialidades, confirmar_agendamento, registrar_feedback, criar_solicitacao, transferir_humano` — 9 tools, todas conectadas via `ai_tool`.
- Memory: `Window Buffer Memory` ligada ao agente, sessionKey com janela de **6h** confirmada no JSON.
- Admin handoff `5583999915242` presente no nó `Tool Transferir Humano`.

### Problema crítico encontrado (1)

**Groq key não foi substituída** — o nó `Extrair Dados da Mensagem` ainda contém literalmente:
```js
Authorization: 'Bearer COLE_SUA_GROQ_KEY_AQUI'
```
Resultado prático: qualquer áudio que chegar vai cair no `catch` e o paciente vai ver "🎙️ (áudio não transcrito): ...". Texto e tudo o mais funciona normal.

### Observações menores (não-bloqueantes)
- System prompt do Sofia ainda contém **emojis** e a **lista fixa de 6 especialidades** (Clínica Geral / Cardio / Dermato / Gineco / Ortopedia / Pediatria). Isso é intencional pelo seu pedido anterior ("os system prompt do agente pode ter emoji, ignore isso"), mas o `docs/n8n-atualizacoes-completas.md` seção 6 pede para remover. Mantido como está.
- Os 3 crons compartilham o mesmo workflow → desativar para manutenção pausa tudo junto (já documentado).
- Nó `Supabase - Buscar Paciente` está com `onError: continueRegularOutput`: bom para não travar no primeiro acesso, mas se o Supabase estiver fora a Sofia recebe `paciente_existe=false` silenciosamente. Aceitável.

### Veredicto
Tudo dos 3 sprints implementado e ligado certo no n8n. **Falta apenas colar a Groq key** para o áudio funcionar.

### Próximo passo proposto

Como estamos em modo plan/read-only, não consigo editar o workflow. Quando você aprovar este plano, eu (em modo default) faço o seguinte com o MCP:

1. **Pedir a Groq key via `add_secret`** (`GROQ_API_KEY`) — fica salva como secret do projeto, sem aparecer no código.
2. Como o MCP do n8n atual só expõe `search_workflows`, `get_workflow_details` e `execute_workflow` (não há `update_workflow`), a substituição da key precisa ser feita **manualmente no editor do n8n** — abrir o nó `Extrair Dados da Mensagem`, trocar `COLE_SUA_GROQ_KEY_AQUI` pela chave e salvar. Vou te entregar o passo-a-passo curto.
3. Depois disso, executar um **teste end-to-end via MCP** chamando `execute_workflow` com payload simulando uma mensagem de texto e verificando que cai em `Log Mensagem In → AI Agent → Log Mensagem Out`.
4. Para áudio, pedir que você mande um WhatsApp real e eu olho na tabela `mensagens` (Supabase) se entrou linha com `tipo='audio'` e conteúdo transcrito.

