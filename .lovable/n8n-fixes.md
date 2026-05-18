# Ajustes manuais no n8n — workflow "Atendimento - Clinica Medica (IA First)"

> Eu não consigo editar o workflow via MCP (só leio/executo). Cole o conteúdo abaixo nos nós indicados.
> Link: https://n8n.nateksoft.com/workflow/eqqEnl042R9NZN_UWToot

---

## 1. P0 — Tool Cancelar_agendamento quebrada + vazamento de trace

### 1a. Nó `Tool Cancelar_agendamento` (HTTP Request Tool)

- **Method:** `PATCH`
- **URL:** `={{ $env.SUPABASE_URL }}/rest/v1/agendamentos?id=eq.{{ $fromAI('id', 'UUID do agendamento a cancelar', 'string') }}`
- **Authentication:** Header Auth (apikey + Authorization Bearer com SERVICE_ROLE_KEY)
- **Headers adicionais:**
  - `Content-Type: application/json`
  - `Prefer: return=representation`
- **Body (JSON):**
  ```json
  {
    "status": "cancelado",
    "paciente_telefone": "disponivel",
    "paciente_nome": null
  }
  ```
- **Tool Description:** `Cancela um agendamento existente. Recebe o ID (uuid) do agendamento e marca status='cancelado', liberando o slot.`

### 1b. Nó `AI Agent Sofia` → Options

- `Return Intermediate Steps`: **false** (impede que o LangChain trace seja enviado pro paciente)
- `Pass Through Tool Errors`: **false**
- Se houver campo `Verbose`, deixar **false**

---

## 2. P1/P2 — systemMessage do AI Agent Sofia

Substituir/garantir os blocos abaixo no prompt:

```
## Contexto temporal
Hora atual (São Paulo): {{ $now.setZone('America/Sao_Paulo').toFormat('HH:mm') }}
Dia: {{ $now.setZone('America/Sao_Paulo').toFormat('cccc, dd/MM/yyyy') }}
Saudação automática:
  - 00:00–11:59 → "Bom dia"
  - 12:00–17:59 → "Boa tarde"
  - 18:00–23:59 → "Boa noite"
SEMPRE usar a saudação correta. Nunca diga "boa tarde" às 02h.

## Identificação do paciente
Se o paciente JÁ existe no Supabase (Tool Buscar Paciente retornou registro), NÃO peça nome nem confirme número.
Cumprimente pelo primeiro nome e siga direto para o menu/intenção.
Só pergunte o nome e confirme número na PRIMEIRA interação (paciente inexistente).

## Fluxo REMARCAR
1. Chamar Tool Buscar Ultimo Agendamento (telefone do paciente, status='confirmado').
2. Listar os agendamentos ativos encontrados, numerados:
   "Você tem estas consultas marcadas:
    1. Cardiologia com Dr. X — 20/05 às 14:00
    2. ..."
3. Pedir para o paciente escolher qual remarcar (NUNCA pergunte 'para você ou para outra pessoa').
4. Mostrar slots disponíveis do mesmo médico (Tool Buscar Agenda).
5. Confirmar e chamar Tool Remarcar_agendamento com {id_antigo, id_novo}.

## Fluxo CANCELAR
1. Tool Buscar Ultimo Agendamento → lista ativos numerados.
2. Paciente escolhe número.
3. Confirma "Tem certeza que deseja cancelar [especialidade] em [data] às [hora]?"
4. Chama Tool Cancelar_agendamento com {id}.
5. Confirma o cancelamento ao paciente em UMA mensagem curta. Nunca mostre IDs, payloads ou "Calling Tool...".
```

---

## 3. P2 — Tool Remarcar_agendamento (já existe — atualizar para RPC)

A migration de hoje criou a função `remarcar_agendamento(p_antigo uuid, p_novo uuid)` no Supabase, que preserva histórico (status='remarcado' no slot antigo).

Atualizar o nó `Tool Remarcar_agendamento`:

- **Method:** `POST`
- **URL:** `={{ $env.SUPABASE_URL }}/rest/v1/rpc/remarcar_agendamento`
- **Headers:** apikey + Authorization Bearer SERVICE_ROLE_KEY + `Content-Type: application/json`
- **Body (JSON):**
  ```json
  {
    "p_antigo": "{{ $fromAI('id_antigo', 'UUID do agendamento atual', 'string') }}",
    "p_novo":   "{{ $fromAI('id_novo',   'UUID do novo slot disponível', 'string') }}"
  }
  ```
- **Tool Description:** `Remarca um agendamento: marca o slot antigo como remarcado (histórico), libera-o e ocupa o novo slot escolhido pelo paciente.`

---

## Checklist pós-ajuste

- [ ] Salvar workflow no n8n
- [ ] Avisar que aplicou para eu rodar o teste de fogo nos cenários 3, 4, 5, 6, 7
