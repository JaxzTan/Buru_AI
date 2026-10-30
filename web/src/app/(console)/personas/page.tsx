import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/ui";
import { PersonasView } from "./view";

export const metadata: Metadata = { title: "Personas" };

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <PersonasView />
    </Suspense>
  );
}
