import type { Metadata } from "next";
import { Shell } from "@/components/app/Shell";
import { MY_BANK } from "@/lib/mock";
import { PortalProvider } from "./store";

export const metadata: Metadata = { title: "Unknown — Customer portal" };

const ITEMS = [
  { label: "Lookup", href: "/portal/lookup" },
  { label: "Entities", href: "/portal/entities" },
  { label: "Trends", href: "/portal/trends" },
  { label: "Webhooks", href: "/portal/webhooks" },
  { label: "API keys", href: "/portal/api-keys" },
  { label: "Usage", href: "/portal/usage" },
];

export default function PortalLayout({ children }: LayoutProps<"/portal">) {
  return (
    <PortalProvider>
      <Shell items={ITEMS} defaultTheme="light" themeKey="uk-theme-portal" who={`Pilot · Digital bank (${MY_BANK})`}>
        {children}
      </Shell>
    </PortalProvider>
  );
}
