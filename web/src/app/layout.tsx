import "./style.css";
import { Providers } from "./providers";
import { AppShell } from "@/components/AppShell";

export const metadata = {
  title: "NDIS Claim Chain",
  description: "Disability support claims signed step by step by the people who know they happened.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
