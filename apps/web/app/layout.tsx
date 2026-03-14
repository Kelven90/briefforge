import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "BriefForge",
  description: "AI-native workspace for grounded client briefs."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}

