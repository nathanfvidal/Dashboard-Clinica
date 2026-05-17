## Objetivo

Regerar o relatório em PDF (`/mnt/documents/relatorio_piloto_v2.pdf`) usando os mesmos dados já semeados no banco, mas:

1. Sem nenhuma menção a "DDD 83", "Paraíba" ou recorte regional — tratar como "piloto de 15 pacientes convidados".
2. Estrutura/seções espelhando exatamente o que existe no Dashboard.
3. Gráficos com proporção correta (sem esticar/achatar) e tabelas sem texto cortado.

## Conteúdo do PDF (espelho do dashboard)

Mesmas seções, mesma ordem, mesmos números do `Index.tsx`:

1. **Capa** — "Relatório do piloto Sofia" + data de geração.
2. **KPIs** (4 cards, como no topo do dashboard)
   - Agendamentos hoje (+ delta vs ontem)
   - Pacientes cadastrados (+ novos nesta semana)
   - Fila humana
   - Feedback médio (+ nº de avaliações)
3. **Gráfico de agendamentos** (últimos 14 dias, espelhando `ChartAgendamentos`)
4. **Gráfico por especialidade** (espelhando `ChartEspecialidades`)
5. **Próximos agendamentos** (tabela: data, hora, paciente, médico, especialidade, status)
6. **Pacientes cadastrados** (tabela: nome, telefone, idade, status sessão, última interação)
7. **Atendimentos humanos** (tabela: paciente, motivo, início, status)
8. **Feedbacks recentes** (tabela: paciente, nota, comentário, data)
9. **Análise por faixa etária** — gargalos por idade (escalações, nota média, cancelamentos por faixa: 18-29, 30-44, 45-59, 60+)
10. **Conclusões e recomendações**

## Correções visuais

- Gráficos matplotlib com `figsize` proporcional ao slot real no PDF (largura útil ≈ 17cm) e `dpi=150`; salvar com `bbox_inches='tight'` para evitar esticamento ao inserir no ReportLab.
- Usar `Image(path, width=W, height=W*aspect)` mantendo razão de aspecto original.
- Tabelas com `colWidths` somando exatamente a largura útil da página; `wordWrap='CJK'` nas colunas de texto livre (motivo, comentário) para quebrar linhas em vez de estourar.
- Truncar comentários longos a 90 chars com reticências.
- Margens 1,8 cm; cabeçalho/rodapé com paginação.

## Mudanças textuais para remover recorte regional

- Título: "Relatório do piloto Sofia — 15 convidados de teste".
- Subtítulo da introdução: "15 pessoas convidadas receberam o número da Sofia e interagiram livremente". Sem citar DDD/UF.
- Tabela de pacientes: ocultar a coluna DDD; manter telefone completo mascarado parcialmente (ex.: `(••) •••••-1234`).

## Detalhes técnicos

- Script novo em `/tmp/report_v2.py`, lê do Supabase via REST com a anon key (já validada anteriormente).
- Bibliotecas: `reportlab`, `matplotlib` (já instalados).
- Saída: `/mnt/documents/relatorio_piloto_v2.pdf` (mantém o `_v1` original para comparação).
- QA obrigatório: `pdftoppm -jpeg -r 150` em todas as páginas, inspeção visual de cada uma; iterar até não haver overflow nem gráficos distorcidos antes de entregar.
- Não altera nenhum arquivo do projeto React — é só geração de artefato.
