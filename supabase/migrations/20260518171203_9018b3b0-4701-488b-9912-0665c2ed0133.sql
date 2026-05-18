DO $$
DECLARE m record;
BEGIN
  FOR m IN SELECT id FROM public.medicos WHERE ativo = true LOOP
    PERFORM public.gerar_agenda_mes(m.id, CURRENT_DATE::date, (CURRENT_DATE + INTERVAL '60 days')::date);
  END LOOP;
END $$;