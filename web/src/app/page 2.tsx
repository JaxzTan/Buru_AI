import Link from "next/link";

const areas = [
  {
    href: "/operator",
    title: "Operator console",
    body: "Personas, live conversations, takeover, entity verification.",
  },
  {
    href: "/portal",
    title: "Customer portal",
    body: "Entity search, trends, API keys, usage, webhooks.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16">
      <h1 className="text-2xl font-semibold">Buru AI</h1>
      <p className="mt-2 opacity-70">Scam intelligence network for Southeast Asia.</p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {areas.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="rounded-lg border border-foreground/10 p-5 hover:border-foreground/30"
          >
            <h2 className="font-medium">{a.title}</h2>
            <p className="mt-1 text-sm opacity-70">{a.body}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
