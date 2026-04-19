-- Limpa agendamentos antigos do telefone de cron
DELETE FROM agendamentos WHERE paciente_telefone = '5583912350020';

-- D-1: amanhã às 14:00 (precisa lembrete_d1_enviado_at NULL)
INSERT INTO agendamentos (especialidade, medico, data_consulta, horario, paciente_telefone, paciente_nome, status)
VALUES ('Cardiologia', 'Dr. Carlos Silva', current_date + 1, '14:00', '5583912350020', 'Cron Teste D1 v13', 'confirmado');

-- T-2h: hoje, daqui a ~2h (janela: 1h30 a 2h30)
INSERT INTO agendamentos (especialidade, medico, data_consulta, horario, paciente_telefone, paciente_nome, status)
VALUES ('Cardiologia', 'Dr. Carlos Silva', current_date, ((now() AT TIME ZONE 'UTC' + interval '2 hours')::time)::text::time, '5583912350020', 'Cron Teste 2h v13', 'confirmado');

-- Feedback: ontem (data passada, status confirmado, feedback NULL)
INSERT INTO agendamentos (especialidade, medico, data_consulta, horario, paciente_telefone, paciente_nome, status)
VALUES ('Cardiologia', 'Dr. Carlos Silva', current_date - 1, '10:00', '5583912350020', 'Cron Teste FB v13', 'confirmado');