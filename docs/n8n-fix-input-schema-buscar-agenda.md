# Fix urgente — Tool Buscar Agenda ignora turno e dia_semana

## Diagnóstico via MCP

Rodei dois testes pelo MCP do n8n simulando o paciente:

### Teste 1
- Mensagem: "queria agendar cardiologia"
- Sofia perguntou turno/dia ✅ (não chamou tool)

### Teste 2
- Mensagem: "à tarde, tanto faz o dia"
- Sofia chamou `Tool Buscar Agenda` com input
  `{ "especialidade": "Cardiologia", "turno": "tarde" }` ✅
- Mas a tool devolveu **só horários da manhã**:
  `{ "filtros": { "turno": null, ... }, "dias": [{ "horarios":
  ["08:30","09:00","09:30",...] }] }` ❌

A Sofia respondeu honestamente:
> "Não encontrei horários para Cardiologia à tarde com o Dr. Carlos
>  Silva. Os próximos horários disponíveis pela manhã são: ..."

Mas o banco tem **132 slots de tarde** pra Cardiologia nos próximos
15 dias. O problema NÃO é o JS Code — é que o `turno` nem chega no JS.

## Causa raiz

No nó **Tool Buscar Agenda** (`@n8n/n8n-nodes-langchain.toolCode`,
typeVersion 1.3) o campo **`jsonSchemaExample`** está com:

```json
{ "especialidade": "Ginecologia" }
```

O LangChain n8n usa esse exemplo pra **inferir o schema JSON** que ele
expõe pro modelo LLM. Como o exemplo só tem 1 campo (`especialidade`),
o schema inferido aceita só 1 campo. Quando a Sofia manda
`{ especialidade, turno, dia_semana }`, o LangChain **descarta `turno`
e `dia_semana`** antes de invocar a função, porque eles não fazem parte
do schema declarado. O `jsCode` recebe apenas `{ especialidade }` e
cai no default `turno = 'qualquer'`.

Por isso:
- O retorno tem `filtros.turno: null`
- A query SQL não filtra nada
- Os primeiros 300 slots ordenados por data+hora são todos da manhã
  (08:00–11:30), porque cada dia tem 20 slots e 300/20 ≈ 15 dias
- Resultado pro paciente: "não tem tarde"

## Correção

No editor do n8n:

1. Abrir o nó **Tool Buscar Agenda**
2. Na aba **Parameters**, achar o campo **JSON Example** (label visível
   acima do textarea, internamente é `jsonSchemaExample`)
3. Substituir o conteúdo atual:
   ```json
   { "especialidade": "Ginecologia" }
   ```
4. Por este, que cobre todos os parâmetros da v2:
   ```json
   {
     "especialidade": "Cardiologia",
     "turno": "tarde",
     "dia_semana": "terca",
     "medico_id": ""
   }
   ```
5. Salvar o workflow.

Pronto. Agora o LangChain vai expor as 4 propriedades pro Gemini, e os
filtros vão chegar corretamente no `jsCode`.

## Como validar

Depois de salvar, mandar pelo MCP (ou pelo WhatsApp real):

1. "queria agendar cardiologia"
2. "à tarde, tanto faz o dia"

Esperado no retorno da tool (visível na execução do n8n):
```json
{
  "filtros": { "turno": "tarde", "dia_semana": null, "medico_id": null },
  "total": 132,
  "dias": [
    { "data_br": "20/04", "horarios": ["13:30","14:00","14:30",...] },
    ...
  ]
}
```

E a Sofia deve listar horários como:
```
📅 Segunda 20/04 — Dr. Carlos Silva
   13:30, 14:00, 14:30, 15:00, 15:30, 16:00
📅 Terça 21/04 — Dr. Carlos Silva
   12:30, 13:00, 13:30, 14:00, 14:30, 15:00
```

## Bônus: aplicar o mesmo fix em outras tools com filtros

Se alguma outra tool no workflow também usa `specifyInputSchema=true`
com `jsonSchemaExample` incompleto, o mesmo problema acontece. Conferir
em especial:

- **Tool Buscar Ultimo Agendamento** — se aceitar filtros, garantir
  que o exemplo inclui todos os campos.
- **Tool Confirmar Agendamento** — exemplo deve ter
  `{ id, paciente_telefone, paciente_nome }` no mínimo.
- **Tool Cancelar_agendamento** — exemplo deve ter todos os campos
  alternativos (`id` OU `telefone+data+horario`).
- **Tool Remarcar_agendamento** — exemplo deve incluir
  `agendamento_id_atual`, `medico_id`, `data_consulta_nova`,
  `horario_novo`.

Regra geral: o `jsonSchemaExample` precisa ter **todas as chaves** que
você quer que o LLM consiga passar, mesmo as opcionais.
