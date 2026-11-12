import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getDb } from "@/lib/db";
import { getHotelSettings } from "@/lib/settings";
import { getLocale } from "@/lib/i18n/server";
import { getDict } from "@/lib/i18n/dictionaries";
import { I18nProvider } from "@/components/i18n";

import { getT } from "@/lib/i18n/server";
// O nome do hotel vem das configurações.
export async function generateMetadata(): Promise<Metadata> {
  const tr = await getT();
  const { hotelName } = await getHotelSettings(getDb());
  return { title: hotelName, description: tr("Recepção, governança, manutenção e mais, num só lugar.") };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1d4ed8",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Idioma do funcionário (ou do hotel) para todas as telas.
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className="min-h-screen antialiased">
        <I18nProvider locale={locale} dict={getDict(locale)}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
