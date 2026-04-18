# Sprint 3 — n8n: Solicitações, Reset de Memória e Transcrição de Áudio

**Workflow:** `Atendimento - Clinica Medica (IA First)` (`eqqEnl042R9NZN_UWToot`)
**Pré-requisito:** Sprints 1 e 2 aplicadas e validadas.
**Objetivo:** Fechar lacunas funcionais do bot — registrar solicitações estruturadas, evitar memória "infinita" da Sofia e suportar mensagens de áudio do WhatsApp.

---

## Visão geral das três entregas

| # | Entrega | Tipo de mudança | Tabela / API |
|---|---------|-----------------|--------------|
| 1 | Tool `criar_solicitacao` | Nova tool no AI Agent | `solicitacoes` (Supabase) |
| 2 | Reset de memória por inatividade | Ajuste no nó `Simple Memory` | `pacientes.ultima_atividade_bot` |
| 3 | Transcrição de áudio | Nova branch no extrator | Lovable AI Gateway (Gemini) |

---

## 1. Tool `criar_solicitacao` (registrar pedidos do paciente)

### 1.1 Por que existe
Hoje o paciente pode pedir coisas que **não são agendamento** (ex.: "quero remarcar", "preciso de atestado", "quero cancelar a consulta de amanhã", "quero falar com o financeiro"). Sem essa tool, a Sofia responde no chat mas **nada fica registrado** para a recepção tratar depois.

A tabela `solicitacoes` já existe no schema:

```
solicitacoes (
  id uuid pk,
  paciente_telefone text,
  paciente_nome text,
  tipo text,           -- 'remarcar' | 'cancelar' | 'atestado' | 'financeiro' | 'outro'
  motivo text,         -- texto livre vindo da conversa
  status text,         -- 'pendente' | 'em_andamento' | 'concluido'
  created_at timestamptz
)
```

### 1.2 Adicionar a tool no AI Agent

1. Abra o nó **AI Agent** (Sofia).
2. Em **Tools**, clique **+** → **HTTP Request Tool**.
3. Configure:

| Campo | Valor |
|-------|-------|
| **Name** | `criar_solicitacao` |
| **Description** | `Registra uma solicitação não-resolvida do paciente (remarcar, cancelar, atestado, financeiro, outro). Use SEMPRE que o paciente pedir algo que você não consegue resolver no chat. NÃO use para agendamento novo (existe tool própria).` |
| **Method** | `POST` |
| **URL** | `https://<SEU_PROJETO>.supabase.co/rest/v1/solicitacoes` |

4. **Headers**:
```
apikey:        {{ $env.SUPABASE_SERVICE_ROLE_KEY }}
Authorization: Bearer {{ $env.SUPABASE_SERVICE_ROLE_KEY }}
Content-Type:  application/json
Prefer:        return=representation
```

5. **Body (JSON, com placeholders `$fromAI`)**:
```json
{
  "paciente_telefone": "{{ $('Webhook').item.json.body.data.key.remoteJid.split('@')[0] }}",
  "paciente_nome": "={{ $fromAI('paciente_nome', 'Nome do paciente como aparece na conversa', 'string') }}",
  "tipo": "={{ $fromAI('tipo', 'Categoria: remarcar | cancelar | atestado | financeiro | outro', 'string') }}",
  "motivo": "={{ $fromAI('motivo', 'Resumo em 1 frase do que o paciente quer', 'string') }}",
  "status": "pendente"
}
```

### 1.3 Atualizar o System Prompt da Sofia

Adicione este bloco ao prompt (pode usar emoji aqui, conforme combinado):

```
🗂️ REGISTRO DE SOLICITAÇÕES

Sempre que o paciente pedir algo que VOCÊ NÃO CONSEGUE RESOLVER agora
(remarcar consulta existente, cancelar, pedir atestado, falar com financeiro,
qualquer pedido administrativo), você DEVE:

1. Chamar a tool `criar_solicitacao` com tipo + motivo claro.
2. Responder ao paciente confirmando o registro, ex.:
   "Anotei seu pedido de remarcação. A recepção vai te chamar em breve. ✅"
3. NÃO use essa tool para agendamento novo — para isso existe a tool de agenda.
4. NÃO use para emergência médica — para isso use `transferir_humano`.
```

### 1.4 Validação

WhatsApp:
> Paciente: "Oi, preciso remarcar minha consulta de quinta com o Dr. Silva"
> Sofia: "Anotei seu pedido de remarcação ✅..."

SQL:
```sql
SELECT tipo, motivo, status, created_at
FROM solicitacoes
WHERE paciente_telefone = '5511999999999'
ORDER BY created_at DESC
LIMIT 5;
```

---

## 2. Reset de memória por inatividade (sessionKey dinâmica)

### 2.1 Problema atual
O nó **Simple Memory** do n8n usa, por padrão, `sessionKey = paciente_telefone`. Resultado: a Sofia carrega **todo o histórico do paciente desde o primeiro dia**, o que:

- Estoura tokens (lentidão + custo)
- Faz a Sofia "lembrar" de contexto de 3 semanas atrás como se fosse hoje
- Confunde respostas (ex.: paciente perguntou de cardio mês passado, hoje quer dermato — Sofia mistura)

### 2.2 Solução: janela de 6h

A `sessionKey` passa a incluir um **bucket de 6 horas**. Toda vez que o paciente fica >6h sem falar, a próxima mensagem inicia uma sessão nova (memória limpa), mas o paciente continua sendo o mesmo no Supabase.

### 2.3 Edição no nó `Simple Memory`

1. Abra o nó **Simple Memory** (ou Window Buffer Memory) conectado ao AI Agent.
2. Em **Session ID** → **Expression**, cole:

```javascript
={{
  (() => {
    const tel = $('Webhook').item.json.body.data.key.remoteJid.split('@')[0];
    const bucket = Math.floor(Date.now() / (6 * 60 * 60 * 1000)); // janela de 6h
    return `${tel}_${bucket}`;
  })()
}}
```

3. Em **Context Window Length**, defina **20** (últimas 20 trocas — suficiente para uma sessão real).

### 2.4 Atualizar `ultima_atividade_bot` (opcional mas recomendado)

Logo após a Sofia responder, adicione um nó **HTTP Request** (`PATCH`) que marca a atividade — isso permite que o app/dashboard mostre quem está conversando agora.

| Campo | Valor |
|-------|-------|
| Method | `PATCH` |
| URL | `https://<SEU_PROJETO>.supabase.co/rest/v1/pacientes?telefone=eq.{{ $json.telefone }}` |
| Headers | `apikey`, `Authorization`, `Content-Type: application/json`, `Prefer: return=minimal` |
| Body | `{ "ultima_atividade_bot": "{{ $now.toISO() }}" }` |

### 2.5 Validação

1. Mande uma mensagem agora → Sofia responde com contexto.
2. Espere 6h+ (ou simule mudando o sistema para `Date.now() + 7h`).
3. Mande outra mensagem → Sofia **não deve** referenciar a conversa anterior; deve cumprimentar do zero.

SQL para inspecionar:
```sql
SELECT telefone, ultima_atividade_bot,
       NOW() - ultima_atividade_bot AS inativo_ha
FROM pacientes
ORDER BY ultima_atividade_bot DESC NULLS LAST
LIMIT 10;
```

---

## 3. Transcrição de áudio do WhatsApp (Gemini)

### 3.1 Problema atual
O extrator de mensagem do n8n hoje só captura:
- `message.conversation` (texto puro)
- `message.extendedTextMessage.text` (texto com formatação)
- `message.imageMessage.caption` (legenda de imagem)

**`message.audioMessage` é silenciosamente ignorado.** No WhatsApp, áudio é o canal mais usado por pacientes idosos — perdendo isso, a Sofia some.

### 3.2 Estratégia
Adicionar uma branch **antes** do AI Agent:

```
Webhook → Switch (tipo de mensagem)
                ├── texto/imagem → (fluxo atual) → AI Agent
                └── audioMessage → Baixar áudio (Evolution API)
                                 → Transcrever (Lovable AI Gateway / Gemini)
                                 → Set: $json.texto = transcrição
                                 → AI Agent
```

### 3.3 Nó 1 — Switch "Tipo de mensagem"

Logo após o Webhook, insira um nó **Switch** com 2 saídas:

| Output | Condição (Expression) |
|--------|----------------------|
| `texto` | `{{ $json.body.data.message.audioMessage === undefined }}` |
| `audio` | `{{ $json.body.data.message.audioMessage !== undefined }}` |

A saída `texto` continua para o fluxo já existente.
A saída `audio` segue para os próximos nós abaixo.

### 3.4 Nó 2 — HTTP Request "Baixar áudio (Evolution)"

A Evolution API tem um endpoint para baixar mídia em base64.

| Campo | Valor |
|-------|-------|
| Method | `POST` |
| URL | `https://<EVOLUTION_HOST>/chat/getBase64FromMediaMessage/<INSTANCE>` |
| Headers | `apikey: {{ $env.EVOLUTION_API_KEY }}` / `Content-Type: application/json` |
| Body | `{ "message": { "key": {{ JSON.stringify($('Webhook').item.json.body.data.key) }} } }` |

A resposta traz `{ base64: "...", mimetype: "audio/ogg; codecs=opus" }`.

### 3.5 Nó 3 — HTTP Request "Transcrever (Gemini via Lovable AI Gateway)"

Use o gateway oficial — não precisa configurar Google Cloud.

| Campo | Valor |
|-------|-------|
| Method | `POST` |
| URL | `https://ai.gateway.lovable.dev/v1/chat/completions` |
| Headers | `Authorization: Bearer {{ $env.LOVABLE_API_KEY }}` / `Content-Type: application/json` |

Body:
```json
{
  "model": "google/gemini-2.5-flash",
  "messages": [
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "Transcreva este áudio em português brasileiro. Retorne APENAS o texto transcrito, sem aspas, sem comentários, sem prefixos." },
        {
          "type": "input_audio",
          "input_audio": {
            "data": "{{ $json.base64 }}",
            "format": "ogg"
          }
        }
      ]
    }
  ]
}
```

> Se o gateway não aceitar `input_audio`, troque por `google/gemini-2.5-pro` que tem suporte multimodal completo a áudio.

### 3.6 Nó 4 — Set "Montar mensagem para Sofia"

Crie um nó **Edit Fields (Set)** com:

| Campo | Valor (Expression) |
|-------|--------------------|
| `texto` | `🎙️ (áudio): {{ $json.choices[0].message.content }}` |
| `telefone` | `{{ $('Webhook').item.json.body.data.key.remoteJid.split('@')[0] }}` |
| `tipo_origem` | `audio` |

Conecte a saída deste Set ao **mesmo input do AI Agent** que recebe a branch de texto. A Sofia trata como se fosse uma mensagem normal — só com o prefixo `🎙️ (áudio):` para ela saber que veio transcrito (útil quando a transcrição vier ruim).

### 3.7 Atualização opcional no system prompt

```
🎙️ ÁUDIOS

Quando a mensagem do usuário começar com "🎙️ (áudio):", significa que veio
de uma nota de voz transcrita. Se a transcrição parecer cortada ou confusa,
peça gentilmente para o paciente reenviar por texto ou repetir o áudio.
```

### 3.8 Logging

Não esqueça: o nó **HTTP Request "Log mensagem IN"** criado na Sprint 1 também precisa ser chamado nessa branch, com:

```json
{
  "paciente_telefone": "{{ $json.telefone }}",
  "direcao": "in",
  "tipo": "audio",
  "conteudo": "{{ $json.texto }}",
  "metadata": { "duracao_seg": null, "transcrito_por": "gemini-2.5-flash" }
}
```

### 3.9 Validação

1. Envie uma nota de voz curta no WhatsApp ("oi quero marcar dermato").
2. Verifique no n8n: o execution deve passar pela branch `audio`, baixar, transcrever e chamar a Sofia.
3. Sofia responde como se fosse texto.
4. SQL:
```sql
SELECT direcao, tipo, conteudo, metadata, created_at
FROM mensagens
WHERE tipo = 'audio'
ORDER BY created_at DESC
LIMIT 10;
```

---

## Checklist final da Sprint 3

- [ ] Tool `criar_solicitacao` adicionada e descrita no system prompt
- [ ] Teste manual: pedido de remarcação cria linha em `solicitacoes`
- [ ] `Simple Memory` com `sessionKey` por janela de 6h
- [ ] PATCH em `pacientes.ultima_atividade_bot` após cada resposta
- [ ] Switch separa áudio de texto logo após o Webhook
- [ ] Áudio é baixado da Evolution e transcrito via Gemini
- [ ] Branch de áudio reutiliza o AI Agent e o Log IN
- [ ] WhatsApp: nota de voz é entendida e respondida normalmente

---

## O que sobra depois da Sprint 3

Com Sprints 1+2+3 aplicadas, o produto cobre:

✔ Handoff humano com bloqueio do bot
✔ Auditoria total de mensagens
✔ Lembretes D-1 e T-2h automáticos
✔ Pesquisa de satisfação
✔ Solicitações administrativas registradas
✔ Memória limpa por sessão
✔ Áudio do WhatsApp

**Próximos passos no app (não no n8n):**
- Página `/atendimentos` para a recepção operar pacientes em modo humano
- Página `/solicitacoes` para tratar a fila de pedidos
- Drawer de histórico de conversa (ler `mensagens` por telefone) no dashboard
