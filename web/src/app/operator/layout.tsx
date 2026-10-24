import type { Metadata } from "next";
import { OpsProvider } from "./store";
import { OpsShell } from "./shell";

export const metadata: Metadata = { title: "Unknown — Operator console" };

export default function OpsLayout({ children }: LayoutProps<"/operator">) {
  return (
    <OpsProvider>
      <OpsShell>{children}</OpsShell>
    </OpsProvider>
  );
}
