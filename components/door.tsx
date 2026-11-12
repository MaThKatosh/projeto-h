// Porta de quarto desenhada em CSS: cor = situação do quarto, plaquinha com o
// número, maçaneta e um "aviso de porta" pendurado com o ícone da situação.
export function Door({
  number,
  colorClass,
  icon,
  size = "md",
  ring,
}: {
  number: string;
  colorClass: string; // ex.: "bg-emerald-500 text-white"
  icon?: string;
  size?: "sm" | "md";
  ring?: boolean;
}) {
  const h = size === "sm" ? "h-20" : "h-28";
  return (
    <div className={`relative mx-auto w-full max-w-[6.5rem] rounded-t-[2.6rem] bg-gradient-to-b from-stone-300 to-stone-400 p-[5px] pb-0 shadow-inner ${ring ? "ring-4 ring-blue-400 ring-offset-2" : ""}`}>
      <div className={`door-panel relative ${h} overflow-hidden rounded-t-[2.3rem] ${colorClass}`}>
        {/* almofadas da porta */}
        <span className="absolute inset-x-3 top-9 bottom-[52%] rounded-sm border border-white/25 bg-white/5" />
        <span className="absolute inset-x-3 top-[54%] bottom-3 rounded-sm border border-white/25 bg-white/5" />
        {/* plaquinha com o número */}
        <span className="absolute top-2.5 left-1/2 -translate-x-1/2 rounded-md border border-amber-500 bg-gradient-to-b from-amber-100 to-amber-300 px-2 py-0.5 text-base leading-none font-black text-zinc-900 shadow-sm">
          {number}
        </span>
        {/* maçaneta */}
        <span className="absolute top-[52%] right-2.5 h-3 w-3 rounded-full bg-gradient-to-br from-amber-200 to-amber-500 shadow" />
        {/* aviso pendurado na maçaneta */}
        {icon && (
          <span className="absolute top-[60%] right-0.5 flex h-6 w-5 items-center justify-center rounded-b-md rounded-t-sm bg-white/90 text-[11px] leading-none text-zinc-800 shadow" aria-hidden>
            {icon}
          </span>
        )}
      </div>
      {/* soleira */}
      <div className="-mx-[5px] h-1.5 rounded-b bg-stone-500" />
    </div>
  );
}
