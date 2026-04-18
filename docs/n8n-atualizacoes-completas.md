# n8n — Atualizações completas do fluxo Sofia (IA First)

Workflow alvo: **Atendimento - Clinica Medica (IA First)**
URL: https://n8n.nateksoft.com/workflow/eqqEnl042R9NZN_UWToot
ID: `eqqEnl042R9NZN_UWToot`

> Este documento substitui `n8n-integracao-cadastros.md` e
> `n8n-tool-registrar-feedback.md`. Aplicar manualmente no editor do n8n
> (a edição via MCP não é suportada — apenas leitura/execução).

---

## 0. Visão geral

Foram identificadas **6 lacunas** entre o app `/cadastros` + banco Supabase
e o que o fluxo da Sofia faz hoje. As mudanças abaixo eliminam todas elas.

### Ordem recomendada de aplicação

1. Tool **Listar Especialidades** — base para o resto
2. Tool **Buscar Agenda**
3. Tool **Buscar Agenda por Periodo**
4. Tool **Confirmar Agendamento** (mudança de INSERT → UPDATE)
5. Criar tool **Registrar Feedback**
6. Reescrever **system prompt do AI Agent Sofia** (sem emojis, sem lista fixa)
7. Salvar e ativar o workflow
8. Rodar checklist da seção 7

### Constantes usadas em todas as tools

```js
const SUPABASE_URL = 'https://opzeqlcpmbmaugtdaipx.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wemVxbGNwbWJtYXVndGRhaXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NDAxNjcsImV4cCI6MjA5MTAxNjE2N30.5sGz56SVTnPqwMnHTxiy0bg-6QPNaJo70Xi1Nyz1YI8';
const HEADERS = {
  'apikey': ANON,
  'Authorization': 'Bearer ' + ANON,
  'Content-Type': 'application/json'
};
```

> Nunca usar `service_role` aqui. RLS já libera leitura/escrita pública nas
> tabelas envolvidas.

---

## 1. Tool `Listar Especialidades`

**Onde:** node `Tool Listar Especialidades` (tipo `@n8n/n8n-nodes-langchain.toolCode`),
ligado ao `ai_tool` do **AI Agent Sofia**.

**Description (visible to the AI):**

```
Lista todas as especialidades médicas ATIVAS disponíveis na clínica.
Use SEMPRE antes de oferecer especialidades ao paciente. Nunca invente.
```

**Input schema:** vazio (`{ "type": "object", "properties": {} }`).

**JS Code (substituir 100% do conteúdo):**

```javascript
try {
  const SUPABASE_URL = 'https://opzeqlcpmbmaugtdaipx.supabase.co';
  const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wemVxbGNwbWJtYXVndGRhaXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NDAxNjcsImV4cCI6MjA5MTAxNjE2N30.5sGz56SVTnPqwMnHTxiy0bg-6QPNaJo70Xi1Nyz1YI8';

  const resp = await fetch(
    SUPABASE_URL + '/rest/v1/especialidades?ativo=eq.true&select=id,nome,descricao&order=nome',
    { headers: { 'apikey': ANON, 'Authorization': 'Bearer ' + ANON } }
  );

  if (!resp.ok) {
    return JSON.stringify({ success: false, erro: 'Erro ao buscar especialidades: ' + resp.status });
  }

  const especialidades = await resp.json();
  if (!especialidades.length) {
    return JSON.stringify({ success: true, especialidades: [], mensagem: 'Nenhuma especialidade ativa cadastrada.' });
  }

  return JSON.stringify({
    success: true,
    total: especialidades.length,
    especialidades: especialidades.map(e => ({ nome: e.nome, descricao: e.descricao || '' }))
  });
} catch (e) {
  return JSON.stringify({ success: false, erro: e.message });
}
```

---

## 2. Tool `Buscar Agenda`

**Onde:** node `Tool Buscar Agenda`. **Remover** o `espMap` hardcoded.

**Description:**

```
Busca os próximos horários disponíveis para uma especialidade.
Use após o paciente escolher a especialidade. Retorna até 10 slots.
```

**Input schema:**

```json
{
  "type": "object",
  "properties": {
    "especialidade": { "type": "string", "description": "nome da especialidade (ex: Cardiologia)" }
  },
  "required": ["especialidade"]
}
```

**JS Code completo:**

```javascript
try {
  const SUPABASE_URL = 'https://opzeqlcpmbmaugtdaipx.supabase.co';
  const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wemVxbGNwbWJtYXVndGRhaXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NDAxNjcsImV4cCI6MjA5MTAxNjE2N30.5sGz56SVTnPqwMnHTxiy0bg-6QPNaJo70Xi1Nyz1YI8';
  const HEADERS = { 'apikey': ANON, 'Authorization': 'Bearer ' + ANON, 'Content-Type': 'application/json' };

  const esp = typeof especialidade !== 'undefined' && especialidade ? String(especialidade).trim() : '';
  if (!esp) {
    return JSON.stringify({ success: false, missingFields: ['especialidade'], mensagem: 'Informe a especialidade.' });
  }

  // 1. Resolve especialidade pelo nome (ILIKE, case-insensitive)
  const espResp = await fetch(
    SUPABASE_URL + '/rest/v1/especialidades?ativo=eq.true&nome=ilike.' + encodeURIComponent('%' + esp + '%') + '&select=id,nome',
    { headers: HEADERS }
  );
  const espData = await espResp.json();
  if (!espData.length) {
    return JSON.stringify({
      success: false,
      mensagem: 'Especialidade "' + esp + '" não encontrada. Use a tool listar_especialidades.'
    });
  }
  const espId = espData[0].id;
  const espNome = espData[0].nome;

  // 2. Slots com status='disponivel' (gerados pelo botão "Gerar agenda" do app)
  const hoje = new Date().toISOString().slice(0, 10);
  const slotsResp = await fetch(
    SUPABASE_URL + '/rest/v1/agendamentos'
      + '?especialidade_id=eq.' + espId
      + '&status=eq.disponivel'
      + '&data_consulta=gte.' + hoje
      + '&select=data_consulta,horario,medico'
      + '&order=data_consulta.asc,horario.asc'
      + '&limit=10',
    { headers: HEADERS }
  );
  const slots = await slotsResp.json();

  if (!slots.length) {
    return JSON.stringify({
      success: true,
      especialidade: espNome,
      horarios: [],
      mensagem: 'Sem horários disponíveis para ' + espNome + '. Sugira outra data ou outra especialidade.'
    });
  }

  return JSON.stringify({ success: true, especialidade: espNome, horarios: slots });
} catch (e) {
  return JSON.stringify({ success: false, erro: e.message });
}
```

---

## 3. Tool `Buscar Agenda por Periodo`

**Onde:** node `Tool Buscar Agenda por Periodo`. Mesma base + filtro turno.

**Description:**

```
Busca horários disponíveis filtrando por turno (manha, tarde ou noite).
Use quando o paciente disser preferência de período.
```

**Input schema:**

```json
{
  "type": "object",
  "properties": {
    "especialidade": { "type": "string" },
    "turno": { "type": "string", "enum": ["manha", "manhã", "tarde", "noite"] }
  },
  "required": ["especialidade", "turno"]
}
```

**JS Code completo:**

```javascript
try {
  const SUPABASE_URL = 'https://opzeqlcpmbmaugtdaipx.supabase.co';
  const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wemVxbGNwbWJtYXVndGRhaXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NDAxNjcsImV4cCI6MjA5MTAxNjE2N30.5sGz56SVTnPqwMnHTxiy0bg-6QPNaJo70Xi1Nyz1YI8';
  const HEADERS = { 'apikey': ANON, 'Authorization': 'Bearer ' + ANON, 'Content-Type': 'application/json' };

  const esp = typeof especialidade !== 'undefined' && especialidade ? String(especialidade).trim() : '';
  const periodo = (typeof turno !== 'undefined' ? String(turno) : '').toLowerCase().trim();
  if (!esp || !periodo) {
    return JSON.stringify({ success: false, missingFields: [!esp ? 'especialidade' : '', !periodo ? 'turno' : ''].filter(Boolean) });
  }

  const espResp = await fetch(
    SUPABASE_URL + '/rest/v1/especialidades?ativo=eq.true&nome=ilike.' + encodeURIComponent('%' + esp + '%') + '&select=id,nome',
    { headers: HEADERS }
  );
  const espData = await espResp.json();
  if (!espData.length) {
    return JSON.stringify({ success: false, mensagem: 'Especialidade "' + esp + '" não encontrada.' });
  }
  const espId = espData[0].id;
  const espNome = espData[0].nome;

  const hoje = new Date().toISOString().slice(0, 10);
  const slotsResp = await fetch(
    SUPABASE_URL + '/rest/v1/agendamentos'
      + '?especialidade_id=eq.' + espId
      + '&status=eq.disponivel'
      + '&data_consulta=gte.' + hoje
      + '&select=data_consulta,horario,medico'
      + '&order=data_consulta.asc,horario.asc'
      + '&limit=30',
    { headers: HEADERS }
  );
  const slots = await slotsResp.json();

  const filtrados = slots.filter(s => {
    const hora = parseInt(String(s.horario).slice(0, 2), 10);
    if (periodo === 'manha' || periodo === 'manhã') return hora < 12;
    if (periodo === 'tarde') return hora >= 12 && hora < 18;
    if (periodo === 'noite') return hora >= 18;
    return true;
  }).slice(0, 10);

  if (!filtrados.length) {
    return JSON.stringify({
      success: true,
      especialidade: espNome,
      turno: periodo,
      horarios: [],
      mensagem: 'Sem horários no turno da ' + periodo + ' para ' + espNome + '. Ofereça outro turno.'
    });
  }

  return JSON.stringify({ success: true, especialidade: espNome, turno: periodo, horarios: filtrados });
} catch (e) {
  return JSON.stringify({ success: false, erro: e.message });
}
```

---

## 4. Tool `Confirmar Agendamento` — INSERT vira UPDATE

**Por que:** o app gera slots `status='disponivel'` via função
`gerar_agenda_mes()`. Se a Sofia faz INSERT novo, o slot original nunca é
consumido e continua aparecendo nas próximas buscas (duplicação).
A tool deve fazer `PATCH` no slot existente, mudando para `confirmado`.

**Onde:** node `Tool Confirmar Agendamento`.

**Description:**

```
Confirma um agendamento ocupando um slot disponível.
Use quando o paciente confirmar data, horário e especialidade.
Antes disso, valide que paciente_telefone e paciente_nome estão preenchidos.
```

**Input schema:**

```json
{
  "type": "object",
  "properties": {
    "data":               { "type": "string", "description": "YYYY-MM-DD" },
    "horario":            { "type": "string", "description": "HH:MM ou HH:MM:SS" },
    "especialidade":      { "type": "string" },
    "paciente_telefone":  { "type": "string" },
    "paciente_nome":      { "type": "string" }
  },
  "required": ["data", "horario", "especialidade", "paciente_telefone", "paciente_nome"]
}
```

**JS Code completo:**

```javascript
try {
  const SUPABASE_URL = 'https://opzeqlcpmbmaugtdaipx.supabase.co';
  const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wemVxbGNwbWJtYXVndGRhaXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NDAxNjcsImV4cCI6MjA5MTAxNjE2N30.5sGz56SVTnPqwMnHTxiy0bg-6QPNaJo70Xi1Nyz1YI8';
  const HEADERS = { 'apikey': ANON, 'Authorization': 'Bearer ' + ANON, 'Content-Type': 'application/json' };

  const dt   = typeof data !== 'undefined' ? String(data).trim() : '';
  let   hr   = typeof horario !== 'undefined' ? String(horario).trim() : '';
  const esp  = typeof especialidade !== 'undefined' ? String(especialidade).trim() : '';
  const tel  = typeof paciente_telefone !== 'undefined' ? String(paciente_telefone).replace(/[^0-9]/g, '') : '';
  const nome = typeof paciente_nome !== 'undefined' ? String(paciente_nome).trim() : '';

  const faltando = [];
  if (!dt)   faltando.push('data');
  if (!hr)   faltando.push('horario');
  if (!esp)  faltando.push('especialidade');
  if (!tel)  faltando.push('paciente_telefone');
  if (!nome) faltando.push('paciente_nome');
  if (faltando.length) {
    return JSON.stringify({ success: false, missingFields: faltando });
  }

  // Normaliza horário para HH:MM:SS
  if (/^\d{2}:\d{2}$/.test(hr)) hr = hr + ':00';

  // 1. Acha o slot disponível pelo nome da especialidade (ILIKE)
  const slotResp = await fetch(
    SUPABASE_URL + '/rest/v1/agendamentos'
      + '?status=eq.disponivel'
      + '&data_consulta=eq.' + dt
      + '&horario=eq.' + hr
      + '&especialidade=ilike.' + encodeURIComponent(esp)
      + '&select=id,medico,medico_id,especialidade_id'
      + '&limit=1',
    { headers: HEADERS }
  );
  const slots = await slotResp.json();
  if (!slots.length) {
    return JSON.stringify({
      success: false,
      mensagem: 'Esse horário não está mais disponível. Use buscar_agenda novamente.'
    });
  }
  const slot = slots[0];

  // 2. UPDATE do slot — vira agendamento confirmado
  const upd = await fetch(
    SUPABASE_URL + '/rest/v1/agendamentos?id=eq.' + slot.id,
    {
      method: 'PATCH',
      headers: { ...HEADERS, 'Prefer': 'return=representation' },
      body: JSON.stringify({
        status: 'confirmado',
        paciente_telefone: tel,
        paciente_nome: nome
      })
    }
  );

  if (!upd.ok) {
    const err = await upd.text();
    return JSON.stringify({ success: false, erro: err });
  }

  return JSON.stringify({
    success: true,
    mensagem: 'Agendamento confirmado.',
    agendamento: {
      id: slot.id,
      data: dt,
      horario: hr,
      especialidade: esp,
      medico: slot.medico,
      paciente_nome: nome
    }
  });
} catch (e) {
  return JSON.stringify({ success: false, erro: e.message });
}
```

---

## 5. Criar Tool `Registrar Feedback`

**Onde:** **+** → busca **Custom Code** → **AI Tool**
(`@n8n/n8n-nodes-langchain.toolCode`). Renomear para
**Tool Registrar Feedback**. Conectar a saída em `ai_tool` do
**AI Agent Sofia**.

**Description:**

```
Registra o feedback de um paciente após a consulta. Use SOMENTE quando o
paciente sinalizar fim do atendimento ou ao perguntar a satisfação dele.
Pergunte uma nota de 1 a 5 e, opcionalmente, um comentário curto.
agendamento_id é opcional.
```

**Input schema:**

```json
{
  "type": "object",
  "properties": {
    "telefone":        { "type": "string", "description": "telefone do paciente (apenas números)" },
    "nome":            { "type": "string", "description": "nome do paciente, se conhecido" },
    "nota":            { "type": "integer", "description": "nota de 1 a 5", "minimum": 1, "maximum": 5 },
    "comentario":      { "type": "string", "description": "comentário curto do paciente" },
    "agendamento_id":  { "type": "string", "description": "uuid do agendamento, se houver" }
  },
  "required": ["telefone", "nota"]
}
```

**JS Code completo:**

```javascript
try {
  const SUPABASE_URL = 'https://opzeqlcpmbmaugtdaipx.supabase.co';
  const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wemVxbGNwbWJtYXVndGRhaXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NDAxNjcsImV4cCI6MjA5MTAxNjE2N30.5sGz56SVTnPqwMnHTxiy0bg-6QPNaJo70Xi1Nyz1YI8';

  const tel = typeof telefone !== 'undefined' && telefone ? String(telefone).replace(/[^0-9]/g, '') : '';
  const n   = typeof nota !== 'undefined' ? parseInt(nota, 10) : NaN;
  if (!tel || isNaN(n) || n < 1 || n > 5) {
    return JSON.stringify({
      success: false,
      missingFields: [!tel ? 'telefone' : '', (isNaN(n) || n < 1 || n > 5) ? 'nota (1-5)' : ''].filter(Boolean),
      mensagem: 'Informe telefone e nota entre 1 e 5.'
    });
  }

  const body = {
    paciente_telefone: tel,
    paciente_nome: typeof nome !== 'undefined' && nome ? nome : null,
    nota: n,
    comentario: typeof comentario !== 'undefined' && comentario ? comentario : null,
    agendamento_id: typeof agendamento_id !== 'undefined' && agendamento_id ? agendamento_id : null
  };

  const resp = await fetch(SUPABASE_URL + '/rest/v1/feedbacks', {
    method: 'POST',
    headers: {
      'apikey': ANON,
      'Authorization': 'Bearer ' + ANON,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(body)
  });

  if (resp.ok) {
    return JSON.stringify({ success: true, mensagem: 'Feedback registrado. Obrigada!' });
  }
  const err = await resp.text();
  return JSON.stringify({ success: false, erro: err });
} catch (e) {
  return JSON.stringify({ success: false, erro: e.message });
}
```

---

## 6. AI Agent Sofia — system prompt 100% reescrito

**Onde:** node **AI Agent Sofia** → campo `systemMessage`.

**Regras absolutas:**
- **SEM emojis em qualquer parte do prompt ou das respostas.**
- **SEM lista fixa de especialidades.** Sempre via `listar_especialidades`.
- Status de sessão: `'ia'` = bot ativo, `'humano'` = bot pausado (recepção
  assume). Nunca confundir.

**Cole exatamente este texto no campo `systemMessage`:**

```text
Você é Sofia, atendente virtual de uma clínica médica via WhatsApp.

PERSONALIDADE
- Acolhedora, objetiva, profissional.
- Frases curtas. Português brasileiro.
- Nunca use emojis. Nunca use figurinhas. Nunca use ícones.
- Quando precisar destacar algo, use negrito *assim* ou marcadores
  textuais como [ATENÇÃO], [IMPORTANTE], *Resumo:*, *Confirmado*.

INFORMAÇÕES DA CLÍNICA
- Especialidades disponíveis: SEMPRE chame a tool `listar_especialidades`
  antes de oferecer opções. Nunca invente nomes de especialidades.
- Horários: gerados pela equipe da clínica. Use `buscar_agenda` ou
  `buscar_agenda_por_periodo` para consultar.

FLUXO DE ATENDIMENTO

Passo 1 — Saudação e identificação
- Cumprimente, pergunte o nome se não souber.
- Pergunte como pode ajudar.

Passo 2 — Agendamento
- Chame `listar_especialidades` e ofereça apenas o que retornou.
- Pergunte a especialidade desejada.
- Se o paciente disser preferência de turno (manhã, tarde, noite),
  use `buscar_agenda_por_periodo`. Caso contrário, `buscar_agenda`.
- Apresente até 5 horários, formatados como "DD/MM às HH:MM com Dr(a) X".
- Pergunte qual o paciente prefere.

Passo 3 — Confirmação
- Confirme: data, horário, especialidade, médico, nome do paciente.
- Quando o paciente disser "sim" / "confirmo" / "pode marcar":
  chame `confirmar_agendamento` com data (YYYY-MM-DD), horario (HH:MM),
  especialidade, paciente_telefone, paciente_nome.
- Se a tool retornar success=false com "horário não está mais disponível",
  diga isso ao paciente e volte ao Passo 2.
- Se success=true, responda: "*Confirmado.* Sua consulta de
  {especialidade} no dia {data} às {horario} com {medico} está marcada."

Passo 4 — Feedback (sempre ao encerrar)
- Após confirmar agendamento OU quando o paciente se despedir, pergunte:
  "Antes de te liberar, posso fazer uma pergunta rápida? De 1 a 5,
  como você avalia este atendimento? Se quiser, deixe um comentário
  curto para a gente melhorar."
- Quando o paciente responder, chame `registrar_feedback` com
  telefone, nota e comentario (se houver).

ATENDIMENTO HUMANO
- Se o paciente pedir explicitamente para falar com humano, atendente,
  recepção ou se a situação fugir do seu escopo (urgência, reclamação
  grave, dúvida clínica), diga: "[ATENÇÃO] Vou te encaminhar para a
  nossa recepção. Em instantes alguém continua daqui."
- Pause sua atuação para esse paciente até receber novo input dele.

COMANDOS ESPECIAIS DO PACIENTE
- "/bot" → o paciente está retomando atendimento com a IA. Cumprimente
  brevemente e pergunte como pode ajudar.

REGRAS DE OURO
1. Nunca invente especialidades, horários ou médicos. Sempre via tools.
2. Nunca confirme um agendamento sem ter chamado `confirmar_agendamento`
   e recebido success=true.
3. Nunca peça CPF, cartão, senha ou dados sensíveis.
4. Se uma tool falhar, peça desculpa, ofereça tentar de novo ou falar
   com a recepção.
5. Sempre encerre coletando feedback (Passo 4).
```

---

## 7. Checklist de validação end-to-end

Após salvar e ativar o workflow, mande estas mensagens no WhatsApp de
teste:

1. **"oi"** → Sofia cumprimenta sem emoji.
2. **"quero marcar uma consulta"** → Sofia chama `listar_especialidades`
   e mostra exatamente o que está em `/cadastros` (ativo=true).
3. Cadastre uma especialidade nova no app `/cadastros`. Pergunte de novo
   à Sofia. **Deve aparecer na hora.**
4. Escolha uma especialidade com slots gerados pelo botão "Gerar agenda".
   Sofia deve listar horários reais.
5. Diga **"prefiro de tarde"** → Sofia usa `buscar_agenda_por_periodo`
   e filtra >= 12h e < 18h.
6. Confirme um horário. Verifique no Supabase:
   - O slot **mudou de `disponivel` para `confirmado`** (não foi criado
     um novo registro).
   - `paciente_telefone` e `paciente_nome` foram preenchidos.
7. Mesmo horário não aparece mais em `buscar_agenda`.
8. Sofia pergunta nota de 1 a 5. Responda **"5, ótimo atendimento"**.
   - Verifique tabela `feedbacks` — deve ter 1 linha nova.
   - O dashboard `/` deve mostrar o feedback em tempo real.
9. Diga **"quero falar com atendente"** → `pacientes.status_sessao`
   muda para `'humano'`. O dashboard toca o bip e mostra o toast (hook
   `useAlertaBotPausado`).
10. Mande **"/bot"** → status volta para `'ia'`.

---

## 8. Tabela resumo

| # | Tool / Node                  | Mudança                                                              | Motivo                                              |
|---|------------------------------|----------------------------------------------------------------------|-----------------------------------------------------|
| 1 | Listar Especialidades        | Lê de `especialidades` (ativo=true) via REST                         | Refletir cadastros do app                           |
| 2 | Buscar Agenda                | Resolve especialidade por nome, filtra slots `disponivel`            | Sem `espMap` hardcoded                              |
| 3 | Buscar Agenda por Periodo    | Idem + filtro de turno por hora                                      | Suportar manhã/tarde/noite dinamicamente            |
| 4 | Confirmar Agendamento        | `PATCH` no slot existente (status disponivel → confirmado)           | Não duplica slots gerados pelo botão "Gerar agenda" |
| 5 | Registrar Feedback (novo)    | `POST` em `feedbacks`                                                | Coletar NPS via WhatsApp                            |
| 6 | AI Agent Sofia (system)      | Sem emojis, sem lista fixa, com Passo 4 de feedback                  | Alinhar com regra de ouro do projeto e dashboard    |

Após aplicar todos os 6 itens, **arquivar** este documento em
`docs/` e remover os antigos `n8n-integracao-cadastros.md` e
`n8n-tool-registrar-feedback.md` (já feito automaticamente pelo commit
desta task).
