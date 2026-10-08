import { FormEvent, useEffect, useState } from "react"
import { Assessment, assessmentsApi, Question } from "../../api/assessments"
const blankQuestion = (): Question => ({
  prompt: "",
  options: ["", "", "", ""],
  correct_option: 0,
  points: 10,
  seconds: 60,
})
const control =
  "w-full min-h-10 rounded-lg bg-[#171719] border border-white/15 px-3 py-2 text-sm"
export function AssessmentManager({
  modules,
}: {
  modules: { id: string; title: string }[]
}) {
  const [items, setItems] = useState<Assessment[]>([]),
    [form, setForm] = useState<Partial<Assessment> & {
      questions: Question[]
    } | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [results, setResults] = useState<any[] | null>(null)
  const ids = modules.map((m) => m.id).join(",")
  const load = async () => {
    try {
      setItems(await assessmentsApi.list(modules.map((m) => m.id)))
      setError("")
    } catch (e: any) {
      setError(e.message)
    }
  }
  useEffect(() => {
    setForm(null)
    setResults(null)
    void load()
  }, [ids])
  const create = (moduleId: string, kind: "activity" | "evaluation") => {
    setResults(null)
    setForm({
      module_id: moduleId,
      title: "",
      kind,
      instructions: "",
      status: "draft",
      timed: kind === "activity",
      max_attempts: 2,
      passing_percent: 70,
      questions: [blankQuestion()],
    })
  }
  const edit = async (item: Assessment) => {
    setBusy(true)
    try {
      setResults(null)
      setForm({ ...item, questions: await assessmentsApi.questions(item.id) })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  const updateQ = (index: number, change: Partial<Question>) => {
    if (form)
      setForm({
        ...form,
        questions: form.questions.map((q, i) =>
          i === index ? { ...q, ...change } : q,
        ),
      })
  }
  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!form || busy) return
    setBusy(true)
    setError("")
    try {
      await assessmentsApi.save(form)
      setForm(null)
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  if (!modules.length) return null
  return (
    <section className="pm-surface p-5 mt-6">
      <h2 className="text-lg font-bold">Atividades e avaliações dos módulos</h2>
      <p className="text-sm text-gray-500 mt-1">
        Opcionais. Questões de múltipla escolha, correção automática e pontuação
        separada das aulas.
      </p>
      <div className="mt-4 space-y-4">
        {modules.map((m) => (
          <div key={m.id} className="border border-white/10 rounded-xl p-4">
            <h3 className="font-semibold text-sm">{m.title}</h3>
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                disabled={busy}
                onClick={() => create(m.id, "activity")}
                className="min-h-10 px-3 rounded-lg bg-white/10 text-xs"
              >
                + Atividade
              </button>
              <button
                disabled={busy}
                onClick={() => create(m.id, "evaluation")}
                className="min-h-10 px-3 rounded-lg bg-white/10 text-xs"
              >
                + Avaliação
              </button>
            </div>
            {items
              .filter((a) => a.module_id === m.id)
              .map((a) => (
                <div
                  key={a.id}
                  className="border-t border-white/10 mt-3 pt-3 flex flex-wrap gap-3 items-center"
                >
                  <div className="flex-1 min-w-40">
                    <p className="text-sm font-semibold">{a.title}</p>
                    <p className="text-xs text-gray-500">
                      {a.kind === "activity" ? "Atividade" : "Avaliação"} ·{" "}
                      {a.status === "draft" ? "Rascunho" : "Publicada"} ·{" "}
                      {a.timed ? "Tempo por questão" : "Sem temporizador"}
                    </p>
                  </div>
                  <button
                    disabled={busy}
                    onClick={() => void edit(a)}
                    className="text-xs min-h-10"
                  >
                    Editar
                  </button>
                  <button
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true)
                      try {
                        await assessmentsApi.publish(
                          a.id,
                          a.status !== "published",
                        )
                        await load()
                      } catch (e: any) {
                        setError(e.message)
                      } finally {
                        setBusy(false)
                      }
                    }}
                    className="text-xs min-h-10"
                  >
                    {a.status === "published"
                      ? "Retirar da publicação"
                      : "Publicar"}
                  </button>
                  <button
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true)
                      try {
                        setResults(await assessmentsApi.results(a.id))
                        setForm(null)
                      } catch (e: any) {
                        setError(e.message)
                      } finally {
                        setBusy(false)
                      }
                    }}
                    className="text-xs min-h-10"
                  >
                    Resultados
                  </button>
                </div>
              ))}
          </div>
        ))}
      </div>
      {form && (
        <form
          onSubmit={save}
          className="mt-5 space-y-4 border border-red-500/30 rounded-xl p-4"
        >
          <h3 className="font-bold">
            {form.id ? "Editar" : "Criar"}{" "}
            {form.kind === "activity" ? "atividade" : "avaliação"}
          </h3>
          <p className="text-xs text-gray-500">
            Depois da primeira tentativa, o conteúdo fica preservado. Para mudar
            questões, crie uma nova versão e retire a anterior da publicação.
          </p>
          <label className="block text-sm">
            Título
            <input
              required
              maxLength={200}
              className={control}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            Orientações
            <textarea
              className={control}
              rows={3}
              value={form.instructions}
              onChange={(e) =>
                setForm({ ...form, instructions: e.target.value })
              }
            />
          </label>
          <div className="grid sm:grid-cols-3 gap-3">
            <label className="text-sm">
              Tentativas máximas
              <input
                className={control}
                type="number"
                min={1}
                max={10}
                required
                value={form.max_attempts}
                onChange={(e) =>
                  setForm({ ...form, max_attempts: Number(e.target.value) })
                }
              />
            </label>
            <label className="text-sm">
              Meta de aproveitamento (%)
              <input
                className={control}
                type="number"
                min={0}
                max={100}
                required
                value={form.passing_percent}
                onChange={(e) =>
                  setForm({ ...form, passing_percent: Number(e.target.value) })
                }
              />
            </label>
            <label className="text-sm">
              Situação
              <select
                className={control}
                value={form.status}
                onChange={(e) =>
                  setForm({
                    ...form,
                    status: e.target.value as "draft" | "published",
                  })
                }
              >
                <option value="draft">Rascunho</option>
                <option value="published">Publicada</option>
              </select>
            </label>
          </div>
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.timed}
              onChange={(e) => setForm({ ...form, timed: e.target.checked })}
            />
            Temporizador por questão
          </label>
          <p className="text-xs text-gray-500">
            Use tempo suficiente para leitura. Pode desativar o temporizador
            para atividades que precisem de mais reflexão ou acessibilidade.
          </p>
          {form.questions.map((q, index) => (
            <fieldset
              key={index}
              className="rounded-xl border border-white/10 p-4 space-y-3"
            >
              <legend className="px-2 text-sm font-bold">
                Questão {index + 1}
              </legend>
              <label className="block text-sm">
                Enunciado
                <textarea
                  required
                  maxLength={3000}
                  className={control}
                  value={q.prompt}
                  onChange={(e) => updateQ(index, { prompt: e.target.value })}
                />
              </label>
              {q.options.map((option, i) => (
                <label key={i} className="flex gap-3 items-center">
                  <input
                    type="radio"
                    aria-label={`Alternativa ${i + 1} correta da questão ${index + 1}`}
                    name={"correct-" + index}
                    checked={q.correct_option === i}
                    onChange={() => updateQ(index, { correct_option: i })}
                  />
                  <input
                    required
                    maxLength={1000}
                    aria-label={`Alternativa ${i + 1} da questão ${index + 1}`}
                    className={control}
                    placeholder={"Alternativa " + (i + 1)}
                    value={option}
                    onChange={(e) =>
                      updateQ(index, {
                        options: q.options.map((v, j) =>
                          i === j ? e.target.value : v,
                        ),
                      })
                    }
                  />
                </label>
              ))}
              <p className="text-xs text-gray-500">
                Marque ao lado a única alternativa correta.
              </p>
              <div className="flex flex-wrap gap-3">
                <label className="text-sm">
                  Pontos
                  <input
                    required
                    className={control}
                    type="number"
                    min={1}
                    max={100}
                    value={q.points}
                    onChange={(e) =>
                      updateQ(index, { points: Number(e.target.value) })
                    }
                  />
                </label>
                {form.timed && (
                  <label className="text-sm">
                    Tempo (segundos)
                    <input
                      required
                      className={control}
                      type="number"
                      min={15}
                      max={3600}
                      value={q.seconds}
                      onChange={(e) =>
                        updateQ(index, { seconds: Number(e.target.value) })
                      }
                    />
                  </label>
                )}
                <button
                  type="button"
                  disabled={form.questions.length === 1}
                  onClick={() =>
                    setForm({
                      ...form,
                      questions: form.questions.filter((_, i) => i !== index),
                    })
                  }
                  className="text-xs text-red-300 disabled:opacity-30"
                >
                  Remover questão
                </button>
              </div>
            </fieldset>
          ))}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={form.questions.length >= 50 || busy}
              onClick={() =>
                setForm({
                  ...form,
                  questions: [...form.questions, blankQuestion()],
                })
              }
              className="min-h-11 px-4 rounded-lg bg-white/10"
            >
              + Questão
            </button>
            <button
              disabled={busy}
              className="min-h-11 px-4 rounded-lg bg-[#A65A2A] disabled:opacity-40"
            >
              {busy ? "Salvando…" : "Salvar"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setForm(null)}
              className="min-h-11 px-4"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
      {results && (
        <div className="mt-5">
          <h3 className="font-bold">Tentativas registradas</h3>
          {!results.length ? (
            <p className="text-sm text-gray-500 mt-2">
              Nenhuma tentativa ainda.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs mt-3">
                <thead>
                  <tr>
                    <th className="text-left p-2">Aluno</th>
                    <th>Situação</th>
                    <th>Pontos</th>
                    <th>Início</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.id} className="border-t border-white/10">
                      <td className="p-2">
                        {[r.student?.first_name, r.student?.last_name]
                          .filter(Boolean)
                          .join(" ") ||
                          r.student?.email ||
                          r.user_id}
                      </td>
                      <td>
                        {r.status === "completed"
                          ? "Concluída"
                          : "Em andamento"}
                      </td>
                      <td className="text-center">{r.score}</td>
                      <td>{new Date(r.started_at).toLocaleString("pt-BR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-300">
          Não foi possível concluir: {error}. Se esta funcionalidade acabou de
          ser instalada, confira se o SQL de atividades foi aplicado.
        </p>
      )}
    </section>
  )
}
