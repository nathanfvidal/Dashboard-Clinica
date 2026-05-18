
-- 1. Pausa de almoço: reescreve horários "corridos" (>= 6h sem pausa) em duas faixas
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT id, hora_inicio, hora_fim, duracao_consulta_min, medico_id, dia_semana, ativo
    FROM public.horarios_medico
    WHERE ativo = true
      AND hora_inicio <= '12:00'::time
      AND hora_fim   >= '14:00'::time
  LOOP
    -- vira faixa da manhã
    UPDATE public.horarios_medico
       SET hora_inicio = '08:00', hora_fim = '12:00'
     WHERE id = r.id;
    -- cria faixa da tarde
    INSERT INTO public.horarios_medico(medico_id, dia_semana, hora_inicio, hora_fim, duracao_consulta_min, ativo)
    VALUES (r.medico_id, r.dia_semana, '14:00', '18:00', r.duracao_consulta_min, true);
  END LOOP;
END$$;

-- 2. Função de remarcação atômica preservando histórico
CREATE OR REPLACE FUNCTION public.remarcar_agendamento(p_antigo uuid, p_novo uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_antigo record;
  v_novo record;
BEGIN
  SELECT * INTO v_antigo FROM public.agendamentos WHERE id = p_antigo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento antigo % não encontrado', p_antigo; END IF;

  SELECT * INTO v_novo FROM public.agendamentos WHERE id = p_novo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Slot novo % não encontrado', p_novo; END IF;
  IF COALESCE(v_novo.status,'') <> 'disponivel' THEN
    RAISE EXCEPTION 'Slot % já está ocupado (status=%)', p_novo, v_novo.status;
  END IF;

  -- guarda histórico do antigo
  INSERT INTO public.agendamentos(
    especialidade, medico, data_consulta, horario,
    paciente_telefone, paciente_nome, status, medico_id, especialidade_id
  ) VALUES (
    v_antigo.especialidade, v_antigo.medico, v_antigo.data_consulta, v_antigo.horario,
    v_antigo.paciente_telefone, v_antigo.paciente_nome, 'remarcado',
    v_antigo.medico_id, v_antigo.especialidade_id
  );

  -- libera slot antigo
  UPDATE public.agendamentos
     SET status='disponivel', paciente_telefone='disponivel', paciente_nome=NULL,
         feedback_solicitado_at=NULL, lembrete_2h_enviado_at=NULL, lembrete_d1_enviado_at=NULL
   WHERE id = p_antigo;

  -- ocupa o novo
  UPDATE public.agendamentos
     SET status='confirmado',
         paciente_telefone=v_antigo.paciente_telefone,
         paciente_nome=v_antigo.paciente_nome
   WHERE id = p_novo;

  RETURN p_novo;
END$$;

-- 3. Índice para buscas da Sofia
CREATE INDEX IF NOT EXISTS idx_agendamentos_telefone_status
  ON public.agendamentos(paciente_telefone, status);
