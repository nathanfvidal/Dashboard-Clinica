# Integração n8n × Cadastros (Especialidades, Médicos, Horários)

Este documento descreve como atualizar as tools do fluxo **Atendimento - Clinica Medica (IA First)** (`eqqEnl042R9NZN_UWToot`) para usar as novas tabelas (`especialidades`, `medicos`, `horarios_medico`) ao invés das listas hardcoded.

> ⚠️ A edição de workflows via MCP do n8n não é suportada (apenas leitura/execução). As mudanças abaixo precisam ser aplicadas manualmente no editor do n8n.

---

## 1. Tool `Listar Especialidades` — substituir `jsCode`

Antes a lista estava hardcoded. Trocar por consulta dinâmica:

```js
try {
  const response = await fetch(
    'https://opzeqlcpmbmaugtdaipx.supabase.co/rest/v1/especialidades?ativo=eq.true&select=nome,descricao,icone&order=nome',
    {
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wemVxbGNwbWJtYXVndGRhaXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NDAxNjcsImV4cCI6MjA5MTAxNjE2N30.5sGz56SVTnPqwMnHTxiy0bg-6QPNaJo70Xi1Nyz1YI8',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wemVxbGNwbWJtYXVndGRhaXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NDAxNjcsImV4cCI6MjA5MTAxNjE2N30.5sGz56SVTnPqwMnHTxiy0bg-6QPNaJo70Xi1Nyz1YI8',
        'Content-Type': 'application/json'
      }
    }
  );
  const especialidades = await response.json();
  return JSON.stringify({ success: true, especialidades });
} catch (e) {
  return JSON.stringify({ success: false, erro: e.message });
}
```

---

## 2. Tool `Buscar Agenda` — remover `espMap` hardcoded

Buscar a especialidade no banco por nome (ILIKE) e usar o `id` para filtrar agendamentos:

```js
try {
  let esp = typeof especialidade !== 'undefined' && especialidade ? especialidade : (query || '');
  if (!esp) return JSON.stringify({ success: false, missingFields: ['especialidade'], mensagem: 'Informe a especialidade.' });

  const headers = {
    'apikey': 'SUPABASE_ANON_KEY',
    'Authorization': 'Bearer SUPABASE_ANON_KEY',
    'Content-Type': 'application/json'
  };

  // 1. Resolve especialidade pelo nome (case-insensitive, sem acento)
  const espResp = await fetch(
    'https://opzeqlcpmbmaugtdaipx.supabase.co/rest/v1/especialidades?ativo=eq.true&nome=ilike.' + encodeURIComponent('%' + esp + '%') + '&select=id,nome',
    { headers }
  );
  const espData = await espResp.json();
  if (!espData.length) {
    return JSON.stringify({ success: false, mensagem: 'Especialidade "' + esp + '" não encontrada. Use listar_especialidades.' });
  }
  const espId = espData[0].id;
  const espNome = espData[0].nome;

  // 2. Slots disponíveis (status=disponivel) gerados pelo botão "Gerar agenda" do app
  const hoje = new Date().toISOString().slice(0, 10);
  const slotsResp = await fetch(
    'https://opzeqlcpmbmaugtdaipx.supabase.co/rest/v1/agendamentos?especialidade_id=eq.' + espId + '&status=eq.disponivel&data_consulta=gte.' + hoje + '&select=data_consulta,horario,medico&order=data_consulta.asc,horario.asc&limit=10',
    { headers }
  );
  const slots = await slotsResp.json();

  if (!slots.length) {
    return JSON.stringify({ success: true, especialidade: espNome, horarios: [], mensagem: 'Sem horários disponíveis para ' + espNome + '. Sugira outra data ou especialidade.' });
  }

  return JSON.stringify({ success: true, especialidade: espNome, horarios: slots });
} catch (e) {
  return JSON.stringify({ success: false, erro: e.message });
}
```

---

## 3. Tool `Buscar Agenda por Periodo` — mesma lógica + filtro horário

Adicionar após `slots` o filtro:

```js
const periodo = (typeof turno !== 'undefined' ? turno : '').toLowerCase();
const filtrados = slots.filter(s => {
  const hora = parseInt(s.horario.slice(0,2), 10);
  if (periodo === 'manha' || periodo === 'manhã') return hora < 12;
  if (periodo === 'tarde') return hora >= 12 && hora < 18;
  if (periodo === 'noite') return hora >= 18;
  return true;
});
```

---

## 4. Tool `Confirmar Agendamento` — passar `medico_id` e `especialidade_id`

Ao receber a confirmação, ao invés de fazer `INSERT`, faça `UPDATE` no slot pré-existente com `status='disponivel'`:

```js
// values esperados: data, horario, especialidade, paciente_telefone, paciente_nome
const headers = { /* ... */ };

// Acha o slot
const slotResp = await fetch(
  'https://opzeqlcpmbmaugtdaipx.supabase.co/rest/v1/agendamentos?status=eq.disponivel&data_consulta=eq.' + data + '&horario=eq.' + horario + '&especialidade=ilike.' + encodeURIComponent(especialidade) + '&select=id&limit=1',
  { headers }
);
const slot = (await slotResp.json())[0];
if (!slot) return JSON.stringify({ success: false, mensagem: 'Esse horário não está mais disponível.' });

const upd = await fetch(
  'https://opzeqlcpmbmaugtdaipx.supabase.co/rest/v1/agendamentos?id=eq.' + slot.id,
  {
    method: 'PATCH',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body: JSON.stringify({ status: 'confirmado', paciente_telefone, paciente_nome })
  }
);
return JSON.stringify({ success: upd.ok });
```

Assim o slot vira agendamento real e some da busca da Sofia.

---

## 5. System prompt da Sofia — ajustar texto

Remover a lista fixa de 6 especialidades em **"INFORMAÇÕES DA CLÍNICA"** e substituir por:

```
**Especialidades disponíveis:** use SEMPRE a tool `listar_especialidades` para
obter a lista atualizada antes de oferecer opções ao paciente.
```

E em **"Passo 1"** do fluxo de agendamento, trocar:

```
> "Que especialidade você precisa? Temos: Clínica Geral, Cardiologia..."
```

por:

```
SEMPRE chame `listar_especialidades` antes deste passo e ofereça apenas as
especialidades retornadas.
```

---

## 6. Resumo do impacto

| Tool | Mudança |
|------|---------|
| Listar Especialidades | lê de `especialidades` (ativo=true) |
| Buscar Agenda | resolve especialidade por nome, filtra por `especialidade_id` |
| Buscar Agenda por Periodo | idem + filtro de turno |
| Confirmar Agendamento | UPDATE do slot disponível ao invés de INSERT |
| System prompt | sem lista fixa, sempre via tool |

Após essas mudanças, qualquer especialidade/médico/horário cadastrado no app `/cadastros` aparece automaticamente para a Sofia.
