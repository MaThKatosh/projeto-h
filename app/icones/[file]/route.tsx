import { ImageResponse } from "next/og";

// Ícones PNG do app instalável (Android, Windows, iPhone): /icones/192.png etc.
const SIZES = [180, 192, 512, 1024];

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const m = file.match(/^(\d+)(-maskable)?\.png$/);
  const size = m ? Number(m[1]) : 0;
  if (!SIZES.includes(size)) return new Response("Não encontrado", { status: 404 });
  // "maskable": o celular recorta em círculo/gota, então o H fica menor e o fundo ocupa tudo.
  const maskable = Boolean(m?.[2]);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2563eb",
          borderRadius: maskable || size === 180 ? 0 : size * 0.22,
          color: "white",
          fontSize: size * (maskable ? 0.45 : 0.6),
          fontWeight: 900,
        }}
      >
        H
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=604800" } }
  );
}
