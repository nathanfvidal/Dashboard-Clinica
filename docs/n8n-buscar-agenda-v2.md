# Buscar Agenda v2 — Filtros + Resposta Agrupada

Mudança de comportamento: a Sofia **sempre pergunta** preferência de turno
e dia da semana antes de chamar `buscar_agenda`. A tool agora aceita
filtros opcionais (turno / dia_semana / medico_id), busca em janela de
**15 dias**, retorna até **300 slots** e devolve o resultado **agrupado
por dia** (no máximo 6 horários por dia/médico).

A tool legada `buscar_agenda_por_periodo` fica deprecada — não precisa
existir, a nova `buscar_agenda` faz o que ela fazia e mais.

---

## 1. Atualizar o nó `Tool Buscar Agenda` no n8n

Abra o workflow **Atendimento - Clinica Medica (IA First)**, clique no
nó **Tool Buscar Agenda** e substitua:

### 1.1. Description (campo "Description" da tool)

```
Busca horários disponíveis nos próximos 15 dias para uma especialidade,
agrupando por dia. Aceita filtros opcionais de turno, dia da semana e
médico. SEMPRE pergunte preferência ao paciente antes de chamar.

Parâmetros:
- especialidade (string, obrigatório): nome exato vindo de listar_especialidades
- turno (string, opcional): "manha" | "tarde" | "noite" | "qualquer"
- dia_semana (string, opcional): "segunda","terca","quarta","quinta","sexta",
  "sabado","domingo" — aceita lista separada por vírgula (ex: "terca,quinta")
  ou número 0-6 (0=domingo). Vazio = todos os dias.
- medico_id (string uuid, opcional): filtra um médico específico.
  Use na remarcação (mesmo médico do agendamento atual).

Retorno: JSON com { success, total, dias: [{data, data_br, dia_semana,
medico, horarios:[...], mais:N}] }. Cada dia traz no máximo 6 horários
do mesmo médico (resto fica indicado em "mais").
```

### 1.2. JS Code (campo "JS Code")

Cole **na íntegra** no lugar do código atual. Mesmo padrão TDZ v10 que já
roda nas outras tools (sem `fetch`, sem `$env`, usa
`this.helpers.httpRequest`).

```javascript
// === Tool Buscar Agenda v2 — Prelude TDZ + filtros + agrupado ===
let __args = {};
try {
  if (typeof query === 'object' && query) __args = query;
  else if (typeof query === 'string' && query.trim().startsWith('{')) __args = JSON.parse(query);
} catch (_) {}
try {
  if ((!__args || Object.keys(__args).length === 0) && typeof $input !== 'undefined') {
    const it = $input.first && $input.first();
    if (it && it.json) __args = it.json;
  }
} catch (_) {}
const A = __args || {};

const SUPABASE_URL = 'https://opzeqlcpmbmaugtdaipx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wemVxbGNwbWJtYXVndGRhaXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NDAxNjcsImV4cCI6MjA5MTAxNjE2N30.5sGz56SVTnPqwMnHTxiy0bg-6QPNaJo70Xi1Nyz1YI8';
const HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: 'Bearer ' + SUPABASE_KEY,
  'Content-Type': 'application/json',
};

async function _get(url) {
  return await this.helpers.httpRequest({ method: 'GET', url, headers: HEADERS, json: true });
}

// Mapeia dia_semana string -> número Postgres (0=domingo .. 6=sábado)
function _normDiaSemana(input) {
  if (input === null || input === undefined || input === '') return null;
  const map = {
    domingo: 0, dom: 0,
    segunda: 1, seg: 1, 'segunda-feira': 1,
    terca: 2, terça: 2, ter: 2, 'terca-feira': 2, 'terça-feira': 2,
    quarta: 3, qua: 3, 'quarta-feira': 3,
    quinta: 4, qui: 4, 'quinta-feira': 4,
    sexta: 5, sex: 5, 'sexta-feira': 5,
    sabado: 6, sábado: 6, sab: 6, 'sabado-feira': 6,
  };
  const arr = String(input).toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
  const nums = [];
  for (const x of arr) {
    const n = Number(x);
    if (!Number.isNaN(n) && n >= 0 && n <= 6) { nums.push(n); continue; }
    if (map[x] !== undefined) { nums.push(map[x]); continue; }
  }
  return nums.length ? Array.from(new Set(nums)) : null;
}

function _diaPt(n) {
  return ['domingo','segunda','terça','quarta','quinta','sexta','sábado'][n] || '';
}

function _turnoDeHora(hhmm) {
  const h = parseInt(String(hhmm).slice(0, 2), 10);
  if (h < 12) return 'manha';
  if (h < 18) return 'tarde';
  return 'noite';
}

try {
  const especialidade = (A.especialidade || '').trim();
  const turno = (A.turno || 'qualquer').toLowerCase();
  const diasFiltro = _normDiaSemana(A.dia_semana);
  const medicoId = A.medico_id || null;

  if (!especialidade) {
    return JSON.stringify({ success: false, erro: 'especialidade obrigatoria' });
  }

  // Janela: hoje .. hoje+15
  const hoje = new Date();
  const fim = new Date(hoje.getTime() + 15 * 24 * 60 * 60 * 1000);
  const dHoje = hoje.toISOString().slice(0, 10);
  const dFim = fim.toISOString().slice(0, 10);

  // Query base — RLS pública permite SELECT direto
  let url = SUPABASE_URL + '/rest/v1/agendamentos'
    + '?select=id,data_consulta,horario,medico,medico_id,especialidade'
    + '&status=eq.disponivel'
    + '&especialidade=ilike.' + encodeURIComponent(especialidade)
    + '&data_consulta=gte.' + dHoje
    + '&data_consulta=lte.' + dFim
    + '&order=data_consulta.asc,horario.asc'
    + '&limit=300';
  if (medicoId) url += '&medico_id=eq.' + encodeURIComponent(medicoId);

  const rows = await _get(url);

  // Filtra turno e dia_semana em memória (mais flexível que SQL aqui)
  const filtrados = (rows || []).filter(r => {
    if (turno !== 'qualquer' && _turnoDeHora(r.horario) !== turno) return false;
    if (diasFiltro) {
      const d = new Date(r.data_consulta + 'T12:00:00');
      if (!diasFiltro.includes(d.getUTCDay())) return false;
    }
    return true;
  });

  // Agrupa por (data + medico) — IMPORTANTE: cada slot leva o id do registro
  // pra confirmar_agendamento conseguir fazer o UPDATE depois
  const grupos = new Map();
  for (const r of filtrados) {
    const key = r.data_consulta + '|' + (r.medico_id || r.medico);
    if (!grupos.has(key)) {
      const d = new Date(r.data_consulta + 'T12:00:00');
      grupos.set(key, {
        data: r.data_consulta,
        data_br: r.data_consulta.slice(8, 10) + '/' + r.data_consulta.slice(5, 7),
        dia_semana: _diaPt(d.getUTCDay()),
        medico: r.medico,
        medico_id: r.medico_id,
        _all: [],
      });
    }
    grupos.get(key)._all.push({ id: r.id, hora: r.horario.slice(0, 5) });
  }

  // Limita a 6 horários por grupo
  const dias = Array.from(grupos.values()).map(g => {
    const all = g._all;
    const top = all.slice(0, 6);
    return {
      data: g.data,
      data_br: g.data_br,
      dia_semana: g.dia_semana,
      medico: g.medico,
      medico_id: g.medico_id,
      // Lista crua de horas pra Sofia exibir bonito
      horarios: top.map(s => s.hora),
      // Mapa hora -> id pra Sofia conseguir passar o id em confirmar_agendamento
      slots: top, // [{ id, hora }]
      mais: Math.max(0, all.length - 6),
    };
  });

  return JSON.stringify({
    success: true,
    especialidade,
    filtros: {
      turno: turno === 'qualquer' ? null : turno,
      dia_semana: A.dia_semana || null,
      medico_id: medicoId,
    },
    janela: { de: dHoje, ate: dFim },
    total: filtrados.length,
    dias,
  });
} catch (e) {
  return JSON.stringify({ success: false, erro: String((e && e.message) || e) });
}
```

### 1.3. Marcar `Tool Buscar Agenda por Periodo` como deprecada

No nó **Tool Buscar Agenda por Periodo**, no campo Description, adicionar
no topo:

```
[DEPRECADA — não use. Use buscar_agenda com parâmetros turno e dia_semana.]
```

Não precisa apagar (manter histórico).

---

## 2. Atualizar o system prompt da Sofia

No nó **AI Agent Sofia**, campo `systemMessage`, **substituir o bloco
FLUXO DE AGENDAMENTO inteiro** por:

```
FLUXO DE AGENDAMENTO
1. Entenda o pedido.
2. Chame listar_especialidades.
3. Ajude o paciente a escolher uma especialidade válida.
4. ANTES de chamar buscar_agenda, SEMPRE pergunte:
   "Tem preferência de turno (manhã ou tarde) ou de algum dia da
    semana (ex.: terça, quinta)? Se for indiferente, é só dizer."
5. Quando ele responder:
   - Com preferência → buscar_agenda(especialidade, turno, dia_semana).
   - Sem preferência ("tanto faz","qualquer","indiferente")
     → buscar_agenda(especialidade) sem filtro.
6. A tool retorna agrupado por dia. Mostre no formato:
   📅 Terça 22/04 — Dr. Carlos
      14:00, 14:30, 15:00, 15:30
   📅 Quinta 24/04 — Dr. Carlos
      09:00, 09:30
   Limite a 4 dias por mensagem. Se "total" for alto e o paciente
   ainda não filtrou, ofereça: "Se preferir um dia ou turno
   específico, me avisa que filtro pra você."
7. Quando o paciente escolher um horário, ache o slot correspondente
   no array `slots` do dia (formato `[{id, hora}]`) e chame
   `confirmar_agendamento` passando o **id** do slot escolhido +
   `paciente_telefone` (do contexto) + `paciente_nome`. NUNCA chame
   confirmar_agendamento sem id — se o id não estiver no retorno da
   buscar_agenda, peça desculpa, chame buscar_agenda de novo e tente
   outra vez. Não escale pra humano por causa disso.
8. Se faltar nome, peça antes e salve com salvar_paciente.
```

E o bloco **REMARCAÇÃO** vira:

```
REMARCAÇÃO
1. Confirme qual consulta o paciente quer remarcar
   (use buscar_ultimo_agendamento se necessário).
2. Pergunte preferência de turno e dia da semana, igual no agendamento.
3. Chame buscar_agenda(especialidade, turno, dia_semana, medico_id)
   passando o medico_id da consulta atual.
4. Apresente as opções e, ao escolher, chame remarcar_agendamento com:
   - paciente_telefone (sempre do contexto)
   - agendamento_id_atual
   - medico_id, data_consulta_nova, horario_novo
5. Confirme em texto curto com a nova data/hora/médico.
NUNCA caia em criar_solicitacao tipo=remarcacao a menos que
remarcar_agendamento dê erro persistente.
```

---

## 3. Teste de fogo v16 — estado ANTES da atualização

Os 3 cenários abaixo foram executados via MCP **com o workflow ainda
na versão antiga** (sem o filtro novo, sem a regra de perguntar
primeiro). Servem como baseline pra comparar depois que você colar o
código acima.

### Cenário 1 — "queria marcar cardiologista" (sem dar nenhuma preferência)

- **Telefone:** 5511988887777
- **Resposta da Sofia (atual):**
  > Olá! Claro, vamos agendar sua consulta. Primeiro, preciso confirmar
  > as especialidades que temos. Vou verificar e já te mostro.
- **Tools chamadas:** `listar_especialidades` → `buscar_agenda` (sem
  perguntar preferência primeiro).
- **Veredito:** ❌ FALHA esperada da v1 — Sofia já busca direto sem
  perguntar turno/dia. Esse cenário só vai virar "PASS" depois que o
  prompt novo entrar.

### Cenário 2 — "queria marcar cardiologista, prefiro terça de tarde"

- **Telefone:** 5511988887778
- **Resposta da Sofia (atual):**
  > Olá! Claro, vamos agendar sua consulta. Para confirmar,
  > "Cardiologia" é a especialidade que você busca, certo? Vou
  > verificar os horários de cardiologia para terças à tarde.
- **Tools chamadas:** `listar_especialidades` → `buscar_agenda_por_periodo`
  (a tool antiga, sem filtro real de dia_semana).
- **Veredito:** ⚠️ Parcial — Sofia entendeu o pedido, mas a tool antiga
  não filtra por dia da semana. Com o código novo da `buscar_agenda`
  ela vai conseguir aplicar `turno=tarde` + `dia_semana=terca` direto
  e devolver só terças à tarde dos próximos 15 dias.

### Cenário 3 — "queria marcar cardiologista, tanto faz horario"

- **Telefone:** 5511988887779
- **Resposta da Sofia (atual):** (tool calls em sequência, sem
  texto humano antes)
- **Tools chamadas:** `listar_especialidades` → `buscar_agenda`.
- **Veredito:** ❌ Mesmo problema da v1 — busca lista crua de até 20
  slots, mostra só o primeiro dia disponível. Com a tool nova vai
  voltar agrupado por dia, com até 6 horários por médico/dia, dentro
  de 15 dias, e a Sofia vai poder mostrar até 4 dias na mesma
  mensagem.

---

## 4. Como validar depois de aplicar

Depois de colar o JS Code e atualizar o prompt no n8n, rode novamente
os 3 cenários acima (mesmos textos, mesmos telefones-fake). Esperado:

| # | Texto                                  | Comportamento esperado                                                       |
| - | -------------------------------------- | ---------------------------------------------------------------------------- |
| 1 | "queria marcar cardiologista"          | Sofia pergunta preferência **antes** de chamar `buscar_agenda`               |
| 2 | "prefiro terça de tarde"               | Sofia chama `buscar_agenda(turno=tarde, dia_semana=terca)`, mostra só terças |
| 3 | "tanto faz"                            | Sofia chama `buscar_agenda` sem filtro, mostra agrupado por dia (até 4 dias) |

Se algum falhar, conferir:
1. Se a Description da tool foi atualizada (a Sofia escolhe tool pelo texto da description).
2. Se o `systemMessage` recebeu o bloco novo.
3. Se há slots `status=disponivel` cadastrados pra Cardiologia nos
   próximos 15 dias (rodar Gerar Agenda em Cadastros → Médicos se vazio).
