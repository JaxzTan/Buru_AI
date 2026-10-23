import Link from "next/link";

const areas = [
  {
    href: "/operator",
    code: "OPS",
    title: "Operator console",
    body: "Personas, live conversations, takeover, entity verification.",
  },
  {
    href: "/portal",
    code: "API",
    title: "Customer portal",
    body: "Entity lookup, trends, webhooks, API keys, usage.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 px-4 py-16">
      <div className="flex flex-col gap-2">
        <div className="uk-wordmark">
          <i />
          unknown
        </div>
        <p className="uk-muted m-0">Scam intelligence network for Southeast Asia.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {areas.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="uk-card flex flex-col gap-2 p-4 text-ink no-underline hover:border-border-strong"
          >
            <span className="uk-over">{a.code}</span>
            <span className="text-base font-semibold">{a.title}</span>
            <span className="uk-muted text-[13px]">{a.body}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
