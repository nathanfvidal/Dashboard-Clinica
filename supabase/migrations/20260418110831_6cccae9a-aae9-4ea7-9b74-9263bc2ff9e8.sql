-- ============================================
-- 1. Tabela de especialidades
-- ============================================
CREATE TABLE public.especialidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  descricao text,
  icone text DEFAULT '🩺',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.especialidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública de especialidades" ON public.especialidades FOR SELECT USING (true);
CREATE POLICY "Inserção pública de especialidades" ON public.especialidades FOR INSERT WITH CHECK (true);
CREATE POLICY "Atualização pública de especialidades" ON public.especialidades FOR UPDATE USING (true);
CREATE POLICY "Exclusão pública de especialidades" ON public.especialidades FOR DELETE USING (true);

CREATE TRIGGER especialidades_updated_at
  BEFORE UPDATE ON public.especialidades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- 2. Tabela de médicos
-- ============================================
CREATE TABLE public.medicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  especialidade_id uuid REFERENCES public.especialidades(id) ON DELETE RESTRICT,
  crm text,
  telefone text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_medicos_especialidade ON public.medicos(especialidade_id);

ALTER TABLE public.medicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública de medicos" ON public.medicos FOR SELECT USING (true);
CREATE POLICY "Inserção pública de medicos" ON public.medicos FOR INSERT WITH CHECK (true);
CREATE POLICY "Atualização pública de medicos" ON public.medicos FOR UPDATE USING (true);
CREATE POLICY "Exclusão pública de medicos" ON public.medicos FOR DELETE USING (true);

CREATE TRIGGER medicos_updated_at
  BEFORE UPDATE ON public.medicos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- 3. Tabela de horários do médico
-- ============================================
CREATE TABLE public.horarios_medico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medico_id uuid NOT NULL REFERENCES public.medicos(id) ON DELETE CASCADE,
  dia_semana smallint NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio time NOT NULL,
  hora_fim time NOT NULL,
  duracao_consulta_min integer NOT NULL DEFAULT 30 CHECK (duracao_consulta_min > 0),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (hora_fim > hora_inicio)
);

CREATE INDEX idx_horarios_medico ON public.horarios_medico(medico_id, dia_semana);

ALTER TABLE public.horarios_medico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública de horarios" ON public.horarios_medico FOR SELECT USING (true);
CREATE POLICY "Inserção pública de horarios" ON public.horarios_medico FOR INSERT WITH CHECK (true);
CREATE POLICY "Atualização pública de horarios" ON public.horarios_medico FOR UPDATE USING (true);
CREATE POLICY "Exclusão pública de horarios" ON public.horarios_medico FOR DELETE USING (true);

CREATE TRIGGER horarios_medico_updated_at
  BEFORE UPDATE ON public.horarios_medico
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- 4. Vincular agendamentos (mantendo campos texto)
-- ============================================
ALTER TABLE public.agendamentos
  ADD COLUMN medico_id uuid REFERENCES public.medicos(id) ON DELETE SET NULL,
  ADD COLUMN especialidade_id uuid REFERENCES public.especialidades(id) ON DELETE SET NULL;

CREATE INDEX idx_agendamentos_medico ON public.agendamentos(medico_id);
CREATE INDEX idx_agendamentos_especialidade ON public.agendamentos(especialidade_id);
CREATE INDEX idx_agendamentos_status_data ON public.agendamentos(status, data_consulta);

-- ============================================
-- 5. Função: gerar slots disponíveis (read-only)
-- ============================================
CREATE OR REPLACE FUNCTION public.gerar_slots_disponiveis(
  p_medico_id uuid,
  p_data_inicio date,
  p_data_fim date
)
RETURNS TABLE(data_consulta date, horario time)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d date;
  h record;
  slot time;
BEGIN
  d := p_data_inicio;
  WHILE d <= p_data_fim LOOP
    FOR h IN
      SELECT hora_inicio, hora_fim, duracao_consulta_min
      FROM public.horarios_medico
      WHERE medico_id = p_medico_id
        AND ativo = true
        AND dia_semana = EXTRACT(DOW FROM d)::smallint
    LOOP
      slot := h.hora_inicio;
      WHILE slot + (h.duracao_consulta_min || ' minutes')::interval <= h.hora_fim LOOP
        IF NOT EXISTS (
          SELECT 1 FROM public.agendamentos a
          WHERE a.medico_id = p_medico_id
            AND a.data_consulta = d
            AND a.horario = slot
            AND COALESCE(a.status, '') IN ('confirmado', 'pendente', 'disponivel')
        ) THEN
          data_consulta := d;
          horario := slot;
          RETURN NEXT;
        END IF;
        slot := slot + (h.duracao_consulta_min || ' minutes')::interval;
      END LOOP;
    END LOOP;
    d := d + 1;
  END LOOP;
END;
$$;

-- ============================================
-- 6. Função: gerar agenda do mês (insere slots)
-- ============================================
CREATE OR REPLACE FUNCTION public.gerar_agenda_mes(
  p_medico_id uuid,
  p_data_inicio date,
  p_data_fim date
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_medico record;
  v_count integer := 0;
  v_slot record;
BEGIN
  SELECT m.id, m.nome, m.especialidade_id, e.nome AS especialidade_nome
  INTO v_medico
  FROM public.medicos m
  LEFT JOIN public.especialidades e ON e.id = m.especialidade_id
  WHERE m.id = p_medico_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Médico % não encontrado', p_medico_id;
  END IF;

  FOR v_slot IN
    SELECT * FROM public.gerar_slots_disponiveis(p_medico_id, p_data_inicio, p_data_fim)
  LOOP
    INSERT INTO public.agendamentos(
      especialidade, medico, data_consulta, horario,
      paciente_telefone, status, medico_id, especialidade_id
    ) VALUES (
      COALESCE(v_medico.especialidade_nome, 'Geral'),
      v_medico.nome,
      v_slot.data_consulta,
      v_slot.horario,
      'disponivel',
      'disponivel',
      v_medico.id,
      v_medico.especialidade_id
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ============================================
-- 7. Seed: especialidades + médicos exemplo + horários
-- ============================================
INSERT INTO public.especialidades(nome, descricao, icone) VALUES
  ('Cardiologia', 'Coração e sistema cardiovascular', '❤️'),
  ('Dermatologia', 'Pele, cabelos e unhas', '🧴'),
  ('Ortopedia', 'Ossos, articulações e músculos', '🦴'),
  ('Pediatria', 'Saúde de bebês, crianças e adolescentes', '🧒'),
  ('Clínica Geral', 'Atendimento clínico geral', '🩺'),
  ('Ginecologia', 'Saúde da mulher', '🌸')
ON CONFLICT (nome) DO NOTHING;

-- Médicos exemplo
WITH cardio AS (SELECT id FROM public.especialidades WHERE nome = 'Cardiologia'),
     derma  AS (SELECT id FROM public.especialidades WHERE nome = 'Dermatologia'),
     novo_carlos AS (
       INSERT INTO public.medicos(nome, especialidade_id, crm, telefone)
       SELECT 'Dr. Carlos Silva', id, 'CRM/SP 123456', '5511999990001' FROM cardio
       RETURNING id
     ),
     novo_ana AS (
       INSERT INTO public.medicos(nome, especialidade_id, crm, telefone)
       SELECT 'Dra. Ana Santos', id, 'CRM/SP 654321', '5511999990002' FROM derma
       RETURNING id
     )
INSERT INTO public.horarios_medico(medico_id, dia_semana, hora_inicio, hora_fim, duracao_consulta_min)
SELECT id, dia, '08:00'::time, fim, 30
FROM (SELECT id FROM novo_carlos UNION ALL SELECT id FROM novo_ana) m
CROSS JOIN (
  VALUES (1, '18:00'::time), (2, '18:00'::time), (3, '18:00'::time),
         (4, '18:00'::time), (5, '18:00'::time), (6, '12:00'::time)
) AS dias(dia, fim);
