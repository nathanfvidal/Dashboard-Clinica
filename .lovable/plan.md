## Correções do teste de fogo — Sofia (Clínica)

Vou atacar os 6 problemas encontrados. Divido entre o que **eu corrijo direto** (Supabase + dashboard) e o que **precisa ser ajustado no n8n** (prompt do AI Agent Sofia e nó da tool de cancelamento — só você consegue editar pelo editor, eu só leio via MCP).

---

### O que eu corrijo agora (Supabase + código)

**1. P2 — Agenda sem pausa de almoço**
Migration para reescrever os `horarios_medico` de todos os médicos ativos: cada faixa de manhã 08:00–12:00 e tarde 14:00–18:00, em vez de 08:00–18:00 corrido. Slots de 12:00, 12:30 e 13:30 deixam de existir.

**2. P2 — Remarcação apaga histórico**
Hoje a função do dashboard (`RemarcarAgendamentoDialog`) sobrescreve o slot antigo com `status='disponivel'`, perdendo o registro. Vou:
- Criar função SQL `remarcar_agendamento(p_antigo uuid, p_novo uuid)` que faz, atomicamente:
  - INSERT histórico do antigo como `status='remarcado'` (mantendo paciente)
  - UPDATE antigo → `disponivel` (libera slot)
  - UPDATE novo → `confirmado` com dados do paciente
- Refatorar `RemarcarAgendamentoDialog.tsx` para chamar essa RPC em vez de 2 updates soltos.
- Mesma função fica disponível para a Sofia chamar via `Tool Remarcar_agendamento` no n8n.

**3. Apoio ao P0 (cancelamento)** — adicionar/garantir índice em `agendamentos(paciente_telefone, status)` para a Sofia conseguir achar o agendamento ativo rapidamente. Confirmar que existe `status='cancelado'` válido (já existe).

---

### O que você precisa ajustar no n8n (te dou o passo-a-passo exato)

Não consigo editar o workflow via MCP — só ler/executar. Mas te entrego o conteúdo pronto pra colar.

**4. P0 — `Tool Cancelar_agendamento` quebrada + vazamento de trace**
- Abrir o nó **`Tool Cancelar_agendamento`** (HTTP Request tool). Validar o PATCH para Supabase:
  - URL: `{{$env.SUPABASE_URL}}/rest/v1/agendamentos?id=eq.{{ $fromAI('id') }}`
  - Body: `{"status":"cancelado","paciente_telefone":"disponivel","paciente_nome":null}`
  - Headers `apikey` + `Authorization: Bearer SERVICE_ROLE` + `Prefer: return=representation`
- No nó **`AI Agent Sofia`** → Options → ativar `Return Intermediate Steps: false` e `Pass Through Tool Errors: false`. Isso bloqueia o `Calling Tool ... with input: {...}` vazando para o paciente.

**5. P1 — Remarcar pergunta "para você ou outra pessoa?"**
No `systemMessage` do AI Agent Sofia, no bloco do fluxo REMARCAR, remover o passo de perguntar "pra quem é" e substituir por: chamar `Tool Buscar Ultimo Agendamento` primeiro e listar os agendamentos ativos do telefone para o paciente escolher.

**6. P1 — Saudação por horário desligada**
No `systemMessage`, injetar variável de hora SP no topo:
```
Hora atual (São Paulo): {{ $now.setZone('America/Sao_Paulo').toFormat('HH:mm') }}
Use "Bom dia" antes das 12h, "Boa tarde" 12-18h, "Boa noite" depois.
```

**7. P2 — Pedido redundante de consentimento de número**
No `systemMessage`, regra: "Se `paciente.telefone` já está salvo e bate com o do contato, NÃO peça confirmação de número. Pergunte apenas uma vez na primeira interação."

---

### Entregáveis

```text
[migration]   horarios_medico → pausa almoço + função remarcar_agendamento + índice
[código]      RemarcarAgendamentoDialog.tsx usa RPC remarcar_agendamento
[doc]         arquivo .lovable/n8n-fixes.md com os 4 ajustes prontos pra colar
```

Depois de aplicar tudo, rodo o teste de fogo de novo nos cenários 3, 4, 5, 6 e 7 que ficaram pendentes e te entrego o relatório final.