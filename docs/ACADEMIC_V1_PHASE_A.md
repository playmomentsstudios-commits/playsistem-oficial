# Sistema Acadêmico Play Moments V1 — Fase A

Esta implementação inicia a fundação definida no Mapa Mestre sem reconstruir a Academia existente.

## Entidades adicionadas

- `academy_students`: identidade acadêmica 1:1 com `profiles`, com RA próprio.
- `academy_curricula`: matriz curricular versionada por curso.
- `academy_offerings`: execução/oferta de um curso vinculada a uma matriz e opcionalmente a uma turma.
- `academy_events`: trilha acadêmica auditável.

## Matrícula V2

`course_enrollments` continua sendo a matrícula operacional existente e é evoluída in-place com:

- `student_id`
- `offering_id`
- `curriculum_id`
- `enrollment_number`
- `started_at`
- `origin`
- `final_grade`
- `attendance_percent`
- `progress_percent`

Nenhuma matrícula antiga é apagada ou duplicada.

## Bootstrap

A migration cria RA para alunos já matriculados, Matriz 1 para cursos existentes, uma Oferta contínua inicial e conecta as matrículas existentes a essas entidades. Também registra um evento `enrollment_migrated` por matrícula.

## Regra de armazenamento

Esta fase contém somente dados estruturados/metadados no Supabase. Arquivos continuam seguindo a política Drive-first.
