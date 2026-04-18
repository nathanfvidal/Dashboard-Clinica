-- 1) Criar médicos faltantes (idempotente: só insere se não existir CRM)
INSERT INTO public.medicos (nome, crm, especialidade_id, ativo)
SELECT * FROM (VALUES
  ('Dr. Marcos Oliveira', 'CRM-PB 11111', 'e22c8548-4260-4abd-9dee-fc0e7015a289'::uuid, true),
  ('Dra. Juliana Costa',  'CRM-PB 22222', '88289116-d473-4fc9-863c-34aeecee9f55'::uuid, true),
  ('Dr. Rafael Lima',     'CRM-PB 33333', 'ca20ce4c-ef3b-4285-8792-57915ff55ac2'::uuid, true),
  ('Dra. Beatriz Souza',  'CRM-PB 44444', 'c9ef2a7e-4540-42db-ada6-ce20d055188a'::uuid, true)
) AS v(nome, crm, especialidade_id, ativo)
WHERE NOT EXISTS (SELECT 1 FROM public.medicos m WHERE m.crm = v.crm);

-- 2) Horários padrão para todo médico ativo sem horários
INSERT INTO public.horarios_medico (medico_id, dia_semana, hora_inicio, hora_fim, duracao_consulta_min, ativo)
SELECT m.id, dia, hi, hf, 30, true
FROM public.medicos m
CROSS JOIN (VALUES (1),(2),(3),(4),(5)) AS d(dia)
CROSS JOIN (VALUES ('08:00'::time, '12:00'::time), ('14:00'::time, '18:00'::time)) AS t(hi, hf)
WHERE m.ativo = true
  AND NOT EXISTS (SELECT 1 FROM public.horarios_medico h WHERE h.medico_id = m.id);

-- 3) Gerar agenda dos próximos 30 dias para médicos sem slots futuros
DO $$
DECLARE med record;
BEGIN
  FOR med IN
    SELECT m.id FROM public.medicos m
    WHERE m.ativo = true
      AND NOT EXISTS (
        SELECT 1 FROM public.agendamentos a
        WHERE a.medico_id = m.id AND a.data_consulta >= CURRENT_DATE
      )
  LOOP
    PERFORM public.gerar_agenda_mes(med.id, CURRENT_DATE, (CURRENT_DATE + 30)::date);
  END LOOP;
END $$;