import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getDb } from "@/lib/db";
import { getHotelSettings } from "@/lib/settings";

// O nome do hotel vem das configurações.
export async function generateMetadata(): Promise<Metadata> {
  const { hotelName } = await getHotelSettings(getDb());
  return { title: hotelName, description: "Recepção, governança, manutenção e mais, num só lugar." };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1d4ed8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
