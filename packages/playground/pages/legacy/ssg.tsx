import { GetStaticProps } from "next";

interface SSGPageProps {
  buildTime: string;
  staticData: {
    title: string;
    content: string;
  };
}

export const getStaticProps: GetStaticProps<SSGPageProps> = async () => {
  return {
    props: {
      buildTime: new Date().toISOString(),
      staticData: {
        title: "Static Page",
        content:
          "This content was generated at build time and will not change until the next build.",
      },
    },
  };
};

export default function PagesSSG({ buildTime, staticData }: SSGPageProps) {
  return (
    <div className="min-h-screen bg-zinc-50 p-8 dark:bg-zinc-900">
      <main className="mx-auto max-w-4xl">
        <a
          href="/"
          className="mb-4 inline-block text-blue-600 hover:underline dark:text-blue-400"
        >
          &larr; Back to Home
        </a>

        <h1 className="mb-8 text-4xl font-bold text-zinc-900 dark:text-zinc-100">
          Page Router SSG (Legacy) (getStaticProps)
        </h1>

        <div className="rounded-lg bg-white p-6 shadow dark:bg-zinc-800">
          <div className="mb-6 space-y-2 text-zinc-600 dark:text-zinc-400">
            <p>
              <strong>Router Type:</strong> Page Router
            </p>
            <p>
              <strong>Data Fetching:</strong> getStaticProps
            </p>
            <p>
              <strong>Build Time:</strong> {buildTime}
            </p>
          </div>

          <div className="rounded bg-teal-50 p-4 dark:bg-teal-900">
            <h2 className="mb-2 font-semibold text-teal-800 dark:text-teal-200">
              {staticData.title}
            </h2>
            <p className="text-teal-700 dark:text-teal-300">
              {staticData.content}
            </p>
          </div>

          <div className="mt-4 rounded bg-amber-50 p-3 dark:bg-amber-900">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Note:</strong> The buildTime above will stay the same
              across page reloads because this page is statically generated. It
              will only change when you rebuild the application.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
