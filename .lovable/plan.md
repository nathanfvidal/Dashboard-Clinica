# Teste de Fogo — Fluxo Sofia (Clínica)

Vou simular dois perfis de paciente disparando mensagens reais no webhook `https://n8n.nateksoft.com/webhook/clinica-webhook` e observando `mensagens`, `pacientes`, `agendamentos`, `solicitacoes` e `atendimentos_humanos` no Supabase entre cada passo. Cada turno espera ~4s pela resposta antes do próximo envio.

## Perfis

**A — "Ana, paciente esperta"** (telefone `5583999915242`)
Responde rápido, usa números do menu, formato de data correto, sabe o que quer.

**B — "Sr. Joaquim, leigo"** (telefone de teste alternativo `5583988887777`)
Erra digitação, manda áudio-texto longo ("oi minha filha, queria marcar um negócio com o doutor do coração"), responde por extenso ("primeira opção"), troca de ideia no meio, pergunta preço, pede pra falar com humano.

## Roteiros

### Cenário 1 — Ana agenda consulta (happy path)
1. "Oi" → saudação + menu
2. "Ana Souza" (se pedir nome)
3. "1" (agendar)
4. "1" (para mim)
5. Escolhe especialidade → médico → data → horário
6. "1" (consulta) → confirma
7. Verificar: linha em `agendamentos` com status `confirmado`, slot original marcado, mensagem de confirmação

### Cenário 2 — Ana remarca
1. "Oi" → menu (deve reconhecer nome, sem repetir cadastro)
2. "2" (remarcar) → seleciona consulta → novo horário → confirma
3. Verificar: agendamento antigo liberado, novo criado

### Cenário 3 — Ana cancela
1. "Oi" → "3" (cancelar) → seleciona → confirma
2. Verificar: status `cancelado`, slot volta a `disponivel`

### Cenário 4 — Sr. Joaquim (leigo) primeiro contato
1. "boa tarde minha filha" → saudação contextual
2. "Joaquim Pereira da Silva" (nome longo com acento)
3. "queria marcar uma consulta" (texto livre, não número)
4. "cardiologia" (extenso)
5. Erra data: "amanhã" → ver se Sofia interpreta ou pede formato
6. "manhã cedo" → ver se Sofia oferece horários
7. Confirma

### Cenário 5 — Joaquim pergunta financeiro
1. "Oi" → "quanto custa a consulta?"
2. Verificar sub-fluxo financeiro (opções 1-5) — se ainda não implementado, marcar como gargalo

### Cenário 6 — Joaquim pede humano
1. "Oi" → "quero falar com uma pessoa"
2. Verificar: linha em `atendimentos_humanos` com `status=aguardando`, bot pausa

### Cenário 7 — Edge cases
- Mensagem vazia / só emoji
- Número inválido no menu ("99")
- Sai do fluxo no meio ("deixa pra lá") → Sofia deve voltar ao menu
- Duas mensagens rápidas seguidas → ver se duplica resposta
- "oi" depois de 1h → ver se reinicia ou continua sessão

## Coleta de gargalos

Para cada cenário registro em tabela:
- ✅ funcionou / ⚠️ feio mas funcionou / ❌ travou
- Tempo de resposta
- Mensagem da Sofia (qualidade do texto)
- Estado correto no DB
- Sugestão de fix (ajuste de prompt no n8n, função SQL, validação)

## Entrega final

Relatório consolidado com:
1. Tabela resumo dos 7 cenários
2. Lista priorizada de problemas (P0 quebra fluxo / P1 UX ruim / P2 polimento)
3. Para cada P0/P1: causa raiz + fix proposto (prompt no `AI Agent Sofia`, nova tool, migration, etc.)
4. Recomendação se algum problema requer alteração no workflow n8n via MCP

Antes de rodar: limpo dados de teste dos dois telefones para começar do zero.
