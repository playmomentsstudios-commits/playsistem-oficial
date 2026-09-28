import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('draft curriculum is complete, private and preserves editorial changes on rerun', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;
      create table public.profiles (id uuid primary key, role text, status text);`)
    for (const name of ['20260927110000_academy_foundation.sql', '20260927203000_add_academy_course_category.sql']) {
      await db.exec(await readFile(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8'))
    }
    const sql = await readFile(new URL('../supabase/migrations/20260928150000_seed_zero_ao_digital_draft.sql', import.meta.url), 'utf8')
    await db.exec(sql)
    const courses = (await db.query('select * from courses')).rows
    assert.equal(courses.length, 1)
    assert.equal(courses[0].status, 'draft')
    assert.equal(courses[0].access_type, 'manual')
    assert.equal(courses[0].published_at, null)
    assert.equal(courses[0].estimated_minutes, 77)
    const modules = (await db.query('select * from course_modules order by display_order')).rows
    assert.deepEqual(modules.map(m => m.display_order), [0, 1, 2, 3, 4])
    const lessons = (await db.query('select * from course_lessons')).rows
    assert.equal(lessons.length, 15)
    assert.equal(lessons.reduce((sum, l) => sum + l.duration_seconds, 0), 77 * 60)
    for (const module of modules) {
      assert.deepEqual(lessons.filter(l => l.module_id === module.id).map(l => l.display_order).sort(), [0, 1, 2])
    }
    for (const lesson of lessons) {
      assert.equal(lesson.status, 'draft')
      assert.equal(lesson.video_source, 'none')
      assert.equal(lesson.video_url, null)
      assert.equal(lesson.video_drive_file_id, null)
      assert.equal(lesson.is_preview, false)
      for (const section of ['Objetivo', 'Conteúdo da aula', 'Atividade prática', 'Critério de conclusão', 'Material de apoio previsto']) assert.ok(lesson.description.includes(section))
    }
    assert.equal((await db.query('select count(*)::int as n from lesson_materials')).rows[0].n, 0)
    assert.equal((await db.query('select count(*)::int as n from course_enrollments')).rows[0].n, 0)
    await db.query("update course_lessons set title='Edição preservada', video_source='youtube', video_url='https://example.invalid/video' where id=$1", [lessons[0].id])
    await db.exec(sql)
    assert.equal((await db.query('select count(*)::int as n from courses')).rows[0].n, 1)
    assert.equal((await db.query('select count(*)::int as n from course_lessons')).rows[0].n, 15)
    assert.equal((await db.query('select title from course_lessons where id=$1', [lessons[0].id])).rows[0].title, 'Edição preservada')
    assert.equal((await db.query('select video_url from course_lessons where id=$1', [lessons[0].id])).rows[0].video_url, 'https://example.invalid/video')
  } finally { await db.close() }
})
