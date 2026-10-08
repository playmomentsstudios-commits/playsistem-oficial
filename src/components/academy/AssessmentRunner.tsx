import { useEffect, useRef, useState } from "react"
import { Assessment, assessmentsApi, Attempt } from "../../api/assessments"
export function AssessmentRunner({
  assessment,
  onClose,
}: {
  assessment: Assessment
  onClose: () => void
}) {
  const [attempt, setAttempt] = useState<Attempt | null>(null),
    [choice, setChoice] = useState<number | null>(null),
    [remaining, setRemaining] = useState<number | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("")
  const busyRef = useRef(false),
    deadline = useRef<number | null>(null),
    mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const receive = (value: Attempt) => {
    if (!mounted.current) return
    setAttempt(value)
    setChoice(null)
    deadline.current = value.deadline
      ? performance.now() +
        Math.max(0, Date.parse(value.deadline) - Date.parse(value.server_now))
      : null
    setRemaining(
      deadline.current === null
        ? null
        : Math.ceil(Math.max(0, deadline.current - performance.now()) / 1000),
    )
  }
  const run = async (fn: () => Promise<Attempt>) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError("")
    try {
      receive(await fn())
    } catch (e: any) {
      if (mounted.current)
        setError(
          e.message || "Não foi possível salvar. Tente retomar a tentativa.",
        )
    } finally {
      busyRef.current = false
      if (mounted.current) setBusy(false)
    }
  }
  const start = (fresh = false) =>
    void run(() => assessmentsApi.start(assessment.id, fresh))
  const send = (selected: number | null) => {
    if (attempt)
      void run(() =>
        assessmentsApi.answer(attempt.attempt_id, attempt.position, selected),
      )
  }
  useEffect(() => {
    if (
      !attempt ||
      attempt.status !== "in_progress" ||
      deadline.current === null
    )
      return
    const update = () =>
      setRemaining(
        Math.ceil(
          Math.max(0, (deadline.current || 0) - performance.now()) / 1000,
        ),
      )
    const timer = window.setInterval(update, 200)
    return () => clearInterval(timer)
  }, [attempt])
  useEffect(() => {
    if (remaining === 0 && attempt?.status === "in_progress" && !busy && !error)
      send(null)
  }, [remaining, attempt, busy, error])
  const kind = assessment.kind === "activity" ? "Atividade" : "Avaliação"
  return (
    <section className="pm-surface p-5 md:p-7" aria-label={kind}>
      <div className="flex justify-between gap-4">
        <div>
          <p className="text-xs text-[#ff5364]">{kind}</p>
          <h1 className="text-xl font-bold mt-1">{assessment.title}</h1>
        </div>
        <button onClick={onClose} className="text-sm text-gray-400">
          Voltar às aulas
        </button>
      </div>
      {!attempt && (
        <div className="mt-5 space-y-4">
          <p className="whitespace-pre-wrap text-sm text-gray-300">
            {assessment.instructions ||
              "Responda às questões para testar o que aprendeu neste módulo."}
          </p>
          <ul className="text-sm text-gray-400 list-disc pl-5 space-y-2">
            <li>Uma questão por vez, sem voltar após confirmar.</li>
            <li>
              {assessment.timed
                ? "Cada questão tem seu próprio tempo. Ao esgotar, vale zero ponto. Sair da página não pausa a questão atual."
                : "Sem limite de tempo por questão."}
            </li>
            <li>
              Até {assessment.max_attempts} tentativa(s). Referência de
              aproveitamento: {assessment.passing_percent}%.
            </li>
            <li>
              Ao confirmar, a próxima questão começa imediatamente. Garanta uma
              conexão estável.
            </li>
          </ul>
          <button
            disabled={busy}
            onClick={() => start()}
            className="min-h-11 px-5 rounded-xl bg-[#A65A2A] disabled:opacity-50"
          >
            {busy ? "Abrindo…" : "Iniciar / retomar"}
          </button>
        </div>
      )}
      {attempt?.status === "in_progress" && attempt.question && (
        <div className="mt-6">
          <fieldset disabled={busy || remaining === 0}>
            <legend className="text-2xl md:text-3xl font-extrabold leading-tight text-[#ff5364] whitespace-pre-wrap">
              {attempt.question.prompt}
            </legend>
            <div className="space-y-3 mt-4">
              {attempt.question.options.map((option, index) => (
                <label
                  key={index}
                  className={
                    "flex gap-3 p-4 rounded-xl border cursor-pointer " +
                    (choice === index
                      ? "border-red-500 bg-red-500/10"
                      : "border-white/10 bg-white/[.02]")
                  }
                >
                  <input
                    type="radio"
                    name={"question-" + attempt.position}
                    checked={choice === index}
                    onChange={() => setChoice(index)}
                    className="accent-red-600"
                  />
                  <span className="text-sm">{option}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-5 border-t border-white/10 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400">
              <span>
                Questão {attempt.position + 1} de {attempt.total} · {attempt.question.points} ponto(s)
              </span>
              <span
                role="timer"
                aria-label="Tempo restante"
                className={
                  remaining !== null && remaining <= 10
                    ? "text-red-400 font-bold text-base"
                    : "text-gray-300 font-semibold"
                }
              >
                {remaining === null
                  ? "Sem temporizador"
                  : `Tempo: ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`}
              </span>
            </div>
            <div className="h-1 bg-white/10 rounded mt-3">
              <div
                className="h-1 bg-[#A65A2A] rounded"
                style={{ width: `${((attempt.position + 1) / attempt.total) * 100}%` }}
              />
            </div>
          </div>
          <button
            onClick={() => send(choice)}
            disabled={busy || choice === null || remaining === 0}
            className="min-h-11 px-5 mt-5 rounded-xl bg-[#A65A2A] disabled:opacity-40"
          >
            {busy
              ? "Salvando…"
              : remaining === 0
                ? "Tempo encerrado"
                : attempt.position + 1 === attempt.total
                  ? "Confirmar e finalizar"
                  : "Confirmar e avançar"}
          </button>
        </div>
      )}
      {attempt?.status === "completed" && (
        <div className="mt-6 space-y-4">
          <h2 className="text-lg font-bold">{kind} concluída</h2>
          <p className="text-3xl font-bold">
            {attempt.score} / {attempt.max_score} pontos
          </p>
          <p className="text-sm text-gray-300">
            {Math.round((attempt.score / attempt.max_score) * 100)}% de
            aproveitamento ·{" "}
            {attempt.passed
              ? "Meta atingida"
              : "Revise o módulo para reforçar o aprendizado"}
          </p>
          <ul className="space-y-2 text-sm text-gray-400">
            {attempt.answers?.map((a) => (
              <li key={a.position}>
                Questão {a.position + 1}:{" "}
                {a.timed_out
                  ? "tempo esgotado"
                  : a.awarded_points
                    ? "resposta correta"
                    : "resposta incorreta"}{" "}
                · {a.awarded_points} ponto(s)
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-500">
            Tentativas utilizadas: {attempt.attempts_used} de{" "}
            {attempt.max_attempts}. Esta pontuação não altera a conclusão das
            videoaulas.
          </p>
          {attempt.attempts_used < attempt.max_attempts && (
            <button
              onClick={() => start(true)}
              disabled={busy}
              className="min-h-11 px-5 rounded-xl bg-white/10 disabled:opacity-50"
            >
              Nova tentativa
            </button>
          )}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-red-500/30 p-4"
        >
          <p className="text-sm text-red-300">{error}</p>
          <button
            onClick={() => start()}
            disabled={busy}
            className="underline text-sm mt-3"
          >
            Retomar e sincronizar
          </button>
        </div>
      )}
    </section>
  )
}
