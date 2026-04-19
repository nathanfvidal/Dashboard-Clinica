
O usuário quer que eu execute os 3 testes via MCP no workflow ativo (presumido v6) e mostre evidência real de sucesso. Isso requer chamadas a `mcp_n8n_eJdzs--execute_workflow` e `supabase--read_query` — tools disponíveis apenas no modo default (read/write). Em plan mode só posso planejar.

## Plano

1. Confirmar versão ativa
- `mcp_n8n_eJdzs--get_workflow_details` no `eqqEnl042R9NZN_UWToot` para verificar se o `Verificar se Bot Ativo` já propaga `tipo` e se as tools usam `this.helpers.httpRequest` (prova de que o v6 foi importado).

2. Capturar baseline no banco
- `SELECT max(created_at), count(*) FROM mensagens` antes dos testes pra ter referência temporal.

3. Rodar os 3 testes via `execute_workflow` (webhook do Evolution)
- Teste 1: "oi" — telefone `5583912340099`
- Teste 2: "quero pediatria de tarde" — telefone `5583912340002`
- Teste 3: "quero falar com humano urgente" — telefone `5583912340003`
- Cada um disparado como `webhookData` POST imitando payload do Evolution (`data.key.remoteJid`, `data.message.conversation`, `data.pushName`).

4. Validar resultado de cada execução
- Para cada teste, verificar no retorno do MCP se houve erro de nó (`fetch is not defined`, `mensagens_tipo_check`, etc).
- Rodar SQL pós-teste:
  - `SELECT direcao, tipo, agente, conteudo, created_at FROM mensagens WHERE created_at > $baseline ORDER BY created_at` — confirma que `Log Mensagem In` gravou com `tipo` válido.
  - `SELECT * FROM atendimentos_humanos ORDER BY created_at DESC LIMIT 3` — confirma handoff do teste 3.
  - `SELECT count(*) FROM agendamentos WHERE status='disponivel' AND especialidade ILIKE 'pediatria'` — confirma que `buscar_agenda` tem dado pra retornar.

5. Montar relatório de prova
- Tabela teste × execution_id × status do AI Agent × tools chamadas × erros.
- Citações literais do retorno do MCP onde antes aparecia `fetch is not defined`.
- Citações literais do INSERT em `mensagens` (prova que o bug do `tipo` morreu).
- Se ainda houver falha → diagnóstico do nó específico e patch para v7.

6. Critério de aceite
- Teste 1 e 2: linha `direcao='in', tipo='texto'` em `mensagens` + zero erro `fetch is not defined` na execução.
- Teste 2: Sofia chamou `listar_especialidades` e `buscar_agenda` com sucesso (visível no log da execution).
- Teste 3: linha em `atendimentos_humanos` com `status='aguardando'`.

## Detalhes técnicos
- Se `get_workflow_details` mostrar que o workflow ativo ainda é o v3 antigo (sem as correções), eu paro e aviso: "v6 não foi importado, sem isso testar de novo dá o mesmo erro".
- Vou usar telefones de teste diferentes pra não poluir histórico real.
- Não vou rodar mais que 3 execuções pra economizar quota MCP.
