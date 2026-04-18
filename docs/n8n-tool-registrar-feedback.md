# Tool Registrar Feedback — instruções n8n

Esta tool deve ser adicionada ao fluxo **Atendimento - Clinica Medica (IA First)**
(`https://n8n.nateksoft.com/workflow/eqqEnl042R9NZN_UWToot`) e conectada como
`ai_tool` no node **AI Agent Sofia**, seguindo o mesmo padrão das tools existentes
(Salvar Paciente, Confirmar Agendamento, etc).

## Como adicionar

1. Abra o workflow no editor do n8n.
2. Clique em **+** → busque por **"Custom Code"** → **AI Tool**
   (`@n8n/n8n-nodes-langchain.toolCode`).
3. Cole os parâmetros abaixo e renomeie o node para **"Tool Registrar Feedback"**.
4. Conecte a saída da tool na entrada `ai_tool` do **AI Agent Sofia**.
5. Salve e ative.

## Parâmetros do node

**Description (visible to the AI):**

```
Registra o feedback de um paciente após a consulta. Use SOMENTE quando o paciente
sinalizar fim do atendimento ou ao perguntar a satisfação dele. Pergunte uma nota
de 1 a 5 e, opcionalmente, um comentário curto. agendamento_id é opcional.
```

**Input schema (manual):**

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

**JS Code:**

```javascript
try {
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

  const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wemVxbGNwbWJtYXVndGRhaXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NDAxNjcsImV4cCI6MjA5MTAxNjE2N30.5sGz56SVTnPqwMnHTxiy0bg-6QPNaJo70Xi1Nyz1YI8';

  const response = await fetch('https://opzeqlcpmbmaugtdaipx.supabase.co/rest/v1/feedbacks', {
    method: 'POST',
    headers: {
      'apikey': ANON,
      'Authorization': 'Bearer ' + ANON,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(body)
  });

  if (response.ok) {
    return JSON.stringify({ success: true, mensagem: 'Feedback registrado. Obrigada!' });
  }
  const err = await response.text();
  return JSON.stringify({ success: false, erro: err });
} catch (e) {
  return JSON.stringify({ success: false, erro: e.message });
}
```

## Atualização do system prompt da Sofia

No node **AI Agent Sofia**, adicione na tabela de ferramentas:

| Situação | Ferramenta | Quando usar |
|----------|-----------|-------------|
| Paciente encerrou o atendimento ou agradeceu | `registrar_feedback` | Pergunte "De 1 a 5, como você avalia esse atendimento? Quer deixar algum comentário?" e registre |

E inclua no fluxo de atendimento, após o agendamento confirmado ou despedida:

> "Antes de te liberar, posso te fazer uma pergunta rápida? De 1 a 5, como você
> avalia esse atendimento? E se quiser, deixa um comentário curto pra gente
> melhorar! 💙"

Após a resposta do paciente → chame `registrar_feedback` com `telefone`, `nota`
e `comentario` (se houver).
