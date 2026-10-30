import { Shell } from "@/components/Shell";

// Every console page gets the sidebar shell. /sign-in sits outside this group, so it has none.
export default function ConsoleLayout({ children }: LayoutProps<"/">) {
  return <Shell>{children}</Shell>;
}
