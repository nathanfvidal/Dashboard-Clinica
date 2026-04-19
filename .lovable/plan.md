

## Entendi

Hoje a Sofia chama `buscar_agenda` que retorna os 20 primeiros slots crus, e como cada médico tem ~16 slots por dia, dá só o primeiro dia inteiro de um médico. O paciente vê 5 horários da segunda de manhã e acha que "só tem isso".

Você quer:

1. **Sofia SEMPRE pergunta primeiro** (antes de chamar a tool de agenda):
   "Tem preferência de turno (manhã/tarde) ou dia da semana?"
2. Se o paciente disser uma preferência → tool já filtra.
3. Se o paciente disser "tanto faz" / não responder → tool retorna **agrupado por dia**, mostrando os dias da semana disponíveis e os horários de cada um (não a lista crua de 20 itens em ordem).
4. Janela: próximos **15 dias**.

---

## 1. Refazer o nó `Tool Buscar Agenda` no n8n

Padrão TDZ v10 (igual ao que já funciona). Mudanças:

- `limit` 20 → **300** (15 dias × 16 slots × até ~1 médico cabem com folga)
- Janela: hoje + **15 dias** (`data_consulta` entre hoje e hoje+15)
- Novos parâmetros opcionais:
  - `turno`: `"manha"` | `"tarde"` | `"noite"` | `"qualquer"`
  - `dia_semana`: número 0-6 OU string em pt (`"segunda"`, `"terca"`, ...) — aceita lista também (`"terca,quinta"`)
  - `medico_id`: filtra um médico específico (útil pra remarcação)
- Retorno **agrupado por dia**:
  ```json
  {
    "success": true,
    "especialidade": "Cardiologia",
    "filtros": { "turno": "tarde", "dia_semana": null },
    "total": 23,
    "dias": [
      {
        "data": "2026-04-22",
        "data_br": "22/04",
        "dia_semana": "terça",
        "medico": "Dr. Carlos",
        "horarios": ["14:00","14:30","15:00","15:30","16:00"],
        "mais": 0
      }
    ]
  }
  ```
- Cada dia traz no máximo **6 horários** por médico (resto vira `mais: N`), pra resposta caber bem no WhatsApp.

A `Tool Buscar Agenda por Periodo` vira redundante — vou marcar como deprecada na descrição (não removo pra não quebrar histórico do AI Agent), só atualizo o texto pra Sofia parar de preferir ela.

## 2. Atualizar o system prompt da Sofia

Substituir o bloco **FLUXO DE AGENDAMENTO** pelo abaixo:

```
FLUXO DE AGENDAMENTO
1. Entenda o pedido.
2. Chame listar_especialidades.
3. Ajude o paciente a escolher uma especialidade válida.
4. ANTES de chamar buscar_agenda, SEMPRE pergunte preferências:
   "Tem preferência de turno (manhã ou tarde) ou de algum dia da
    semana (ex.: terça, quinta)? Se for indiferente, é só dizer."
5. Quando ele responder:
   - Com preferência → chame buscar_agenda(especialidade, turno, dia_semana).
   - Sem preferência ("tanto faz", "qualquer", "indiferente")
     → chame buscar_agenda(especialidade) sem turno nem dia.
6. A tool já volta agrupada por dia. Mostre no formato:
   📅 Terça 22/04 — Dr. Carlos
      14:00, 14:30, 15:00, 15:30
   📅 Quinta 24/04 — Dr. Carlos
      09:00, 09:30
   (até 4 dias por mensagem; se total for muito alto e ainda
    não filtrou, sugira refinar: "se preferir um dia ou turno
    específico, me avisa que filtro pra você")
7. Quando o paciente escolher um horário, recapitule e siga
   pra confirmar_agendamento como antes.
```

E o bloco **REMARCAÇÃO** ganha a mesma instrução: pergunta preferência antes de chamar `buscar_agenda` filtrando por `medico_id` do agendamento atual.

## 3. Teste prático

Como a tool agora vai ter o mesmo formato bonito de retorno, vou rodar 3 cenários via MCP pra confirmar:

| # | Pergunta | Esperado |
|---|---|---|
| 1 | "queria marcar cardiologista" | Sofia pergunta preferência primeiro, **não** chama buscar_agenda |
| 2 | "prefiro terça de tarde" | Sofia chama buscar_agenda(turno=tarde, dia_semana=terca), retorna só terças à tarde dos próximos 15 dias |
| 3 | "tanto faz" | Sofia chama buscar_agenda sem filtro, retorna agrupado por dia |

Resultado em `docs/n8n-buscar-agenda-v2.md`.

## Arquivos / sistemas afetados

| Onde | Mudança |
|---|---|
| n8n — nó **Tool Buscar Agenda** | Reescrever jsCode (filtros + agrupado) — código pronto pra colar em `docs/n8n-buscar-agenda-v2.md` |
| n8n — system prompt da Sofia | Substituir bloco FLUXO DE AGENDAMENTO + ajuste no REMARCAÇÃO |
| n8n — nó **Tool Buscar Agenda por Periodo** | Marcar como deprecada na description |
| `docs/n8n-buscar-agenda-v2.md` (novo) | Código TDZ pronto + prompt novo + relatório dos 3 testes |

Nenhum arquivo do app React muda. Nenhuma migração no banco.

## Perguntas
Nenhuma. Aprovou, eu rodo.

