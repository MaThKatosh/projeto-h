import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { getHotelSettings } from "@/lib/settings";
import { LoginForm } from "./login-form";
import { LanguageSwitch } from "./language-switch";
import { DemoAccounts } from "./demo-accounts";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, isDemo } from "@/lib/demo";

import { getT } from "@/lib/i18n/server";
export default async function EntrarPage() {
  const tr = await getT();
  if (await getCurrentSession()) redirect("/mapa");
  const { hotelName } = await getHotelSettings(getDb());

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-700 to-indigo-900 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-2xl font-black text-white">H</div>
          <h1 className="text-xl font-bold">{hotelName}</h1>
          <p className="text-sm text-zinc-500">{tr("Entre com o usuário que o gerente criou para você.")}</p>
        </div>
        <LoginForm />
        {isDemo() && <DemoAccounts accounts={DEMO_ACCOUNTS.map(({ username, hint }) => ({ username, hint }))} password={DEMO_PASSWORD} />}
        <LanguageSwitch />
      </div>
    </main>
  );
}
