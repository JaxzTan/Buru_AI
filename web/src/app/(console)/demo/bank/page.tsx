import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/ui";
import { BankView } from "./view";

export const metadata: Metadata = { title: "Bank simulator" };

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <BankView />
    </Suspense>
  );
}
