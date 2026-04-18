DO $$
DECLARE
  med record;
BEGIN
  FOR med IN SELECT id FROM public.medicos WHERE ativo = true LOOP
    PERFORM public.gerar_agenda_mes(med.id, CURRENT_DATE, (CURRENT_DATE + 30)::date);
  END LOOP;
END $$;