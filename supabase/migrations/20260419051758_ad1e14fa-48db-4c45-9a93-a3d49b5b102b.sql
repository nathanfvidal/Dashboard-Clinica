-- Seed para teste dos crons auxiliares
INSERT INTO public.agendamentos (especialidade, medico, data_consulta, horario, paciente_telefone, paciente_nome, status)
VALUES
  ('Cardiologia', 'Dr. Carlos Silva', current_date + 1, '14:00:00', '5583912350020', 'Cron Teste D1', 'confirmado'),
  ('Cardiologia', 'Dr. Carlos Silva', current_date,     (date_trunc('minute', now() + interval '2 hours'))::time, '5583912350020', 'Cron Teste 2h', 'confirmado'),
  ('Cardiologia', 'Dr. Carlos Silva', current_date - 1, '10:00:00', '5583912350020', 'Cron Teste FB', 'confirmado');