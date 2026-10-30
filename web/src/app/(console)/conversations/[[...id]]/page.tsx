import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/ui";
import { ConversationsView } from "./view";

export const metadata: Metadata = { title: "Conversations" };

// /conversations and /conversations/[id]; the view reads the id on the client.
export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <ConversationsView />
    </Suspense>
  );
}
