// app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'RAG Document Q&A',
  description: 'Chat with your PDFs using a FastAPI + Groq + Chroma RAG stack',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-50 antialiased">
        {/* Gradient background + faint grid */}
        <div className="pointer-events-none fixed inset-0 -z-20 bg-gradient-to-br from-[#08011c] via-[#0b1026] to-[#020617]" />
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(236,72,153,0.25)_0,_transparent_55%),_radial-gradient(circle_at_bottom,_rgba(56,189,248,0.26)_0,_transparent_55%)]" />
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:64px_64px]" />

        {/* Pulsing accent ring */}
        <div className="pointer-events-none fixed inset-x-0 top-24 -z-10 flex justify-center">
          <div className="h-56 w-56 rounded-full bg-gradient-to-tr from-fuchsia-500/35 via-sky-400/30 to-emerald-400/30 blur-3xl opacity-70 animate-pulse" />
        </div>

        <div className="flex min-h-screen flex-col">
          {/* Top nav / brand bar */}
          <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 md:px-6 md:py-6">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900/80 shadow-[0_18px_45px_rgba(139,92,246,0.55)] ring-1 ring-fuchsia-400/60">
                <span className="text-xl">⚡</span>
                <span className="absolute -inset-0.5 rounded-2xl border border-fuchsia-400/40 blur-[1px] opacity-50" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-fuchsia-200/80">
                  RAG Studio
                </p>
                <h1 className="mt-0.5 text-sm md:text-base font-medium text-slate-100">
                  PDF‑aware AI Assistant
                </h1>
              </div>
            </div>
            <div className="hidden items-center gap-3 text-[11px] text-slate-300/80 md:flex">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 font-medium text-emerald-200">
              </span>
             
            </div>
          </header>

          {/* Main content shell */}
          <main className="flex-1">
            <div className="mx-auto max-w-6xl px-4 pb-10 md:px-6">
              {/* Outer glass card */}
              <div className="relative rounded-[2.4rem] border border-white/12 bg-slate-900/70 shadow-[0_40px_140px_rgba(15,23,42,0.95)] backdrop-blur-3xl p-[1.5px]">
                {/* Decorative corner orbs */}
                <div className="pointer-events-none absolute -left-2 top-10 h-16 w-16 rounded-full bg-fuchsia-500/30 blur-2xl" />
                <div className="pointer-events-none absolute -right-4 bottom-6 h-20 w-20 rounded-full bg-sky-400/25 blur-3xl" />

                <div className="relative rounded-[2.3rem] bg-[radial-gradient(circle_at_top,_rgba(30,64,175,0.45)_0,_rgba(15,23,42,1)_50%)] px-4 py-5 md:px-7 md:py-7">
                  {/* Optional subtle header for the page */}
                  <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3 md:mb-6">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                        Workspace
                      </p>
                      <p className="mt-1 text-lg md:text-xl font-semibold text-slate-50">
                        RAG Document Q&amp;A
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span className="hidden h-1 w-20 rounded-full bg-gradient-to-r from-fuchsia-400 via-sky-400 to-emerald-400 md:block" />
                      <span>v0.1 · Local only</span>
                    </div>
                  </div>

                  {/* Your actual page content */}
                  {children}
                </div>
              </div>
            </div>
          </main>

          {/* Footer */}
          <footer className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 pb-6 pt-2 text-[11px] text-slate-500 md:px-6">
            <span>Built with Next.js App Router, Tailwind CSS, and FastAPI backend.</span>
            <span>Made for learning RAG · Feel free to break it.</span>
          </footer>
        </div>
      </body>
    </html>
  )
}
