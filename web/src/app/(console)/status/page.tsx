import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/ui";
import { StatusView } from "./view";

export const metadata: Metadata = { title: "Status" };

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <StatusView />
    </Suspense>
  );
}
