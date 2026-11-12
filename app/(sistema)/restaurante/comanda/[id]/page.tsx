import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/auth/dal";
import { can } from "@/lib/permissions";
import { getComanda, inHouseGuests, listMenu } from "@/lib/restaurant/service";
import { ComandaScreen } from "./screen";
import { getHotelSettings, listCardBrands } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function ComandaPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requirePermission("restaurant.use");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = getDb();
  const [comanda, menu, guests, settings, brands] = await Promise.all([
    getComanda(db, id),
    listMenu(db, "RESTAURANTE"),
    inHouseGuests(db),
    getHotelSettings(db),
    listCardBrands(db, true),
  ]);
  if (!comanda) notFound();
  return <ComandaScreen c={comanda} menu={menu} guests={guests} canCancel={can(user.role, "restaurant.cancel")}
      paymentOptions={{ methods: settings.enabledMethods, brands: brands.map((b) => b.name) }}
    />;
}
