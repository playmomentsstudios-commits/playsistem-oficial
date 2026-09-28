import { test } from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { PGlite } from "@electric-sql/pglite"

test("timed module activities enforce ownership, deadlines, scoring and private answer keys", async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon;create role authenticated;create schema auth;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create table profiles(id uuid primary key,role text,status text);
   grant usage on schema public,auth to authenticated,anon;
   grant execute on function auth.uid() to authenticated,anon;`)
    for (const name of [
      "20260927110000_academy_foundation.sql",
      "20260927203000_add_academy_course_category.sql",
      "20260928150000_seed_zero_ao_digital_draft.sql",
      "20260928160000_academy_assessments.sql",
      "20260928161000_seed_zero_digital_activities.sql",
    ])
      await db.exec(
        await readFile(
          new URL("../supabase/migrations/" + name, import.meta.url),
          "utf8",
        ),
      )
    const admin = "00000000-0000-0000-0000-000000000001",
      student = "00000000-0000-0000-0000-000000000002",
      other = "00000000-0000-0000-0000-000000000003"
    await db.query(
      "insert into profiles values ($1,'admin','active'),($2,'customer','active'),($3,'customer','active')",
      [admin, student, other],
    )
    await db.exec(
      "grant select on courses,course_modules,course_enrollments,profiles to authenticated",
    )
    const course = (
      await db.query("select id from courses where slug='do-zero-ao-digital'")
    ).rows[0].id
    const module = (
      await db.query(
        "select id from course_modules where course_id=$1 order by display_order",
        [course],
      )
    ).rows[0].id
    const seeds = await db.query("select id,status from academy_assessments")
    assert.equal(seeds.rows.length, 5)
    assert.ok(seeds.rows.every((x) => x.status === "draft"))
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20260928161000_seed_zero_digital_activities.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    )
    assert.equal(
      (await db.query("select count(*)::int n from academy_assessments"))
        .rows[0].n,
      5,
    )
    const as = async (id) => {
      await db.exec("reset role")
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        id,
      ])
      await db.exec("set role authenticated")
    }
    const rpc = async (sql, args) => (await db.query(sql, args)).rows[0]?.result
    await as(admin)
    const payload = {
      module_id: module,
      title: "Teste cronometrado",
      kind: "activity",
      instructions: "Teste",
      status: "published",
      timed: true,
      max_attempts: 2,
      passing_percent: 50,
      questions: [
        {
          prompt: "Escolha A",
          options: ["A", "B"],
          correct_option: 0,
          points: 10,
          seconds: 60,
        },
        {
          prompt: "Escolha B",
          options: ["A", "B"],
          correct_option: 1,
          points: 20,
          seconds: 60,
        },
      ],
    }
    const aid = await rpc("select academy_save_assessment($1::jsonb) result", [
      JSON.stringify(payload),
    ])
    await assert.rejects(
      rpc("select academy_save_assessment($1::jsonb) result", [
        JSON.stringify({
          ...payload,
          questions: [{ ...payload.questions[0], correct_option: 8 }],
        }),
      ]),
    )
    await as(student)
    await assert.rejects(
      rpc("select academy_save_assessment($1::jsonb) result", [
        JSON.stringify(payload),
      ]),
    )
    await assert.rejects(
      rpc("select academy_start_assessment($1) result", [aid]),
    )
    await db.exec("reset role")
    await db.query(
      "insert into course_enrollments(course_id,user_id) values($1,$2)",
      [course, student],
    )
    await as(student)
    await assert.rejects(
      rpc("select academy_start_assessment($1) result", [aid]),
    ) // draft course
    await db.exec("reset role")
    await db.query("update courses set status='published' where id=$1", [
      course,
    ])
    await as(student)
    assert.equal(
      (await db.query("select * from academy_questions")).rows.length,
      0,
    )
    assert.equal(
      (await db.query("select * from academy_assessments")).rows.length,
      1,
    )
    let a = await rpc("select academy_start_assessment($1) result", [aid])
    assert.equal(a.position, 0)
    assert.equal(a.question.correct_option, undefined)
    assert.equal(a.snapshot, undefined)
    const resumed = await rpc(
      "select academy_start_assessment($1,true) result",
      [aid],
    )
    assert.equal(resumed.attempt_id, a.attempt_id)
    assert.equal(resumed.deadline, a.deadline)
    await assert.rejects(
      rpc("select academy_attempt_state($1) result", [a.attempt_id]),
    )
    assert.equal(
      (await db.query("select * from academy_attempts")).rows.length,
      0,
    )
    await assert.rejects(
      db.query("update academy_attempts set score=999 where id=$1", [
        a.attempt_id,
      ]),
    )
    await as(other)
    await assert.rejects(
      rpc("select academy_answer_question($1,0,0) result", [a.attempt_id]),
    )
    await as(student)
    await assert.rejects(
      rpc("select academy_answer_question($1,1,0) result", [a.attempt_id]),
    )
    await assert.rejects(
      rpc("select academy_answer_question($1,0,7) result", [a.attempt_id]),
    )
    a = await rpc("select academy_answer_question($1,0,0) result", [
      a.attempt_id,
    ])
    assert.equal(a.position, 1)
    assert.equal(a.score, 10)
    const duplicate = await rpc(
      "select academy_answer_question($1,0,0) result",
      [a.attempt_id],
    )
    assert.equal(duplicate.score, 10)
    assert.equal(duplicate.position, 1)
    await as(admin)
    await assert.rejects(
      rpc("select academy_save_assessment($1::jsonb) result", [
        JSON.stringify({ ...payload, id: aid }),
      ]),
    )
    await db.exec("reset role")
    await db.query(
      "update academy_attempts set question_started_at=clock_timestamp()-interval '61 seconds' where id=$1",
      [a.attempt_id],
    )
    await as(student)
    a = await rpc("select academy_answer_question($1,1,1) result", [
      a.attempt_id,
    ])
    assert.equal(a.status, "completed")
    assert.equal(a.score, 10)
    assert.equal(a.answers[1].timed_out, true)
    const result = await rpc("select academy_start_assessment($1) result", [
      aid,
    ])
    assert.equal(result.attempt_id, a.attempt_id)
    a = await rpc("select academy_start_assessment($1,true) result", [aid])
    assert.equal(a.attempts_used, 2)
    await db.exec("reset role")
    await db.query(
      "update academy_attempts set question_started_at=clock_timestamp()-interval '61 seconds' where id=$1",
      [a.attempt_id],
    )
    await as(student)
    a = await rpc("select academy_start_assessment($1) result", [aid])
    assert.equal(a.position, 1)
    assert.equal(a.score, 0)
    a = await rpc("select academy_answer_question($1,1,1) result", [
      a.attempt_id,
    ])
    assert.equal(a.score, 20)
    assert.equal(a.passed, true)
    await assert.rejects(
      rpc("select academy_start_assessment($1,true) result", [aid]),
    )
    await as(admin)
    const untimed = await rpc(
      "select academy_save_assessment($1::jsonb) result",
      [
        JSON.stringify({
          ...payload,
          title: "Avaliação",
          kind: "evaluation",
          timed: false,
        }),
      ],
    )
    await as(student)
    let b = await rpc("select academy_start_assessment($1) result", [untimed])
    assert.equal(b.deadline, null)
    await db.exec("reset role")
    await db.query(
      "update academy_attempts set question_started_at=clock_timestamp()-interval '2 days' where id=$1",
      [b.attempt_id],
    )
    await as(student)
    b = await rpc("select academy_answer_question($1,0,0) result", [
      b.attempt_id,
    ])
    assert.equal(b.score, 10)
    await as(admin)
    await rpc("select academy_set_assessment_status($1,false) result", [
      untimed,
    ])
    await as(student)
    await assert.rejects(
      rpc("select academy_answer_question($1,1,1) result", [b.attempt_id]),
    )
    await db.exec("reset role")
    await db.exec("set role anon")
    await assert.rejects(
      rpc("select academy_start_assessment($1) result", [aid]),
    )
  } finally {
    await db.close()
  }
})
