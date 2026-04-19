# Fix — "Calling Tool_Buscar_Agenda with input: ..." vazando no WhatsApp

## Sintoma

Paciente confirma agendamento (ou qualquer outra ação) e em vez da
resposta da Sofia chega no WhatsApp algo como:

```
Calling Tool_Buscar_Agenda with input: {"especialidade":"Pediatria","turno":"tarde","dia_semana":"quarta"}
```

Características do bug:
- Mensagem vem com `fromMe: true` e `pushName: "Você"` (foi enviada pela
  própria conta do bot via Evolution API).
- Nome da tool aparece com **underscore** (`Tool_Buscar_Agenda`), mas
  no workflow as tools se chamam com espaço (`Tool Buscar Agenda`).
- A tool **não executa de verdade** — não cria registro, não consulta
  banco, nada acontece além da mensagem vazar.

## Causa raiz

O nó **Google Gemini Chat Model** está usando `models/gemini-2.5-pro`.
Esse modelo, no conector LangChain do n8n, tem comportamento instável de
tool-calling: em vez de emitir a chamada de tool no protocolo
function-calling (que o agent intercepta e roteia pro nó correto),
ele às vezes **emite a chamada como texto plano** dentro do `output` do
agent.

O nó `Consolidar Resposta` lê `item.output` cru e manda direto pro
`Evolution API - Enviar Mensagem` → resultado: o "pensamento" do modelo
vira mensagem do WhatsApp e a tool real nunca roda.

## Correção (2 partes)

### 1. Trocar o modelo do Gemini (essencial)

No nó **Google Gemini Chat Model**:

- Modelo atual: `models/gemini-2.5-pro`
- Trocar para: **`models/gemini-2.5-flash`**
  (ou `models/gemini-2.0-flash` se 2.5-flash não estiver disponível)

O `flash` respeita o protocolo de function-calling do LangChain n8n e
não vaza tool calls como texto.

### 2. Safety net no Consolidar Resposta

Mesmo trocando o modelo, vale blindar o nó **Consolidar Resposta** pra
nunca enviar uma string que pareça um tool call que escapou. Substituir
o `jsCode` atual por:

```javascript
const item = $input.first().json;
const dadosOriginais = $('Verificar se Bot Ativo').first().json;

let resposta = item.output || item.resposta || item.text
  || '⚠️ Desculpe, ocorreu um erro. Por favor, tente novamente.';

const telefone = dadosOriginais.telefone || item.telefone || '';
const remoteJid = dadosOriginais.remoteJid || item.remoteJid || (telefone ? telefone + '@s.whatsapp.net' : '');

// === Safety net: detecta tool calls que escaparam como texto ===
// Padrões conhecidos: "Calling Tool_X with input:", "Tool: X(", "<tool_call>"
const padraoToolVazado = /^\s*(calling\s+tool[_a-z]*|<\s*tool_?call|tool\s*:\s*\w+\s*\(|```tool|action\s*:\s*\w+\s*\n)/i;
if (padraoToolVazado.test(resposta)) {
  console.log('[ConsolidarResposta] Tool call vazou como texto, suprimindo:', resposta.slice(0, 200));
  resposta = 'Só um momento, estou consultando aqui...';
}

// Limpar markdown para WhatsApp
const respostaLimpa = resposta
  .replace(/\*\*(.*?)\*\*/g, '*$1*')
  .replace(/^#{1,6}\s+/gm, '')
  .replace(/^---+$/gm, '─────────────');

return [{ json: { telefone, remoteJid, resposta: respostaLimpa } }];
```

Assim, se algum dia o modelo voltar a vazar, o paciente recebe um
"só um momento" educado em vez do JSON cru.

### 3. Reforço no system prompt (opcional, mas recomendado)

No nó **AI Agent Sofia**, no `systemMessage`, **logo abaixo de
"PERSONALIDADE"** adicionar:

```
NUNCA escreva mensagens como "Calling Tool X", "Tool: X(...)" ou
qualquer texto que pareça uma chamada de função. Quando precisar usar
uma ferramenta, simplesmente use — não anuncie, não narre.
```

## Como validar depois de aplicar

1. Mandar no WhatsApp: "queria marcar pediatra"
2. Sofia deve perguntar preferência de turno/dia (não vazar tool call).
3. Responder: "quarta de tarde"
4. Sofia deve responder com a lista de horários **agrupada por dia**
   (formato 📅 Quarta DD/MM — Dr. X), sem nenhum "Calling Tool".
5. Escolher um horário e confirmar.
6. Conferir em `Dashboard → Próximos agendamentos` se o registro
   apareceu de verdade no banco.

Se ainda vazar mesmo depois de trocar pra `gemini-2.5-flash`, abrir uma
execução do workflow no n8n, expandir o nó **AI Agent Sofia** e
verificar se o campo `output` da execução já vem com "Calling Tool..."
(aí o problema é 100% do modelo) ou se vem limpo e o vazamento é em
outro nó.
