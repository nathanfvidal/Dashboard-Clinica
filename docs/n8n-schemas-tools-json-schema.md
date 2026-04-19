# n8n — JSON Schema de todas as tools da Sofia

Troque cada tool de **Generate From JSON Example** para **Define Using JSON Schema**.

Regra importante para todas:

- **Não** usar `additionalProperties: false`.
- O n8n/LangChain pode injetar campos internos como `data` e `toolCallId`.
- Deixe em `required` **somente** o que a tool realmente precisa para funcionar.

---

## 1. Tool Listar Especialidades

```json
{
  "type": "object",
  "properties": {}
}
```

---

## 2. Tool Buscar Paciente

```json
{
  "type": "object",
  "properties": {
    "telefone": {
      "type": "string",
      "description": "telefone do paciente, apenas números"
    },
    "paciente_telefone": {
      "type": "string",
      "description": "alias de telefone"
    }
  }
}
```

---

## 3. Tool Salvar Paciente

```json
{
  "type": "object",
  "properties": {
    "telefone": {
      "type": "string",
      "description": "telefone do paciente, apenas números"
    },
    "paciente_telefone": {
      "type": "string",
      "description": "alias de telefone"
    },
    "nome": {
      "type": "string",
      "description": "nome do paciente"
    },
    "paciente_nome": {
      "type": "string",
      "description": "alias de nome"
    },
    "status_sessao": {
      "type": "string",
      "description": "estado da sessão, ex: ia ou humano"
    }
  }
}
```

---

## 4. Tool Buscar Agenda

```json
{
  "type": "object",
  "properties": {
    "especialidade": {
      "type": "string",
      "description": "nome exato da especialidade"
    },
    "turno": {
      "type": "string",
      "enum": ["manha", "tarde", "noite", "qualquer"]
    },
    "dia_semana": {
      "type": "string",
      "description": "segunda, terca, quarta, quinta, sexta, sabado, domingo ou lista separada por vírgula"
    },
    "medico_id": {
      "type": "string",
      "description": "uuid do médico; opcional, usado principalmente na remarcação"
    }
  },
  "required": ["especialidade"]
}
```

---

## 5. Tool Confirmar Agendamento

Schema compatível com o fluxo novo por `id`, mas aceitando fallback antigo por `data + horario + especialidade`.

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "id do slot retornado por buscar_agenda"
    },
    "data": {
      "type": "string",
      "description": "YYYY-MM-DD"
    },
    "horario": {
      "type": "string",
      "description": "HH:MM ou HH:MM:SS"
    },
    "especialidade": {
      "type": "string"
    },
    "paciente_telefone": {
      "type": "string"
    },
    "paciente_nome": {
      "type": "string"
    }
  },
  "required": ["paciente_telefone", "paciente_nome"]
}
```

---

## 6. Tool Criar Solicitacao

```json
{
  "type": "object",
  "properties": {
    "tipo": {
      "type": "string",
      "description": "cancelamento, remarcacao, atestado, exame, receita, retorno_ligacao, financeiro ou outro"
    },
    "motivo": {
      "type": "string",
      "description": "motivo curto da solicitação"
    },
    "paciente_telefone": {
      "type": "string"
    },
    "telefone": {
      "type": "string",
      "description": "alias de paciente_telefone"
    },
    "paciente_nome": {
      "type": "string"
    },
    "nome": {
      "type": "string",
      "description": "alias de paciente_nome"
    }
  },
  "required": ["tipo"]
}
```

---

## 7. Tool Registrar Feedback

```json
{
  "type": "object",
  "properties": {
    "telefone": {
      "type": "string",
      "description": "telefone do paciente, apenas números"
    },
    "paciente_telefone": {
      "type": "string",
      "description": "alias de telefone"
    },
    "nome": {
      "type": "string"
    },
    "paciente_nome": {
      "type": "string",
      "description": "alias de nome"
    },
    "nota": {
      "type": "integer",
      "minimum": 1,
      "maximum": 5
    },
    "comentario": {
      "type": "string"
    },
    "agendamento_id": {
      "type": "string"
    }
  },
  "required": ["nota"]
}
```

---

## 8. Tool Transferir Humano

```json
{
  "type": "object",
  "properties": {
    "telefone": {
      "type": "string",
      "description": "telefone do paciente, apenas números"
    },
    "paciente_telefone": {
      "type": "string",
      "description": "alias de telefone"
    },
    "nome": {
      "type": "string"
    },
    "paciente_nome": {
      "type": "string",
      "description": "alias de nome"
    },
    "motivo": {
      "type": "string",
      "description": "motivo curto da transferência"
    }
  },
  "required": ["motivo"]
}
```

---

## 9. Tool Buscar Ultimo Agendamento

```json
{
  "type": "object",
  "properties": {
    "paciente_telefone": {
      "type": "string"
    },
    "telefone": {
      "type": "string",
      "description": "alias de paciente_telefone"
    },
    "apenas_passados": {
      "type": "boolean",
      "description": "se true, retorna apenas consultas passadas"
    }
  }
}
```

---

## 10. Tool Cancelar_agendamento

Aceita cancelamento por `id` **ou** por `telefone + data + horario`.

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "id do agendamento"
    },
    "paciente_telefone": {
      "type": "string"
    },
    "telefone": {
      "type": "string",
      "description": "alias de paciente_telefone"
    },
    "data": {
      "type": "string",
      "description": "YYYY-MM-DD"
    },
    "horario": {
      "type": "string",
      "description": "HH:MM ou HH:MM:SS"
    },
    "motivo": {
      "type": "string"
    }
  }
}
```

---

## 11. Tool Remarcar_agendamento

```json
{
  "type": "object",
  "properties": {
    "paciente_telefone": {
      "type": "string"
    },
    "telefone": {
      "type": "string",
      "description": "alias de paciente_telefone"
    },
    "agendamento_id_atual": {
      "type": "string"
    },
    "agendamento_id": {
      "type": "string",
      "description": "alias de agendamento_id_atual"
    },
    "medico_id": {
      "type": "string"
    },
    "data_consulta_nova": {
      "type": "string",
      "description": "YYYY-MM-DD"
    },
    "data": {
      "type": "string",
      "description": "alias de data_consulta_nova"
    },
    "horario_novo": {
      "type": "string",
      "description": "HH:MM ou HH:MM:SS"
    },
    "horario": {
      "type": "string",
      "description": "alias de horario_novo"
    }
  },
  "required": ["medico_id"]
}
```

---

## Ordem recomendada para corrigir no n8n

1. Buscar Agenda
2. Buscar Ultimo Agendamento
3. Confirmar Agendamento
4. Remarcar_agendamento
5. Cancelar_agendamento
6. Criar Solicitacao
7. Transferir Humano
8. Registrar Feedback
9. Salvar Paciente
10. Buscar Paciente
11. Listar Especialidades

---

## Observação importante

Em tools onde o JS aceita nomes alternativos (`telefone` e `paciente_telefone`, `nome` e `paciente_nome`, `agendamento_id` e `agendamento_id_atual`), o schema também precisa aceitar os dois. Se o campo não existir no schema, o LangChain descarta antes de chegar no JS.