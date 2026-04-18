
Objetivo: sair do “não agenda nada” com uma rodada de diagnóstico real no workflow do n8n e corrigir a causa raiz, não só o JSON superficial.

O que já ficou claro pela auditoria
- O banco não parece ser o gargalo principal: a função `gerar_agenda_mes` existe, cria slots com `status='disponivel'`, `medico_id` e `especialidade_id`.
- O app React também está coerente com esse modelo.
- O maior suspeito continua sendo o workflow n8n:
  1. parâmetros não chegando nas tools (`especialidade` / `turno`);
  2. ordem errada entre `listar_especialidades` e `buscar_agenda`;
  3. extração da mensagem antes do AI Agent;
  4. prompt da Sofia não forçando a sequência correta;
  5. possível divergência entre o workflow ativo e o JSON v4 que você está vendo.
- Também confirmei que o arquivo `Atendimento_-_Clinica_Medica_IA_First_v4.json` não está no repositório local, então a correção precisa ser baseada no workflow real via MCP + novo JSON exportável.

Plano de ação
1. Auditar o workflow real no MCP nó por nó
- Ler o workflow `Atendimento - Clinica Medica (IA First)` via MCP.
- Conferir especialmente:
  - `Extrair Dados da Mensagem`
  - `Supabase - Buscar Paciente`
  - `Verificar se Bot Ativo`
  - `IF Bot Ativo?`
  - `AI Agent Sofia`
  - `Tool Listar Especialidades`
  - `Tool Buscar Agenda`
  - `Tool Buscar Agenda por Periodo`
  - `Tool Confirmar Agendamento`
  - `Tool Registrar Feedback`
  - `Tool Transferir Humano`
- Validar nomes, conexões, `description`, `inputSchema`, `schemaType`, `jsonSchemaExample`, `name` interno e `jsCode`.

2. Fazer testes controlados no MCP para reproduzir o bug
- Executar o workflow com payloads simulados, cobrindo pelo menos:
  - “oi”
  - “quero marcar consulta”
  - “quero pediatria”
  - “prefiro de tarde”
  - “pode marcar esse horário”
- Objetivo dos testes:
  - ver se o AI Agent chama `listar_especialidades` antes de `buscar_agenda`;
  - confirmar se `especialidade` chega preenchida na tool;
  - confirmar se `turno` chega preenchido na tool de período;
  - identificar o ponto exato onde a conversa quebra.

3. Corrigir a camada de tools
- Ajustar `buscar_agenda` e `buscar_agenda_por_periodo` para eliminar falsos negativos:
  - normalização de acentos e caixa;
  - fallback mais robusto para nome de especialidade;
  - retorno mais útil quando não houver match exato.
- Garantir que todas as tools usem schema compatível com preenchimento pela IA.
- Revisar `confirmar_agendamento` para garantir que só faça `PATCH` no slot existente `disponivel`.

4. Atualizar o `systemMessage` da Sofia
- Incluir passo explícito e obrigatório:
  - sempre chamar `listar_especialidades` antes de qualquer `buscar_agenda`;
  - só oferecer especialidades retornadas pela tool;
  - usar `buscar_agenda_por_periodo` apenas quando houver preferência de turno;
  - nunca afirmar indisponibilidade sem consultar tool.
- Manter o prompt alinhado ao fluxo real do banco e sem ambiguidades.

5. Gerar uma nova versão importável
- Criar `Atendimento_-_Clinica_Medica_IA_First_v5.json`.
- Essa versão vai refletir o workflow corrigido de verdade, não só ajustes parciais no v4.
- Preservar os comportamentos já esperados:
  - handoff humano;
  - feedback;
  - memória por janela;
  - cron nodes.

6. Validar ponta a ponta
- Rodar novamente os testes via MCP após a correção.
- Critérios de aceite:
  - a Sofia encontra horários para especialidades com slots futuros;
  - o turno filtra corretamente;
  - o slot confirmado deixa de aparecer nas buscas;
  - o fluxo de conversa não inventa especialidades.

Entregas
- 1 novo JSON corrigido: `Atendimento_-_Clinica_Medica_IA_First_v5.json`
- relatório curto do erro raiz encontrado em cada ponto crítico
- checklist de importação e validação no n8n

Detalhes técnicos
- Vou tratar isso como problema de workflow ativo, não de frontend.
- A prioridade é comparar o workflow ativo com o comportamento esperado dos docs e do banco.
- Se eu encontrar divergência entre o ativo e o v4, o v5 será gerado a partir do workflow auditado e corrigido.
- Se o MCP não permitir editar diretamente a estrutura, faço a correção no JSON importável e valido por execução controlada.

Resultado esperado
```text
Paciente: "quero pediatria"
Sofia:
1. chama listar_especialidades
2. valida que pediatria existe
3. chama buscar_agenda com especialidade preenchida
4. retorna horários reais

Paciente: "prefiro de tarde"
Sofia:
1. chama buscar_agenda_por_periodo com especialidade + turno
2. filtra horários válidos
3. oferece opções reais
```
