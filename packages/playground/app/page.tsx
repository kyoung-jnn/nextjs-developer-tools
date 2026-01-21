export default function Home() {
  const serverTime = new Date().toISOString();

  return (
    <div className="min-h-screen bg-zinc-50 p-8 dark:bg-zinc-900">
      <main className="mx-auto max-w-4xl">
        <h1 className="mb-8 text-4xl font-bold text-zinc-900 dark:text-zinc-100">
          Next.js DevTools Test App
        </h1>

        <div className="mb-8 rounded-lg bg-white p-6 shadow dark:bg-zinc-800">
          <h2 className="mb-4 text-2xl font-semibold text-zinc-800 dark:text-zinc-200">
            Home Page (SSR + RSC)
          </h2>
          <div className="space-y-2 text-zinc-600 dark:text-zinc-400">
            <p>
              <strong>Router Type:</strong> App Router
            </p>
            <p>
              <strong>Server Time:</strong> {serverTime}
            </p>
            <p>
              <strong>Render Type:</strong> Server Component (RSC)
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <section>
            <h3 className="mb-4 text-xl font-semibold text-zinc-800 dark:text-zinc-200">
              App Router Pages
            </h3>
            <nav className="space-y-2">
              <a
                href="/ssr"
                className="block rounded bg-blue-100 p-3 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200"
              >
                /ssr - Server Component
              </a>
              <a
                href="/csr"
                className="block rounded bg-green-100 p-3 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-200"
              >
                /csr - Client Component
              </a>
              <a
                href="/mixed"
                className="block rounded bg-purple-100 p-3 text-purple-800 hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-200"
              >
                /mixed - SSR + CSR Hybrid
              </a>
              <a
                href="/large-payload"
                className="block rounded bg-orange-100 p-3 text-orange-800 hover:bg-orange-200 dark:bg-orange-900 dark:text-orange-200"
              >
                /large-payload - 1MB+ Data
              </a>
              <a
                href="/streaming"
                className="block rounded bg-pink-100 p-3 text-pink-800 hover:bg-pink-200 dark:bg-pink-900 dark:text-pink-200"
              >
                /streaming - Suspense
              </a>
            </nav>
          </section>

          <section>
            <h3 className="mb-4 text-xl font-semibold text-zinc-800 dark:text-zinc-200">
              Page Router Pages
            </h3>
            <nav className="space-y-2">
              <a
                href="/legacy/ssr"
                className="block rounded bg-cyan-100 p-3 text-cyan-800 hover:bg-cyan-200 dark:bg-cyan-900 dark:text-cyan-200"
              >
                /legacy/ssr - getServerSideProps
              </a>
              <a
                href="/legacy/ssg"
                className="block rounded bg-teal-100 p-3 text-teal-800 hover:bg-teal-200 dark:bg-teal-900 dark:text-teal-200"
              >
                /legacy/ssg - getStaticProps
              </a>
              <a
                href="/legacy/isr"
                className="block rounded bg-indigo-100 p-3 text-indigo-800 hover:bg-indigo-200 dark:bg-indigo-900 dark:text-indigo-200"
              >
                /legacy/isr - ISR (60s revalidate)
              </a>
              <a
                href="/legacy/csr"
                className="block rounded bg-rose-100 p-3 text-rose-800 hover:bg-rose-200 dark:bg-rose-900 dark:text-rose-200"
              >
                /legacy/csr - Client Only
              </a>
            </nav>
          </section>
        </div>
      </main>
    </div>
  );
}
