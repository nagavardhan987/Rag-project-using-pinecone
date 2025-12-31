'use client'

import { useState, useRef, useEffect, ChangeEvent } from 'react'

const STORAGE_KEY = 'rag-ui-state-v1'

type FactResult = {
  verdict: string
  reason: string
  evidence: string[]
}

type PersistedState = {
  question: string
  answer: string
  claim: string
  factResult: FactResult | null
}

export default function Home() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')

  const [claim, setClaim] = useState('')
  const [factResult, setFactResult] = useState<FactResult | null>(null)
  const [factLoading, setFactLoading] = useState(false)
  const [factError, setFactError] = useState<string | null>(null)

  const claimTextAreaRef = useRef<HTMLTextAreaElement | null>(null)

  // ---------- Load from localStorage on first mount ----------
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const saved: PersistedState = JSON.parse(raw)

      setQuestion(saved.question || '')
      setAnswer(saved.answer || '')
      setClaim(saved.claim || '')
      setFactResult(saved.factResult || null)
    } catch {
      // ignore corrupt storage
    }
  }, [])

  // ---------- Persist to localStorage whenever key state changes ----------
  useEffect(() => {
    if (typeof window === 'undefined') return
    const stateToSave: PersistedState = {
      question,
      answer,
      claim,
      factResult,
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave))
  }, [question, answer, claim, factResult])

  const handleQuery = async () => {
    if (!question.trim()) return

    setLoading(true)
    setAnswer('')
    setStatus('')
    try {
      const res = await fetch('http://localhost:8000/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || JSON.stringify(data))
      }

      setAnswer(data.answer ?? 'No answer returned.')
    } catch (error: any) {
      setStatus(`❌ Query failed: ${error.message}`)
    }
    setLoading(false)
  }

  const handleFactCheck = async () => {
    if (!claim.trim()) return

    setFactLoading(true)
    setFactError(null)
    setFactResult(null)

    try {
      const res = await fetch('http://localhost:8000/fact_check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claim,
          namespace: 'documents',
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || JSON.stringify(data))
      }

      const parsed = JSON.parse(data.result)

      setFactResult({
        verdict: parsed.verdict,
        reason: parsed.reason,
        evidence: parsed.evidence || [],
      })
    } catch (error: any) {
      setFactError(`❌ Fact check failed: ${error.message}`)
    } finally {
      setFactLoading(false)
    }
  }

  const handleClaimChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setClaim(e.target.value)

    const el = claimTextAreaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#4b29ff] via-[#7b3fe4] to-[#111827] px-4 py-8 md:px-8 md:py-10">
      <div className="max-w-4xl mx-auto rounded-[2.2rem] bg-white/5 shadow-[0_40px_120px_rgba(15,23,42,0.7)] p-[1px]">
        <div className="rounded-[2.1rem] bg-slate-950/70 backdrop-blur-2xl border border-white/10 px-5 py-6 md:px-10 md:py-10">
          {/* Header */}
          <div className="flex flex-col gap-3 mb-8">
            <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-purple-200/80">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              AI‑powered document assistant
            </p>
            <h1 className="text-3xl md:text-5xl font-semibold text-white">
              RAG{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 via-sky-400 to-emerald-300">
                Document Q&A
              </span>
            </h1>
            <p className="text-sm md:text-base text-slate-300/80 max-w-xl">
              Your PDFs are already ingested into Pinecone. Ask a question and
              the AI will answer using only those documents, or fact‑check any
              claim against them.
            </p>
            {status && (
              <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-xs md:text-sm text-rose-100 shadow-lg">
                {status}
              </div>
            )}
          </div>

          {/* Question + Answer */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 md:p-5 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base md:text-lg font-semibold text-white">
                  Ask a question
                </h2>
                <p className="mt-1 text-xs text-slate-300/80">
                  The answer will be grounded in the documents stored in
                  Pinecone.
                </p>
              </div>
              <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                Retrieval
              </span>
            </div>

            <div className="rounded-2xl border border-white/15 bg-slate-950/70 p-3 md:p-4">
              <textarea
                value={question}
                onChange={e => setQuestion(e.target.value)}
                placeholder="e.g. According to these notes, what is LangChain and why is it useful?"
                className="w-full resize-none rounded-xl border border-transparent bg-transparent p-0 text-sm md:text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
                rows={3}
                disabled={loading}
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-[11px] text-slate-400">
                  Pro tip: ask specific questions like “Summarize the main LLM
                  challenges mentioned in the notes.”
                </p>
                <button
                  onClick={handleQuery}
                  disabled={!question.trim() || loading}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-xs md:text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition-all hover:shadow-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                      Thinking…
                    </>
                  ) : (
                    <>Get answer</>
                  )}
                </button>
              </div>
            </div>

            {answer && (
              <div className="mt-1 flex flex-col gap-2">
                <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
                  AI response
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-emerald-500/15 via-slate-900/70 to-teal-500/20 border border-emerald-400/40 px-4 py-4 shadow-[0_18px_60px_rgba(16,185,129,0.3)]">
                  <p className="text-sm md:text-base leading-relaxed text-slate-50 whitespace-pre-wrap">
                    {answer}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Fact checker */}
          <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-4 md:p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base md:text-lg font-semibold text-white">
                  Fact checker
                </h2>
                <p className="mt-1 text-xs text-slate-300/80">
                  Enter a statement from your notes and check if it is supported
                  by the uploaded PDFs.
                </p>
              </div>
              <span className="rounded-full bg-sky-500/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-200">
                Verification
              </span>
            </div>

            <div className="rounded-2xl border border-white/15 bg-slate-950/70 p-3 md:p-4">
              <textarea
                ref={claimTextAreaRef}
                value={claim}
                onChange={handleClaimChange}
                placeholder="Example: intolerance is the appearance of characteristic toxic effects of a drug in an individual at therapeutic doses."
                className="w-full rounded-xl border border-transparent bg-transparent p-0 text-sm md:text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none overflow-hidden"
                rows={1}
                disabled={factLoading}
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-[11px] text-slate-400">
                  The model will return SUPPORTED, REFUTED, or NOT_ENOUGH_INFO
                  based only on your PDFs.
                </p>
                <button
                  onClick={handleFactCheck}
                  disabled={!claim.trim() || factLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-2 text-xs md:text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition-all hover:shadow-sky-500/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {factLoading ? (
                    <>
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                      Checking…
                    </>
                  ) : (
                    <>Fact check</>
                  )}
                </button>
              </div>

              {factError && (
                <div className="mt-3 rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-100">
                  {factError}
                </div>
              )}

              {factResult && (
                <div className="mt-4 rounded-xl border border-white/15 bg-slate-900/80 p-3 text-sm space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Verdict
                    </span>
                    <span
                      className={
                        factResult.verdict === 'SUPPORTED'
                          ? 'rounded-full bg-green-900/40 px-3 py-1 text-xs font-semibold text-green-300'
                          : factResult.verdict === 'REFUTED'
                          ? 'rounded-full bg-red-900/40 px-3 py-1 text-xs font-semibold text-red-300'
                          : 'rounded-full bg-yellow-900/40 px-3 py-1 text-xs font-semibold text-yellow-300'
                      }
                    >
                      {factResult.verdict}
                    </span>
                  </div>

                  <p className="text-slate-100">
                    <span className="font-semibold">Reason: </span>
                    {factResult.reason}
                  </p>

                  {factResult.evidence.length > 0 && (
                    <div>
                      <p className="font-semibold text-slate-100 mb-1">
                        Evidence from PDFs:
                      </p>
                      <ul className="list-disc pl-5 space-y-1 text-slate-200">
                        {factResult.evidence.map((ev, idx) => (
                          <li key={idx}>{ev}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          <div className="mt-6 flex items-center justify-between text-[11px] text-slate-500">
            <span>Running on FastAPI · Groq · Pinecone · LangChain</span>
            <span>Built by you 🚀</span>
          </div>
        </div>
      </div>
    </div>
  )
}
