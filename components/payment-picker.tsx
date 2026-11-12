"use client";

import { METHOD, type Method } from "@/lib/folio/rules";

export type PaymentOptions = { methods: Method[]; brands: string[] };

// Escolha da forma de pagamento (só as ativas nas configurações) e, no
// cartão, da bandeira. Usado na conta do quarto e no restaurante.
export function PaymentPicker({
  options,
  method,
  onMethod,
  brand,
  onBrand,
  small,
}: {
  options: PaymentOptions;
  method: Method;
  onMethod: (m: Method) => void;
  brand: string;
  onBrand: (b: string) => void;
  small?: boolean;
}) {
  const isCard = method === "CREDITO" || method === "DEBITO";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {options.methods.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={method === m}
            onClick={() => onMethod(m)}
            className={`rounded-lg border-2 ${small ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm"} font-medium ${
              method === m ? "border-blue-600 bg-blue-50" : "border-zinc-200 bg-white hover:border-zinc-400"
            }`}
          >
            {METHOD[m].icon} {METHOD[m].label}
          </button>
        ))}
      </div>
      {isCard && options.brands.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-zinc-500">Bandeira:</span>
          {options.brands.map((b) => (
            <button
              key={b}
              type="button"
              aria-pressed={brand === b}
              onClick={() => onBrand(b)}
              className={`rounded-full border px-2.5 py-1 text-xs ${brand === b ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white hover:border-zinc-500"}`}
            >
              {b}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Falta escolher a bandeira?
export function needsBrand(options: PaymentOptions, method: Method, brand: string) {
  return (method === "CREDITO" || method === "DEBITO") && options.brands.length > 0 && !brand;
}
