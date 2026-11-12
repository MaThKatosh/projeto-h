import type { MetadataRoute } from "next";
import { getDb } from "@/lib/db";
import { getHotelSettings } from "@/lib/settings";

// App instalável: no Chrome/Edge "Instalar app"; no iPhone, Safari →
// Compartilhar → "Adicionar à Tela de Início". Abre em janela própria.
export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  let name = "Sistema do Hotel";
  try {
    name = (await getHotelSettings(getDb())).hotelName || name;
  } catch {
    // sem banco (ex.: durante a montagem da imagem): fica o nome padrão
  }
  return {
    name,
    short_name: name.length > 12 ? "Hotel" : name,
    description: "Recepção, governança, manutenção, restaurante e mais.",
    start_url: "/mapa",
    scope: "/",
    display: "standalone",
    background_color: "#f4f4f5",
    theme_color: "#1d4ed8",
    lang: "pt-BR",
    icons: [
      { src: "/icones/192.png", sizes: "192x192", type: "image/png" },
      { src: "/icones/512.png", sizes: "512x512", type: "image/png" },
      { src: "/icones/512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icone.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
