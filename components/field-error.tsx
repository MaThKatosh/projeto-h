"use client";

import { useT } from "@/components/i18n";

// Mensagens vêm do servidor em português e são traduzidas aqui.
export function FieldError({ messages }: { messages?: string[] }) {
  const tr = useT();
  if (!messages?.length) return null;
  return <span className="mt-1 block text-xs text-red-600">{tr(messages[0])}</span>;
}

export function FormMessage({ error, success }: { error?: string; success?: string }) {
  const tr = useT();
  if (error) {
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {tr(error)}
      </p>
    );
  }
  if (success) {
    return (
      <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
        {tr(success)}
      </p>
    );
  }
  return null;
}
