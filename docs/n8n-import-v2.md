# n8n — Import do workflow v2 (Sprints 1+2+3 aplicadas)

Arquivo: `Atendimento_-_Clinica_Medica_IA_First_v2.json`
(disponível em `/mnt/documents/`)

---

## 1. Como importar

1. Abra https://n8n.nateksoft.com/
2. Workflow atual `Atendimento - Clinica Medica (IA First)` → **Settings → Deactivate**
   (mantém o original como backup; não delete ainda).
3. Menu superior → **Import from File** → selecione o JSON v2.
4. Salve com nome `Atendimento - Clinica Medica (IA First v2)`.
5. **Cole a Groq key** (ver passo 2 abaixo) antes de ativar.
6. **Activate** o v2.
7. Após validar (ver passo 3), pode arquivar o workflow antigo.

---

## 2. Substituir a Groq API key

O nó **`Extrair Dados da Mensagem`** tem 1 placeholder:

```js
Authorization: 'Bearer COLE_SUA_GROQ_KEY_AQUI'
```

Pegue a chave em https://console.groq.com/keys e substitua direto no campo **JS Code** do nó.
Modelo usado: `whisper-large-v3` (rápido + ótimo em PT-BR, gratuito até a cota).

---

## 3. O que mudou em relação ao original

### Fluxo principal (Webhook)

```
Webhook → Extrair (texto OU áudio Groq) → Buscar Paciente → Verificar Bot Ativo
  → IF Bot Ativo?
      ├── true  → Log Mensagem In → Update Atividade Bot → Digitando…
      │            → AI Agent Sofia → Consolidar → Enviar → Log Mensagem Out
      └── false → Log Mensagem Humano (fim — bot não responde)
```

### AI Agent — novas tools

| Tool                    | Quando a Sofia chama                                                |
| ----------------------- | ------------------------------------------------------------------- |
| `transferir_humano`     | Pedido explícito de humano, reclamação grave, urgência não-emergência. Notifica admin `5583999915242`, marca `pacientes.status_sessao='humano'`, registra em `atendimentos_humanos` e `mensagens`. |
| `criar_solicitacao`     | Remarcar / cancelar / atestado / exame / receita / retorno_ligacao / financeiro / outro. Insere em `solicitacoes`. (Substitui `Tool Cancelar Remarcar`.) |
| `registrar_feedback`    | Já existia — agora com `inputSchema` correto.                       |

### Memória

`Window Buffer Memory.sessionKey` agora é **dinâmico por janela de 6h**:
`{telefone}_{bucket_6h}`. Após 6h sem interação, a Sofia começa do zero (memória limpa, paciente continua o mesmo no Supabase).

### 3 Schedule Triggers (mesmo workflow)

| Cron                          | Quando        | O que faz                                                  |
| ----------------------------- | ------------- | ---------------------------------------------------------- |
| `Cron 08h Lembrete D-1`       | 08h00 diário  | Manda lembrete pra consultas de amanhã, marca `lembrete_d1_enviado_at`. |
| `Cron */30 Lembrete T-2h`     | A cada 30 min | Manda lembrete 2h antes da consulta, marca `lembrete_2h_enviado_at`.    |
| `Cron 19h Pesquisa Satisfacao`| 19h00 diário  | Pede nota 1-5 das consultas de hoje, marca `feedback_solicitado_at`. A resposta cai no fluxo principal e a Sofia chama `registrar_feedback`. |

Cada cron tem nó **Calcular Janela** (Code) que monta as datas em horário de Brasília (UTC-3).

---

## 4. Ordem de teste recomendada

| # | Ação                                                                 | Esperado                                                                 |
| - | -------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1 | Manda "oi" no WhatsApp                                               | Sofia responde normalmente. Linha em `mensagens` com `direcao='in'` e `'out'`. `pacientes.ultima_atividade_bot` atualizada. |
| 2 | Manda nota de voz curta ("oi quero marcar dermato")                  | Mensagem chega no AI Agent prefixada com `🎙️ (áudio):`. Sofia responde como texto. |
| 3 | Diz "quero falar com humano"                                         | Sofia chama `transferir_humano`. Linha em `atendimentos_humanos`, `pacientes.status_sessao='humano'`, WhatsApp pro `5583999915242`. |
| 4 | Manda outra mensagem (paciente em modo humano)                       | Sofia **NÃO responde**. Linha em `mensagens` com `agente='humano'`.      |
| 5 | No próprio WhatsApp da clínica, envia `/bot` para esse número        | Bot reativa (a próxima mensagem do paciente passa pelo agente).          |
| 6 | Diz "quero remarcar minha consulta de quinta"                        | Sofia chama `criar_solicitacao` com `tipo='remarcar'`. Linha em `solicitacoes`. |
| 7 | No editor do n8n, **Execute Workflow** no `Cron 08h Lembrete D-1`    | Manda lembrete pra agendamento de teste de amanhã, marca `lembrete_d1_enviado_at`. Rodar 2x: na 2ª não envia (idempotência). |
| 8 | Idem para `Cron */30` (criar agendamento daqui ~2h) e `Cron 19h`      | Mensagens enviadas, campos `lembrete_2h_enviado_at` / `feedback_solicitado_at` preenchidos. |

### SQL útil

```sql
-- conversa do paciente
SELECT direcao, tipo, agente, conteudo, created_at
FROM mensagens
WHERE paciente_telefone = '5583999999999'
ORDER BY created_at DESC LIMIT 30;

-- handoffs abertos
SELECT * FROM atendimentos_humanos WHERE status='aguardando' ORDER BY created_at DESC;

-- fila de solicitações
SELECT tipo, motivo, status, created_at FROM solicitacoes
WHERE status='pendente' ORDER BY created_at DESC;
```

---

## 5. Riscos / observações

- **Crons no mesmo workflow**: desativar o workflow para manutenção pausa os 3 crons junto com o atendimento. Se isso virar um problema, fácil quebrar em workflows separados depois.
- **Filtro T-2h**: usa comparação lexicográfica de `time` (HH:MM:SS) — funciona, mas não cobre virada de dia. A clínica fecha 18h, então é seguro pro MVP.
- **Tabela `solicitacoes`** não tem `data_agendada` — a tool antiga gravava esse campo e provavelmente falhava silenciosamente. Corrigido.
- **Áudio**: usa `this.helpers.httpRequest` dentro do Code node. O Groq Whisper aceita ogg/opus do WhatsApp direto, sem conversão.
