import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/ui";
import { VerifyView } from "./view";

export const metadata: Metadata = { title: "Verify queue" };

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <VerifyView />
    </Suspense>
  );
}
