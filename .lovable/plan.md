
Vou rodar uma bateria de testes end-to-end no workflow do n8n via MCP, simulando um humano de verdade, pra validar se todas as tools estão respondendo certo depois das atualizações de schema.

## Cenários de teste (como humano real)

Cada cenário usa um telefone fake diferente pra não poluir histórico de paciente real.

### Bloco 1 — Agendamento com filtros
1. **Agendar com turno + dia da semana**  
   "oi, queria marcar uma consulta com cardiologista, de preferência quinta à tarde"  
   → valida: `listar_especialidades`, `buscar_agenda(turno=tarde, dia_semana=quinta)`, `salvar_paciente`, `confirmar_agendamento` por `id`.

2. **Agendar sem preferência**  
   "quero marcar pediatra, qualquer horário tá bom"  
   → valida: Sofia ainda pergunta preferência (regra do prompt) e depois roda `buscar_agenda` sem filtro, agrupado por dia.

3. **Agendar com turno só**  
   "ginecologista, prefiro de manhã"  
   → valida: `buscar_agenda(turno=manha)` sem `dia_semana`, schema aceita campo opcional ausente.

### Bloco 2 — Pós-agendamento
4. **Buscar último agendamento + remarcar**  
   "preciso remarcar minha consulta"  
   → valida: `buscar_ultimo_agendamento` (sem `apenas_passados`), `buscar_agenda(medico_id=...)`, `remarcar_agendamento`.

5. **Cancelar consulta**  
   "quero cancelar minha consulta de amanhã"  
   → valida: `buscar_ultimo_agendamento`, `cancelar_agendamento` por `id`.

### Bloco 3 — Tools auxiliares
6. **Solicitação genérica (atestado)**  
   "preciso de um atestado da minha última consulta"  
   → valida: `criar_solicitacao(tipo=atestado)`.

7. **Feedback**  
   "quero deixar um feedback, nota 5, atendimento ótimo"  
   → valida: `registrar_feedback(nota=5)`.

8. **Transferir humano**  
   "quero falar com uma atendente humana"  
   → valida: `transferir_humano(motivo=...)`, e checar se a flag de bot pausado liga no Supabase.

## Como vou reportar

Pra cada cenário:
- **Input** enviado
- **Tools chamadas** (em ordem) + parâmetros
- **Resposta da Sofia**
- **Veredito**: PASS / FAIL / WARN com causa raiz se falhar
- Se falhar por schema, indico exatamente qual tool e qual campo precisa ajustar no n8n

No final, tabela resumo + lista de fixes pendentes (se houver).

## Observação

Isso é só execução de testes via MCP — não muda código nem documentação, a menos que algum cenário revele bug novo. Se aparecer bug novo, te aviso e proponho fix em mensagem separada.
