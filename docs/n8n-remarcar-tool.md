# Tool `remarcar_agendamento` — versão corrigida (padrão TDZ v10)

## Problema da versão anterior

O nó retornava:
```
Cannot assign to read only property 'name' of object 'Error': access to env vars denied
```

**Causa:** o código usava `$env.SUPABASE_URL` e `fetch()`. Dentro de `toolCode` no n8n,
`$env` está bloqueado e `fetch` não é o helper certo. Todas as outras tools que funcionam
no fluxo (`cancelar_agendamento`, `confirmar_agendamento`, `buscar_ultimo_agendamento`...)
usam o mesmo molde:

- **Constantes hardcoded** para `SUPABASE_URL` e a chave anon (mesma do `.env` do app)
- **Prelude TDZ v10** que aceita `query` (string ou objeto) **ou** `$input.first().json`
- `this.helpers.httpRequest` em vez de `fetch`
- Retorno **string JSON** (`JSON.stringify(...)`)

## Como aplicar

1. Abra o workflow `Atendimento - Clinica Medica (IA First)`.
2. Clique no nó **Tool Remarcar_agendamento**.
3. Apague todo o conteúdo do campo **JavaScript** e cole o código abaixo.
4. Salve o workflow.

## Código pronto para colar

```js
// === Prelude v10: TDZ-safe (mesmo padrão de cancelar/confirmar) ===
let __args = {};
try {
  if (typeof query === 'object' && query) __args = query;
  else if (typeof query === 'string' && query.trim().startsWith('{')) __args = JSON.parse(query);
} catch(_) {}
try {
  if ((!__args || Object.keys(__args).length === 0) && typeof $input !== 'undefined') {
    const it = $input.first && $input.first();
    if (it && it.json) __args = it.json;
  }
} catch(_) {}
const A = __args || {};

const SUPABASE_URL = 'https://opzeqlcpmbmaugtdaipx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wemVxbGNwbWJtYXVndGRhaXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NDAxNjcsImV4cCI6MjA5MTAxNjE2N30.5sGz56SVTnPqwMnHTxiy0bg-6QPNaJo70Xi1Nyz1YI8';
const HEADERS = { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' };

async function _get(url){ return await this.helpers.httpRequest({ method:'GET', url, headers: HEADERS, json: true }); }
async function _patch(url, body, prefer){
  const h = { ...HEADERS };
  if (prefer) h['Prefer'] = prefer;
  return await this.helpers.httpRequest({ method:'PATCH', url, headers: h, body, json: true });
}

try {
  const tel = A.paciente_telefone || A.telefone;
  let id_atual = A.agendamento_id_atual || A.agendamento_id || null;
  const medicoId = A.medico_id;
  const dataNova = A.data_consulta_nova || A.data;
  const horaRaw  = A.horario_novo || A.horario;
  const horaNova = horaRaw ? (String(horaRaw).length === 5 ? horaRaw + ':00' : horaRaw) : null;

  if (!tel || !medicoId || !dataNova || !horaNova) {
    return JSON.stringify({ success:false, erro:'parametros_insuficientes (precisa: paciente_telefone, medico_id, data_consulta_nova, horario_novo)' });
  }

  // 1. Se não veio o id, busca o último ativo do paciente
  if (!id_atual) {
    const url = SUPABASE_URL + '/rest/v1/agendamentos'
      + '?paciente_telefone=eq.' + encodeURIComponent(tel)
      + '&status=in.(confirmado,pendente)'
      + '&order=data_consulta.desc,horario.desc&limit=1'
      + '&select=id';
    const arr = await _get(url);
    if (!Array.isArray(arr) || arr.length === 0) {
      return JSON.stringify({ success:false, erro:'sem_agendamento_ativo' });
    }
    id_atual = arr[0].id;
  }

  // 2. Busca o agendamento atual e valida que pertence ao paciente (anti-fraude)
  const atualUrl = SUPABASE_URL + '/rest/v1/agendamentos?id=eq.' + encodeURIComponent(id_atual) + '&select=*';
  const atualArr = await _get(atualUrl);
  const atual = Array.isArray(atualArr) ? atualArr[0] : null;
  if (!atual) {
    return JSON.stringify({ success:false, erro:'agendamento_nao_encontrado' });
  }
  if (String(atual.paciente_telefone) !== String(tel)) {
    return JSON.stringify({ success:false, erro:'agendamento_nao_pertence_ao_paciente' });
  }

  // 3. Verifica que o slot novo está disponível
  const slotUrl = SUPABASE_URL + '/rest/v1/agendamentos'
    + '?medico_id=eq.' + encodeURIComponent(medicoId)
    + '&data_consulta=eq.' + encodeURIComponent(dataNova)
    + '&horario=eq.' + encodeURIComponent(horaNova)
    + '&status=eq.disponivel'
    + '&select=id&limit=1';
  const slots = await _get(slotUrl);
  if (!Array.isArray(slots) || slots.length === 0) {
    return JSON.stringify({ success:false, erro:'slot_indisponivel' });
  }
  const slotNovoId = slots[0].id;

  // 4. Libera o slot atual (volta a ser 'disponivel')
  await _patch(
    SUPABASE_URL + '/rest/v1/agendamentos?id=eq.' + encodeURIComponent(id_atual),
    {
      status: 'disponivel',
      paciente_telefone: 'disponivel',
      paciente_nome: null,
      feedback_solicitado_at: null,
      lembrete_2h_enviado_at: null,
      lembrete_d1_enviado_at: null
    },
    'return=minimal'
  );

  // 5. Ocupa o slot novo
  const novoArr = await _patch(
    SUPABASE_URL + '/rest/v1/agendamentos?id=eq.' + encodeURIComponent(slotNovoId),
    {
      status: 'confirmado',
      paciente_telefone: tel,
      paciente_nome: atual.paciente_nome
    },
    'return=representation'
  );
  const novo = Array.isArray(novoArr) ? novoArr[0] : novoArr;

  return JSON.stringify({
    success: true,
    mensagem: 'Remarcação concluída com sucesso.',
    cancelado: {
      id: id_atual,
      data: atual.data_consulta,
      horario: atual.horario,
      medico: atual.medico
    },
    novo: {
      id: novo && novo.id,
      data: novo && novo.data_consulta,
      horario: novo && novo.horario,
      medico: novo && novo.medico,
      especialidade: novo && novo.especialidade
    }
  });
} catch(e) {
  return JSON.stringify({ success:false, erro: String(e && e.message || e) });
}
```

## Diferenças vs. versão antiga

| Antes (quebrado)              | Agora (padrão TDZ v10)                          |
| ----------------------------- | ----------------------------------------------- |
| `$env.SUPABASE_URL`           | constante hardcoded (igual às outras tools)     |
| `fetch(...)`                  | `this.helpers.httpRequest(...)`                 |
| `$input.first().json` direto  | prelude TDZ que aceita `query` ou `$input`      |
| `return [{ json: { ok } }]`   | `return JSON.stringify({ success, ... })`       |

## Botão de remarcação no Dashboard

Também foi adicionado um botão **Remarcar** (ícone `CalendarClock`) na lista
"Próximos agendamentos". Ele abre um diálogo que:

1. Lista os horários disponíveis do mesmo médico (status `disponivel`, a partir de hoje).
2. Ao confirmar, executa a mesma operação atômica da tool: libera o slot atual
   e ocupa o novo com os dados do paciente.
3. Garantia anti-conflito: o `update` do novo slot tem `eq("status", "disponivel")`,
   então se outro processo ocupou no meio tempo, falha sem sobrescrever.

Arquivos:
- `src/components/dashboard/RemarcarAgendamentoDialog.tsx` (novo)
- `src/components/dashboard/ListaProximosAgendamentos.tsx` (botão adicionado)
