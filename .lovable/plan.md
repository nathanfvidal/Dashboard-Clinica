

## Plano: Sincronizar n8n com o sistema atual

### Diagnóstico

Comparei o workflow `Atendimento - Clinica Medica (IA First)` (id `eqqEnl042R9NZN_UWToot`, atualizado 18/04) com o estado atual do app/banco. Encontrei **6 lacunas** que precisam ser corrigidas no n8n:

| # | Problema no n8n hoje | Impacto |
|---|----------------------|---------|
| 1 | `Tool Buscar Agenda` tem `espMap` hardcoded com 6 especialidades | Especialidades novas cadastradas em `/cadastros` não funcionam |
| 2 | `Tool Buscar Agenda por Periodo` mesma coisa | Idem |
| 3 | `Tool Confirmar Agendamento` faz INSERT novo em vez de UPDATE no slot `disponivel` | Quebra a lógica do botão "Gerar agenda" — slots gerados nunca somem |
| 4 | `Tool Listar Especialidades` (verificar) — pode estar com lista fixa | Sofia oferece especialidades inexistentes |
| 5 | Falta `Tool Registrar Feedback` | Botão pronto no app mas sem coleta via WhatsApp |
| 6 | System prompt da Sofia tem **emojis** (🩺❤️🌿🌸🦴👶📅✅💙😊🚨) e lista fixa de especialidades | Viola regra "nunca emoji"; Sofia mente sobre especialidades |

### O que vou entregar

Um único documento consolidado **`docs/n8n-atualizacoes-completas.md`** contendo, para cada uma das 6 mudanças:

1. **Nome exato do node** no editor n8n
2. **Onde clicar** (passo a passo)
3. **Código JS completo, pronto pra colar** (não trechos parciais)
4. **Input schema JSON completo** quando aplicável
5. **System prompt da Sofia 100% reescrito** sem emojis e sem lista fixa de especialidades, com instrução de feedback ao final do atendimento

Os dois `.md` antigos (`n8n-integracao-cadastros.md` e `n8n-tool-registrar-feedback.md`) serão substituídos por esse documento único, mais completo e consistente com o código atual do app (status `ia`/`humano`, ícones Lucide, comando `/bot`, etc).

### Estrutura do documento

```text
docs/n8n-atualizacoes-completas.md
├── 0. Visão geral + ordem recomendada de aplicação
├── 1. Tool Listar Especialidades (jsCode completo)
├── 2. Tool Buscar Agenda (jsCode completo, sem espMap)
├── 3. Tool Buscar Agenda por Periodo (jsCode completo, com filtro turno)
├── 4. Tool Confirmar Agendamento (jsCode completo, UPDATE do slot)
├── 5. Tool Registrar Feedback (criar do zero — code + schema + posição)
├── 6. AI Agent Sofia — system prompt reescrito (sem emojis, sem lista fixa)
├── 7. Checklist de validação end-to-end
└── 8. Tabela resumo (tool → mudança → motivo)
```

### Pontos técnicos importantes que vão entrar no doc

- **Status sessão**: confirmar uso de `'ia'` (ativo) e `'humano'` (pausado) — alinhado com `ListaAtendimentos.tsx` e `useAlertaBotPausado.ts`
- **Slots `disponivel`**: gerados por `gerar_agenda_mes()` no Supabase; `confirmar_agendamento` deve fazer `PATCH` mudando para `confirmado` em vez de criar novo registro
- **System prompt sem emojis**: substituir todos os 🏥📅✅💙😊🚨 por marcadores textuais (ex: `[ATENÇÃO]`, `*Resumo:*`, `*Confirmado*`) — compatível com WhatsApp que não renderiza Lucide
- **Feedback**: após `confirmar_agendamento` ou despedida, Sofia pergunta nota 1-5 e chama `registrar_feedback`
- **Anon key**: continua sendo a mesma (`eyJhbGc...Nyz1YI8`) — não vou expor service role

### Arquivos do app

**Nenhuma mudança no código React** nesta tarefa. É só documentação/n8n. O app já está pronto para receber os dados corretos.

### Não vou fazer

- Editar o workflow n8n diretamente (MCP do n8n não permite edição, só leitura/execução — confirmado nas tentativas anteriores). Tudo é manual seguindo o `.md`.
- Criar autenticação ou roles novos.
- Mudar o schema do banco.

