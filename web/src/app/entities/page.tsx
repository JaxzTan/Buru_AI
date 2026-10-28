import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/ui";
import { EntitiesView } from "./view";

export const metadata: Metadata = { title: "Entities" };

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <EntitiesView />
    </Suspense>
  );
}
