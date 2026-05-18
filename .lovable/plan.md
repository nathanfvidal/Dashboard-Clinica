# Plano — Ajustes Sofia + Agenda

Quatro problemas relatados, todos no workflow n8n + dados de agenda no Supabase. Nada de mudança no app React.

## 1. Boas-vindas mais humana (sem ir direto para "confirmar nome")

Hoje a primeira mensagem do bot é `"Só para confirmar, vou agendar para Nathan. Está correto?"` — frio, presume agendamento e ignora cumprimento.

Reescrever o bloco **PRIMEIRO CONTATO** do `systemMessage` do nó **AI Agent Sofia** para seguir esta ordem:

1. Saudação contextual por horário (bom dia/boa tarde/boa noite — derivar do horário de Brasília).
2. Se `buscar_paciente` retornar nome cadastrado → cumprimentar pelo nome ("Oi, Nathan! Boa tarde 👋") e **já mostrar o menu de opções** sem assumir agendamento.
3. Se não houver nome → cumprimentar genericamente, perguntar o nome, salvar e então menu.
4. **Remover** a frase "Só para confirmar, vou agendar para [Nome]" — ela só deve aparecer DENTRO do fluxo de agendamento (passo 9a), não na abertura.
5. Consentimento de número mascarado: manter, mas só enviar na **primeira mensagem da sessão** junto da saudação, não como bloco separado depois.

## 2. Não pedir nome novamente quando já reconhecido

O passo **3 — PARA QUEM É O ATENDIMENTO** sempre pergunta "Qual o seu nome completo?" mesmo quando `buscar_paciente` já retornou o nome.

Ajustar a lógica:
- Se `paciente_ja_cadastrado=true` E opção escolhida = "para mim" → **não perguntar nome**, usar o já cadastrado e seguir.
- Só perguntar nome quando: paciente novo, OU escolheu "para outra pessoa", OU pediu para corrigir.

## 3. Texto do "Tipo de consulta" enviesado para primeira vez

Hoje:
> "1. Consulta — primeira vez com esse médico/especialidade
> 2. Retorno — consulta de acompanhamento já agendada anteriormente"

Reescrever para neutralizar (paciente pode estar marcando segunda, terceira consulta com o mesmo médico sem ser "retorno formal"):

```
🗂️ Qual o tipo dessa consulta?

1️⃣ Consulta — avaliação nova ou acompanhamento de rotina
2️⃣ Retorno — revisão de uma consulta recente (geralmente até 30 dias)

Qual desses encaixa? 👇
```

## 4. Dúvidas financeiras — fluxo dedicado

Hoje a opção 5 do menu cai direto na tool `criar_solicitacao` genérica. Substituir por um sub-fluxo no prompt:

```
💰 Posso te ajudar com:
1️⃣ Valor de consulta particular
2️⃣ Convênios aceitos
3️⃣ Formas de pagamento (PIX, cartão, parcelamento)
4️⃣ 2ª via de recibo / nota fiscal
5️⃣ Outro assunto financeiro
```

- Opções 1-3: responder com texto estático da clínica (a definir com o cliente — colocar placeholder no prompt indicando "preencher conforme tabela da clínica").
- Opções 4-5: criar `solicitacao` com `tipo=financeiro` e `motivo` específico → recepção retorna.

## 5. Gerar agenda real (problema crítico — 0 vagas hoje)

Consulta ao Supabase mostra **zero slots `disponivel`** em todas as 6 especialidades. Por isso a Sofia nunca encontra horário.

Causa: `gerar_agenda_mes` nunca foi rodado para o período atual/futuro.

Ação: criar migration que executa `gerar_agenda_mes` para **todos os médicos ativos** cobrindo de hoje até daqui a 60 dias. SQL:

```sql
DO $$
DECLARE m record;
BEGIN
  FOR m IN SELECT id FROM medicos WHERE ativo = true LOOP
    PERFORM gerar_agenda_mes(m.id, CURRENT_DATE, CURRENT_DATE + INTERVAL '60 days');
  END LOOP;
END $$;
```

Pré-requisito: garantir que todos os médicos ativos têm linhas em `horarios_medico`. Verificar e, se algum não tiver, inserir template padrão (seg-sex 08-18, sáb 08-12, slots de 30 min) antes de chamar `gerar_agenda_mes`.

## Resumo das entregas

```text
[1] Atualizar systemMessage no nó "AI Agent Sofia" do workflow n8n:
    - Saudação contextual + menu na abertura
    - Pular pergunta de nome quando já cadastrado
    - Reescrever tipo de consulta
    - Adicionar sub-fluxo financeiro
[2] Migration Supabase:
    - Garantir horarios_medico para todos ativos
    - Rodar gerar_agenda_mes para próximos 60 dias
[3] Validar: nova mensagem "oi" → resposta com bom dia + menu;
    consulta a buscar_agenda retorna horários reais.
```

## Detalhes técnicos

- O workflow n8n é editado via MCP `mcp_n8n_eJdzs` (workflow "Atendimento - Clinica Medica (IA First)", id `eqqEnl042R9NZN_UWToot`).
- Saudação por horário: usar `{{ $now.setZone('America/Sao_Paulo').hour }}` na expressão que monta o `text` do agent ou deixar a regra no systemMessage instruindo a IA a derivar do timestamp injetado.
- Variável `paciente_ja_cadastrado` já é passada no `text` do agente — basta o prompt usá-la como condição.
- Migration roda via tool `supabase--migration`; idempotente porque `gerar_agenda_mes` não duplica slots existentes.
