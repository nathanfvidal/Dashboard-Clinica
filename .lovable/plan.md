
## Objetivo
Auditar o workflow `Atendimento - Clinica Medica (IA First)` via MCP, conferir cada tool contra os docs das Sprints 1/2/3 e gerar um **JSON corrigido e reimportável** focando no problema da `buscar_agenda`.

## Diagnóstico já confirmado
- O workflow no MCP está ativo e contém as tools esperadas.
- O problema mais provável da `Tool Buscar Agenda` / `Tool Buscar Agenda por Periodo` **não é banco vazio**; é a configuração da tool no n8n/JSON:
  - o print anterior mostrou `No parameters are set up to be filled by AI`;
  - isso é compatível com tool executando sem `especialidade`/`turno`.
- Há divergências ainda abertas entre o workflow aplicado e os docs:
  1. `Tool Registrar Feedback` com `inputSchema` pendente.
  2. `AI Agent Sofia` ainda com prompt antigo.
  3. `Extrair Dados da Mensagem` ainda com placeholder da Groq key.
- O JSON do workflow importável não está no repositório; então a correção precisa ser feita no **arquivo de import** entregue ao usuário, não no código React.

## O que vou fazer na implementação
1. **Ler o workflow real via MCP node por node**
   - comparar `description`, `inputSchema`, `jsCode`, conexões e nomes das 9 tools:
     `buscar_paciente`, `salvar_paciente`, `buscar_agenda`, `buscar_agenda_por_periodo`, `listar_especialidades`, `confirmar_agendamento`, `registrar_feedback`, `criar_solicitacao`, `transferir_humano`.

2. **Corrigir o JSON importável do workflow**
   - gerar uma nova versão, sem sobrescrever a anterior:
     `Atendimento_-_Clinica_Medica_IA_First_v3.json`.
   - ajustar especialmente:
     - `Tool Buscar Agenda` com `inputSchema` válido para `especialidade`;
     - `Tool Buscar Agenda por Periodo` com `inputSchema` válido para `especialidade` + `turno`;
     - `Tool Registrar Feedback` com schema correto;
     - conferir se as tools estão marcadas de forma que a IA realmente consiga preencher os parâmetros no n8n importado.

3. **Endurecer a lógica de agenda**
   - manter a busca por `especialidades` ativas;
   - revisar o `jsCode` da `buscar_agenda` e `buscar_agenda_por_periodo` para evitar falso negativo por nome mal normalizado;
   - revisar `confirmar_agendamento` para casar corretamente com o slot disponível já gerado.

4. **Alinhar o agente com as tools**
   - revisar o `systemMessage` do `AI Agent Sofia` para garantir que ele:
     - use `listar_especialidades` antes de oferecer opções;
     - use `buscar_agenda` / `buscar_agenda_por_periodo` corretamente;
     - não cite ferramenta antiga;
     - siga o fluxo de confirmação e feedback.
   - Se você quiser manter emojis no prompt, eu preservo isso e corrijo só a parte funcional.

5. **Validar o JSON antes de te entregar**
   - revisar estrutura do workflow para import no n8n;
   - validar no MCP por execução controlada, simulando:
     - `quero dermatologia`
     - `prefiro de tarde`
     - confirmação de horário
   - confirmar que a falha “não encontrou horário” deixa de acontecer quando existem slots no banco.

## Entrega
- 1 arquivo novo:
  - `Atendimento_-_Clinica_Medica_IA_First_v3.json`
- sem apagar o v2, para você ter rollback.

## Validação que vou rodar
```text
1. Importar v3
2. Executar fluxo com especialidade válida
3. Verificar se a tool recebe `especialidade`
4. Executar fluxo com preferência de turno
5. Verificar se a tool recebe `turno`
6. Confirmar que horários reais são retornados
7. Testar ponta a ponta no n8n/MCP
```

## Detalhes técnicos
- Como o MCP atual é essencialmente leitura/execução, o caminho correto é **corrigir o JSON de importação** e depois reimportar.
- O principal ajuste esperado é na representação do node `@n8n/n8n-nodes-langchain.toolCode`, porque o bug parece estar no schema/param binding da tool, não apenas no `jsCode`.
- Também vou conferir se o workflow importado preserva:
  - `sessionKey` por janela de 6h;
  - admin handoff `5583999915242`;
  - tools conectadas no `ai_tool`;
  - cron nodes intactos.
