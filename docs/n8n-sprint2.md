# n8n — Sprint 2: Automações por Cron

Workflow alvo: **3 novos workflows separados** (não tocar no
"Atendimento - Clinica Medica (IA First)").

> Cada cron vira um workflow proprio para isolar falhas e facilitar
> manutencao. Aplicar manualmente no editor do n8n.

---

## Visão geral

| # | Workflow | Trigger | Tabela origem | Tabela atualizada |
|---|----------|---------|---------------|-------------------|
| 1 | **Cron Lembrete D-1** | Schedule diário 08h00 | `agendamentos` (amanhã, confirmado, sem lembrete D-1) | `agendamentos.lembrete_d1_enviado_at` |
| 2 | **Cron Lembrete T-2h** | Schedule a cada 30min | `agendamentos` (hoje, ~2h, confirmado, sem lembrete T-2h) | `agendamentos.lembrete_2h_enviado_at` |
| 3 | **Cron Pesquisa Satisfação** | Schedule diário 19h00 | `agendamentos` (hoje, confirmado, sem feedback solicitado) | `agendamentos.feedback_solicitado_at` |

### Padrao comum aos 3

```
Schedule Trigger
    -> HTTP GET Supabase (query dos agendamentos elegiveis)
    -> Split In Batches (1 por vez, evita flood Evolution)
    -> HTTP POST Evolution API (envia mensagem)
    -> HTTP PATCH Supabase (marca como enviado)
```

### Constantes (todos os workflows)

```
SUPABASE_URL  = https://opzeqlcpmbmaugtdaipx.supabase.co
ANON          = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wemVxbGNwbWJtYXVndGRhaXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NDAxNjcsImV4cCI6MjA5MTAxNjE2N30.5sGz56SVTnPqwMnHTxiy0bg-6QPNaJo70Xi1Nyz1YI8
EVOLUTION_URL = https://evolution.nateksoft.com/message/sendText/Clinica
EVOLUTION_KEY = nateksoft
```

---

## 1. Workflow "Cron Lembrete D-1"

### Objetivo
Diariamente às 08h, mandar mensagem de lembrete para todo paciente
com consulta confirmada **amanhã**.

### 1.1 Schedule Trigger

- Tipo: `n8n-nodes-base.scheduleTrigger`
- Trigger Rules: **Custom (Cron)**
- Expression: `0 8 * * *` (todo dia às 08h00)
- Timezone: `America/Sao_Paulo`

### 1.2 HTTP GET — Buscar agendamentos de amanhã

- Tipo: HTTP Request
- Method: **GET**
- URL:

```
=https://opzeqlcpmbmaugtdaipx.supabase.co/rest/v1/agendamentos?status=eq.confirmado&data_consulta=eq.{{ $now.plus({days:1}).toFormat('yyyy-MM-dd') }}&lembrete_d1_enviado_at=is.null&select=id,paciente_telefone,paciente_nome,data_consulta,horario,especialidade,medico
```

- Send Headers: ON
  - `apikey`: `{{ANON}}`
  - `Authorization`: `Bearer {{ANON}}`
- On Error: **Continue (using error output)**

### 1.3 Split In Batches

- Tipo: `n8n-nodes-base.splitInBatches`
- Batch Size: **1**
- Options -> Reset: false

### 1.4 HTTP POST — Evolution API (envia WhatsApp)

- Method: **POST**
- URL: `https://evolution.nateksoft.com/message/sendText/Clinica`
- Send Headers: ON
  - `apikey`: `nateksoft`
  - `Content-Type`: `application/json`
- Body JSON:

```json
{
  "number": "={{ $json.paciente_telefone }}",
  "text": "=Ola{{ $json.paciente_nome ? ', ' + $json.paciente_nome : '' }}! Lembrando que voce tem consulta *amanha* ({{ DateTime.fromISO($json.data_consulta).toFormat('dd/MM') }}) as *{{ $json.horario.slice(0,5) }}* com {{ $json.medico }} ({{ $json.especialidade }}).\n\nResponda *SIM* para confirmar ou *NAO* para cancelar.\n\nChegue 15 min antes com documento com foto."
}
```

- On Error: **Continue (using error output)**

### 1.5 HTTP PATCH — Marca lembrete enviado

- Method: **PATCH**
- URL:

```
=https://opzeqlcpmbmaugtdaipx.supabase.co/rest/v1/agendamentos?id=eq.{{ $('Split In Batches').item.json.id }}
```

- Send Headers: ON
  - `apikey`: `{{ANON}}`
  - `Authorization`: `Bearer {{ANON}}`
  - `Content-Type`: `application/json`
  - `Prefer`: `return=minimal`
- Body JSON:

```json
{
  "lembrete_d1_enviado_at": "={{ $now.toISO() }}"
}
```

### 1.6 Conexões

```
Schedule -> HTTP GET -> Split In Batches -> Evolution POST -> PATCH
                              ^                                 |
                              +---------------------------------+
                                  (loop "done" do split)
```

> O Split In Batches tem 2 saidas: **loop** (cada item) e **done**
> (final). Conecte o **PATCH** de volta na entrada do **Split** para
> processar o proximo item. A saida **done** fica desconectada.

---

## 2. Workflow "Cron Lembrete T-2h"

### Objetivo
A cada 30 minutos, mandar lembrete para consultas que comecam em
~2 horas (entre 1h45 e 2h15 a partir de agora).

### 2.1 Schedule Trigger

- Trigger: **Custom (Cron)**
- Expression: `*/30 * * * *` (a cada 30 minutos)
- Timezone: `America/Sao_Paulo`

### 2.2 HTTP GET — Buscar consultas que comecam em ~2h

A janela e: `agora + 1h45min <= data_consulta+horario <= agora + 2h15min`.

Como o Supabase REST nao suporta concat de `data_consulta + horario`
diretamente em filtro, vamos fazer a janela pelo dia + intervalo de
horario.

- Method: **GET**
- URL:

```
=https://opzeqlcpmbmaugtdaipx.supabase.co/rest/v1/agendamentos?status=eq.confirmado&data_consulta=eq.{{ $now.setZone('America/Sao_Paulo').toFormat('yyyy-MM-dd') }}&horario=gte.{{ $now.setZone('America/Sao_Paulo').plus({hours:1, minutes:45}).toFormat('HH:mm:ss') }}&horario=lte.{{ $now.setZone('America/Sao_Paulo').plus({hours:2, minutes:15}).toFormat('HH:mm:ss') }}&lembrete_2h_enviado_at=is.null&select=id,paciente_telefone,paciente_nome,data_consulta,horario,especialidade,medico
```

- Headers: mesmos da secao 1.2.
- On Error: **Continue**.

### 2.3 Split In Batches
Igual a 1.3.

### 2.4 HTTP POST Evolution

Body JSON:

```json
{
  "number": "={{ $json.paciente_telefone }}",
  "text": "=Oi{{ $json.paciente_nome ? ', ' + $json.paciente_nome : '' }}! Sua consulta de *{{ $json.especialidade }}* com {{ $json.medico }} comeca em *2 horas* (as {{ $json.horario.slice(0,5) }}).\n\nNao esqueca de chegar 15 min antes."
}
```

### 2.5 HTTP PATCH

URL identico a 1.5. Body:

```json
{
  "lembrete_2h_enviado_at": "={{ $now.toISO() }}"
}
```

### 2.6 Conexões
Mesmo padrao da Sprint 1.

> **Atencao a virada de meia-noite:** se o cron rodar as 23h45 e a
> consulta for as 01h45 do dia seguinte, este filtro nao captura.
> Para o MVP isso nao e critico (clinica fecha 18h). Se um dia tiver
> plantao noturno, evoluir para um Code node calculando a janela
> em UTC e dividindo em 2 buscas (dia atual + dia seguinte).

---

## 3. Workflow "Cron Pesquisa Satisfacao"

### Objetivo
Diariamente às 19h, mandar pesquisa de satisfacao para pacientes que
tiveram consulta **hoje** (ja passou) e ainda nao receberam o pedido
de feedback.

A resposta do paciente cai no fluxo principal e a Sofia chama a tool
`registrar_feedback` ja existente.

### 3.1 Schedule Trigger

- Expression: `0 19 * * *` (todo dia às 19h00)
- Timezone: `America/Sao_Paulo`

### 3.2 HTTP GET — Buscar consultas de hoje

- Method: **GET**
- URL:

```
=https://opzeqlcpmbmaugtdaipx.supabase.co/rest/v1/agendamentos?status=eq.confirmado&data_consulta=eq.{{ $now.setZone('America/Sao_Paulo').toFormat('yyyy-MM-dd') }}&feedback_solicitado_at=is.null&select=id,paciente_telefone,paciente_nome,especialidade,medico,horario
```

- Headers: padrao.
- On Error: **Continue**.

### 3.3 Split In Batches
Batch Size: 1.

### 3.4 HTTP POST Evolution

Body JSON:

```json
{
  "number": "={{ $json.paciente_telefone }}",
  "text": "=Oi{{ $json.paciente_nome ? ', ' + $json.paciente_nome : '' }}! Aqui e a Sofia da clinica.\n\nComo foi sua consulta hoje com {{ $json.medico }} ({{ $json.especialidade }})?\n\nDe *1 a 5*, qual nota voce daria para o atendimento? Se quiser, deixe um comentario curto para a gente melhorar."
}
```

### 3.5 HTTP PATCH — Marca feedback solicitado

URL: igual ao item 1.5 (rota `agendamentos?id=eq.{{ id }}`).

Body:

```json
{
  "feedback_solicitado_at": "={{ $now.toISO() }}"
}
```

### 3.6 Conexões
Mesmo padrao.

> Quando o paciente responder no WhatsApp, a mensagem cai no fluxo
> principal "Atendimento - Clinica Medica (IA First)". A Sofia
> reconhece o contexto (graças a Window Buffer Memory) e chama a tool
> `registrar_feedback` que insere em `feedbacks`. **Nao precisa**
> nenhum nó extra para isso.

---

## 4. Convenções e boas praticas

### 4.1 Nomeacao
- Prefixo `Cron - ` em todos os workflows novos para identificar no
  dashboard do n8n.
- Cada nó: nome em portugues claro (`HTTP GET Agendamentos D-1`,
  `Marca lembrete D-1 enviado`).

### 4.2 Idempotencia
Os filtros `lembrete_*_enviado_at=is.null` garantem que o mesmo
agendamento NUNCA recebe duas mensagens. Mesmo se o cron rodar 2x.

### 4.3 Tratamento de erro
- Todos os HTTP nodes: **Continue (using error output)** para nao
  travar a fila se 1 numero falhar.
- Adicionar (opcional): nó **Slack/Telegram Alert** na saida de erro
  do POST Evolution para notificar o admin.

### 4.4 Rate limit Evolution
Evolution API geralmente aceita ~10 msg/segundo. Com Split In Batches
size=1 + latencia de rede, ja ficamos abaixo. Se precisar acelerar:
adicionar **Wait 200ms** entre POST e PATCH.

### 4.5 Logs
Estes crons NAO precisam logar em `mensagens` (que e historico de
conversa do paciente x Sofia). Sao mensagens unidirecionais
sistemicas. Se quiser auditoria, criar tabela separada
`mensagens_sistema` em sprint futura.

---

## 5. Checklist de validacao

### 5.1 Lembrete D-1

```sql
-- Criar consulta de teste para amanha
UPDATE agendamentos
SET data_consulta = current_date + 1,
    horario = '10:00:00',
    status = 'confirmado',
    paciente_telefone = 'SEU_NUMERO_DE_TESTE',
    paciente_nome = 'Teste',
    lembrete_d1_enviado_at = NULL
WHERE id = 'UUID_DE_UM_SLOT_QUALQUER';
```

- No editor n8n, abra o workflow **Cron Lembrete D-1** -> botao
  **Execute Workflow** (manual) -> deve mandar 1 WhatsApp.
- Verificar:
  ```sql
  SELECT id, lembrete_d1_enviado_at FROM agendamentos
  WHERE paciente_telefone = 'SEU_NUMERO_DE_TESTE';
  ```
  `lembrete_d1_enviado_at` deve estar preenchido.
- Rodar **Execute Workflow** de novo: nao deve mandar nada
  (idempotencia OK).

### 5.2 Lembrete T-2h

```sql
-- Criar consulta para daqui ~2h
UPDATE agendamentos
SET data_consulta = current_date,
    horario = (current_time + interval '2 hours')::time,
    status = 'confirmado',
    paciente_telefone = 'SEU_NUMERO_DE_TESTE',
    lembrete_2h_enviado_at = NULL
WHERE id = 'UUID_DE_UM_SLOT_QUALQUER';
```

- Execute Workflow -> deve mandar 1 mensagem.
- Conferir `lembrete_2h_enviado_at`.

### 5.3 Pesquisa de satisfacao

```sql
-- Marcar consulta de hoje sem feedback solicitado
UPDATE agendamentos
SET data_consulta = current_date,
    horario = '08:00:00',
    status = 'confirmado',
    paciente_telefone = 'SEU_NUMERO_DE_TESTE',
    feedback_solicitado_at = NULL
WHERE id = 'UUID_DE_UM_SLOT_QUALQUER';
```

- Execute Workflow -> mensagem de pesquisa enviada.
- Responder "5, otimo" no WhatsApp -> a Sofia (fluxo principal)
  chama `registrar_feedback` -> conferir tabela `feedbacks`.

---

## 6. Tabela resumo

| # | Workflow | Cron | URL Supabase (filtro chave) | PATCH alvo |
|---|----------|------|-----------------------------|-----------|
| 1 | Cron Lembrete D-1 | `0 8 * * *` | `data_consulta=amanha & lembrete_d1_enviado_at=null` | `lembrete_d1_enviado_at` |
| 2 | Cron Lembrete T-2h | `*/30 * * * *` | `data_consulta=hoje & horario in [+1h45,+2h15] & lembrete_2h_enviado_at=null` | `lembrete_2h_enviado_at` |
| 3 | Cron Pesquisa Satisfacao | `0 19 * * *` | `data_consulta=hoje & feedback_solicitado_at=null` | `feedback_solicitado_at` |

Apos validar os 3 workflows, partir para Sprint 3:
- Tool `criar_solicitacao` (tabela `solicitacoes`)
- Reset de memoria por inatividade (sessionKey dinamica)
- Transcricao de audio (extrator + Gemini Speech)
- Drawer de historico de conversa no dashboard
