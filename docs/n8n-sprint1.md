# n8n — Sprint 1: Handoff Humano + Auditoria

Workflow alvo: **Atendimento - Clinica Medica (IA First)**
URL: https://n8n.nateksoft.com/workflow/eqqEnl042R9NZN_UWToot

> Este documento detalha as 3 mudanças críticas (P0) identificadas na
> análise. Aplicar manualmente no editor do n8n — a edição via MCP não
> é suportada (apenas leitura/execução).

---

## Visão geral das mudanças

| # | Mudança | Tipo | Impacto |
|---|---------|------|---------|
| 1 | IF "Bot Ativo?" após `Verificar se Bot Ativo` | Novo nó | Para a Sofia de responder por cima do atendente humano |
| 2 | Tool `Transferir Humano` | Nova tool | Permite a Sofia escalar para recepção quando paciente pedir |
| 3 | Log de mensagens IN e OUT na tabela `mensagens` | 2 novos nós HTTP | Auditoria + histórico + base para métricas |

### Fluxo final esperado

```
Webhook Evolution API
    -> Extrair Dados da Mensagem
    -> Supabase - Buscar Paciente
    -> Verificar se Bot Ativo
    -> [NOVO] Log Mensagem IN          (HTTP POST mensagens)
    -> [NOVO] IF Bot Ativo?
         |-- true  -> Digitando... -> AI Agent Sofia -> Consolidar Resposta
         |              -> [NOVO] Log Mensagem OUT (HTTP POST mensagens)
         |              -> Evolution API - Enviar Mensagem
         |-- false -> (encerra silenciosamente — apenas log foi feito)
```

---

## 1. Adicionar nó IF "Bot Ativo?"

### Por que
O nó atual `Verificar se Bot Ativo` apenas LE o `status_sessao` e
repassa adiante. Não existe ramificação. Resultado: quando o paciente
está em `status_sessao = 'humano'`, a Sofia continua respondendo por
cima do atendente da recepção.

### Onde inserir
Entre `Verificar se Bot Ativo` e `Digitando...`.

### Passo a passo no editor

1. Clique no link `+` entre `Verificar se Bot Ativo` e `Digitando...`.
2. Pesquise **IF** (`n8n-nodes-base.if`).
3. Renomeie para **IF Bot Ativo?**.
4. Configurar 1 condição:
   - **Value 1:** `={{ $('Verificar se Bot Ativo').first().json.status_sessao }}`
   - **Operation:** `equal`
   - **Value 2:** `ia`
5. Combine com OR para o comando de reativação:
   - Adicione segunda condição:
     - **Value 1:** `={{ $('Verificar se Bot Ativo').first().json.mensagem }}`
     - **Operation:** `equal`
     - **Value 2:** `__REATIVAR_BOT__`
   - Mude o **Combine** para **OR (qualquer)**.
6. Conecte a saída **true** ao nó `Digitando...`.
7. Deixe a saída **false** desconectada (encerra o fluxo).

### Resultado
- `status_sessao = 'ia'` -> bot responde normalmente.
- `status_sessao = 'humano'` -> bot fica em silencio.
- Comando `/bot` (reativar) sempre passa, mesmo em modo humano,
  pois o extrator ja substituiu a mensagem por `__REATIVAR_BOT__`.

> **Atenção:** o JS do `Tool Transferir Humano` (proxima secao) e
> quem muda `status_sessao` para `humano`. O comando `/bot` precisa de
> uma tool extra OU pode ser tratado na propria Sofia chamando
> `salvar_paciente` com `status_sessao = 'ia'`. Para simplicidade, vamos
> adicionar o reset dentro do `Tool Salvar Paciente` em uma sprint
> futura. Hoje basta o atendente humano alterar o status manualmente
> no app `/atendimentos` (a ser criado) ou direto no Supabase.

---

## 2. Criar tool `Transferir Humano`

### Por que
A tabela `atendimentos_humanos` existe mas nada grava nela. A Sofia
precisa de uma ferramenta para escalar quando o paciente pedir
explicitamente ("quero falar com atendente", "humano", "recepcao") OU
quando a situacao fugir do escopo dela (urgencia, reclamacao grave).

### Passo a passo

1. No canvas, clique em **+** ao lado do `AI Agent Sofia` -> aba **AI Tools**.
2. Pesquise **Custom Code Tool** (`@n8n/n8n-nodes-langchain.toolCode`).
3. Renomeie o node para **Tool Transferir Humano**.
4. Conecte a saida em `ai_tool` do **AI Agent Sofia**.

### Description (visible to the AI)

```
Transfere a conversa para um atendente humano da recepcao.
Use SOMENTE quando:
- O paciente pedir EXPLICITAMENTE para falar com humano, atendente
  ou recepcao.
- A situacao fugir do seu escopo (urgencia medica, reclamacao grave,
  duvida clinica complexa).
- Voce nao conseguir resolver apos 2 tentativas.

Apos chamar esta tool, NAO responda mais nada nesta conversa.
A recepcao assume daqui.
```

### Input schema

Ative **Specify Input Schema** -> Schema Type: **Manual**:

```json
{
  "type": "object",
  "properties": {
    "telefone": {
      "type": "string",
      "description": "telefone do paciente (apenas numeros)"
    },
    "nome": {
      "type": "string",
      "description": "nome do paciente, se conhecido"
    },
    "motivo": {
      "type": "string",
      "description": "motivo curto da transferencia (ex: paciente solicitou atendente, reclamacao, urgencia)"
    }
  },
  "required": ["telefone", "motivo"]
}
```

### JS Code (cole 100% no campo `jsCode`)

```javascript
try {
  const SUPABASE_URL = 'https://opzeqlcpmbmaugtdaipx.supabase.co';
  const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wemVxbGNwbWJtYXVndGRhaXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NDAxNjcsImV4cCI6MjA5MTAxNjE2N30.5sGz56SVTnPqwMnHTxiy0bg-6QPNaJo70Xi1Nyz1YI8';
  const HEADERS = {
    'apikey': ANON,
    'Authorization': 'Bearer ' + ANON,
    'Content-Type': 'application/json'
  };

  const tel = typeof telefone !== 'undefined' && telefone ? String(telefone).replace(/[^0-9]/g, '') : '';
  const nm  = typeof nome !== 'undefined' && nome ? String(nome).trim() : null;
  const mot = typeof motivo !== 'undefined' && motivo ? String(motivo).trim() : 'Paciente solicitou atendimento humano';

  if (!tel) {
    return JSON.stringify({ success: false, missingFields: ['telefone'] });
  }

  // 1. Cria registro em atendimentos_humanos (status aguardando)
  const aten = await fetch(SUPABASE_URL + '/rest/v1/atendimentos_humanos', {
    method: 'POST',
    headers: { ...HEADERS, 'Prefer': 'return=representation' },
    body: JSON.stringify({
      paciente_telefone: tel,
      paciente_nome: nm,
      motivo: mot,
      status: 'aguardando'
    })
  });

  if (!aten.ok) {
    const err = await aten.text();
    return JSON.stringify({ success: false, etapa: 'atendimentos_humanos', erro: err });
  }

  // 2. Atualiza pacientes.status_sessao para humano (pausa o bot)
  const upd = await fetch(
    SUPABASE_URL + '/rest/v1/pacientes?telefone=eq.' + tel,
    {
      method: 'PATCH',
      headers: HEADERS,
      body: JSON.stringify({ status_sessao: 'humano' })
    }
  );

  if (!upd.ok) {
    const err = await upd.text();
    return JSON.stringify({ success: false, etapa: 'pacientes', erro: err });
  }

  return JSON.stringify({
    success: true,
    mensagem: 'Transferido para a recepcao. Diga ao paciente: "Vou te encaminhar para nossa recepcao. Em instantes alguem continua o atendimento."'
  });
} catch (e) {
  return JSON.stringify({ success: false, erro: e.message });
}
```

### Atualizar system prompt da Sofia

No node **AI Agent Sofia**, dentro da secao **AÇÕES OBRIGATÓRIAS — FERRAMENTAS**, adicionar a linha:

| Situação | Ferramenta | Quando usar |
|----------|-----------|-------------|
| Paciente pede atendente humano OU situação fora do escopo | `transferir_humano` | Imediatamente após detectar pedido ou urgência. Não tente resolver depois. |

E na secao **REGRAS ABSOLUTAS** adicionar:

```
11. ✅ SEMPRE use `transferir_humano` quando o paciente pedir
    explicitamente atendente / humano / recepcao, ou em casos de
    urgencia medica, reclamacao grave ou duvida clinica complexa.
    Apos chamar a tool, encerre sua resposta apenas com a frase
    sugerida pela tool.
```

---

## 3. Log de mensagens (auditoria)

### Por que
A tabela `mensagens` existe (`direcao`, `conteudo`, `tipo`, `agente`,
`metadata`, `created_at`) mas nenhum no escreve nela. Isso impede:
- Auditoria de conversas pelo painel admin
- Calculo de KPIs (msgs in/out, tempo de resposta) na view
  `v_metricas_diarias`
- Historico do paciente no futuro drawer `/conversas`

Vamos adicionar 2 nos HTTP POST: um logando a mensagem do paciente
(IN) logo apos `Verificar se Bot Ativo`, outro logando a resposta da
Sofia (OUT) entre `Consolidar Resposta` e `Evolution API - Enviar Mensagem`.

### 3.1 Nó "Log Mensagem IN"

**Posicao:** entre `Verificar se Bot Ativo` e `IF Bot Ativo?`
(criado na secao 1).

**Tipo:** `n8n-nodes-base.httpRequest` (HTTP Request).
**Method:** POST
**URL:**

```
https://opzeqlcpmbmaugtdaipx.supabase.co/rest/v1/mensagens
```

**Send Headers:** ON
| Name | Value |
|------|-------|
| `apikey` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wemVxbGNwbWJtYXVndGRhaXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NDAxNjcsImV4cCI6MjA5MTAxNjE2N30.5sGz56SVTnPqwMnHTxiy0bg-6QPNaJo70Xi1Nyz1YI8` |
| `Authorization` | `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wemVxbGNwbWJtYXVndGRhaXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NDAxNjcsImV4cCI6MjA5MTAxNjE2N30.5sGz56SVTnPqwMnHTxiy0bg-6QPNaJo70Xi1Nyz1YI8` |
| `Content-Type` | `application/json` |
| `Prefer` | `return=minimal` |

**Send Body:** ON -> JSON -> Specify Body: **JSON**:

```json
{
  "paciente_telefone": "={{ $('Verificar se Bot Ativo').first().json.telefone }}",
  "direcao": "in",
  "conteudo": "={{ $('Verificar se Bot Ativo').first().json.mensagem }}",
  "tipo": "texto",
  "agente": "paciente",
  "metadata": {
    "pushName": "={{ $('Verificar se Bot Ativo').first().json.pushName }}",
    "status_sessao": "={{ $('Verificar se Bot Ativo').first().json.status_sessao }}"
  }
}
```

**Settings -> On Error:** `Continue (using error output)` — para nao
travar o atendimento se o Supabase estiver lento.

### 3.2 Nó "Log Mensagem OUT"

**Posicao:** entre `Consolidar Resposta` e `Evolution API - Enviar Mensagem`.

**Tipo:** HTTP Request.
**Method:** POST
**URL:**

```
https://opzeqlcpmbmaugtdaipx.supabase.co/rest/v1/mensagens
```

**Headers:** mesmos da secao 3.1.

**Body JSON:**

```json
{
  "paciente_telefone": "={{ $('Verificar se Bot Ativo').first().json.telefone }}",
  "direcao": "out",
  "conteudo": "={{ $json.resposta || $json.text || $json.output }}",
  "tipo": "texto",
  "agente": "sofia",
  "metadata": {
    "modelo": "gemini"
  }
}
```

> O campo correto a ler depende de como o `Consolidar Resposta`
> formata. Inspecione o output dele e ajuste para o nome real do
> campo (`text`, `output`, `resposta` ou similar).

**Settings -> On Error:** `Continue (using error output)`.

---

## 4. Reconectar o fluxo principal

Apos adicionar todos os nos, a sequencia central deve ficar assim
(arraste as conexoes manualmente no canvas):

```
Verificar se Bot Ativo
   -> Log Mensagem IN
   -> IF Bot Ativo?
        true:  Digitando... -> AI Agent Sofia -> Consolidar Resposta
                  -> Log Mensagem OUT -> Evolution API - Enviar Mensagem
        false: (sem saida)
```

---

## 5. Salvar e ativar

1. Clique em **Save** no canto superior direito.
2. Garanta o toggle **Active** ligado.
3. Verifique se **Settings -> Available in MCP** continua marcado.

---

## 6. Checklist de validacao

Apos aplicar tudo, mande estas mensagens no WhatsApp de teste e
confirme:

| # | Acao no WhatsApp | Resultado esperado |
|---|------------------|-------------------|
| 1 | Mande "oi" como paciente normal | Sofia responde + 2 linhas novas em `mensagens` (in + out) |
| 2 | Mande "quero falar com atendente" | Sofia chama `transferir_humano`, responde com a frase de encaminhamento, cria 1 linha em `atendimentos_humanos`, muda `pacientes.status_sessao = 'humano'` |
| 3 | Mande "ainda esta ai?" | **Sofia NAO responde** (IF false). Mas `mensagens` tem 1 linha nova (direcao=in) |
| 4 | No Supabase, faca `UPDATE pacientes SET status_sessao='ia' WHERE telefone='SEU_TEL'` | Bot volta a responder na proxima mensagem |
| 5 | Mande "/bot" (de qualquer numero, fromMe=true) | Bot reativa imediatamente (passa pelo IF via condicao OR) |
| 6 | Abra o dashboard `/` | Toast e bip ja existem (hook `useAlertaBotPausado`) — devem disparar quando o teste 2 marcar humano |

### Queries de verificacao

```sql
-- Mensagens dos ultimos 10 minutos
SELECT created_at, paciente_telefone, direcao, agente, LEFT(conteudo, 60) as conteudo
FROM mensagens
WHERE created_at > now() - interval '10 minutes'
ORDER BY created_at DESC;

-- Atendimentos humanos pendentes
SELECT * FROM atendimentos_humanos WHERE status = 'aguardando' ORDER BY created_at DESC;

-- Pacientes em modo humano
SELECT telefone, nome, status_sessao FROM pacientes WHERE status_sessao = 'humano';
```

---

## 7. Tabela resumo

| # | Item | Onde | Status apos aplicar |
|---|------|------|---------------------|
| 1 | IF Bot Ativo? | Apos `Verificar se Bot Ativo` | Bot para de falar por cima do atendente |
| 2 | Tool Transferir Humano | Plugada em `ai_tool` do AI Agent Sofia | Sofia consegue escalar para recepcao |
| 3 | Log Mensagem IN | Apos `Verificar se Bot Ativo` | Toda mensagem do paciente vai para `mensagens` |
| 4 | Log Mensagem OUT | Apos `Consolidar Resposta` | Toda resposta da Sofia vai para `mensagens` |

Apos validar via checklist, partir para Sprint 2 (lembretes D-1, T-2h
e pesquisa de satisfacao via cron).
