import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/ui";
import { WebChatView } from "./view";

export const metadata: Metadata = { title: "Web chat" };

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <WebChatView />
    </Suspense>
  );
}
