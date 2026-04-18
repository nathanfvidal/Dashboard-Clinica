# n8n v5 — correção do bug "não agenda nada"

Arquivo importável: `/mnt/documents/Atendimento_-_Clinica_Medica_IA_First_v5.json`

## Causa raiz encontrada (auditoria via MCP)

Reproduzimos o fluxo no MCP enviando "Quero agendar pediatria". O webhook foi processado, o paciente foi resolvido, o IF roteou corretamente — e então o nó **`Log Mensagem In`** retornou:

```
400 - "new row for relation \"mensagens\" violates check constraint \"mensagens_tipo_check\""
```

A constraint do banco aceita: `texto | audio | imagem | sistema`.

O nó `Log Mensagem In` envia `"tipo": "{{ $json.tipo }}"`, mas o nó imediatamente anterior — **`Verificar se Bot Ativo`** — descartava o campo `tipo` ao montar o objeto de saída, então o INSERT ia com `tipo=""`, violando o CHECK e abortando o restante do fluxo.

Resultado prático: o `AI Agent Sofia` **nunca era executado**, então nenhuma tool de agenda era chamada. Daí o sintoma "não acha médico, não acha horário, não agenda nada".

## Correção aplicada no v5

Único nó alterado: **`Verificar se Bot Ativo`** (jsCode).
Agora propaga `tipo` (default `'texto'`) e `messageId`:

```js
const tipo = dadosMensagem.tipo || 'texto';
const messageId = dadosMensagem.messageId || '';
return [{ json: { telefone, mensagem, remoteJid, pushName, tipo, messageId,
                  nome, paciente_existe, status_sessao } }];
```

Tudo o mais (system message da Sofia com a regra de chamar `listar_especialidades` antes, schemas das 9 tools com `jsonSchemaExample`, normalização NFD, fallback de especialidades, sessionKey por janela de 6h, 3 crons) já estava correto no v3 ativo — não precisou mexer.

## Como aplicar

1. Em https://n8n.nateksoft.com/ abrir `Atendimento - Clinica Medica (IA First) v3` → **Settings → Deactivate**.
2. Menu superior → **Import from File** → selecionar `Atendimento_-_Clinica_Medica_IA_First_v5.json`.
3. Antes de ativar:
   - Reabrir o nó **`Extrair Dados da Mensagem`** e colar a Groq key no `Bearer COLE_SUA_GROQ_KEY_AQUI` (obrigatório só pra áudio).
   - Conferir credencial do `Google Gemini Chat Model`.
4. **Settings → Activate**.
5. Mandar "quero pediatria" no WhatsApp de teste e validar:
   - linha em `mensagens` com `direcao='in', tipo='texto'`;
   - Sofia chama `listar_especialidades` → `buscar_agenda` → oferece horários reais;
   - escolher horário → `confirmar_agendamento` → slot vira `confirmado` no banco.

## SQL de validação rápida

```sql
-- mensagens dos últimos minutos
SELECT direcao, tipo, agente, conteudo, created_at
FROM mensagens ORDER BY created_at DESC LIMIT 20;

-- slots disponíveis por especialidade
SELECT e.nome, COUNT(*) FROM agendamentos a
JOIN especialidades e ON e.id = a.especialidade_id
WHERE a.status='disponivel' AND a.data_consulta >= CURRENT_DATE
GROUP BY e.nome ORDER BY e.nome;
```
