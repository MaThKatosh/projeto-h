import { getDb } from "@/lib/db";
import { requirePermission } from "@/lib/auth/dal";
import { listRooms } from "@/lib/rooms/service";
import { RoomRangeForm, RoomRow, RoomTypeForm } from "./forms";

export const dynamic = "force-dynamic";

export default async function QuartosPage() {
  await requirePermission("rooms.manage");
  const db = getDb();
  const [types, rooms] = await Promise.all([
    db.roomType.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { rooms: true } } } }),
    listRooms(db, { includeInactive: true }),
  ]);
  const typeOptions = types.map((t) => ({ id: t.id, name: t.name }));

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cadastro de quartos</h1>
        <p className="text-sm text-zinc-500">Primeiro crie os tipos de quarto; depois crie os quartos de cada andar.</p>
      </div>

      <section className="card p-5">
        <h2 className="mb-1 font-semibold">1. Tipos de quarto</h2>
        <p className="mb-4 text-sm text-zinc-500">Ex.: Standard Casal, Luxo, Suíte. As tarifas de cada tipo entram na Fase 3.</p>
        <div className="space-y-2">
          {types.map((t) => (
            <RoomTypeForm
              key={t.id}
              type={{ id: t.id, name: t.name, capacity: t.capacity, description: t.description ?? "" }}
              roomCount={t._count.rooms}
            />
          ))}
          <RoomTypeForm />
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-1 font-semibold">2. Criar vários quartos de uma vez</h2>
        <p className="mb-4 text-sm text-zinc-500">Ex.: andar 2, do 201 ao 215. Os que já existem são pulados.</p>
        {types.length === 0 ? (
          <p className="text-sm text-amber-700">Crie um tipo de quarto primeiro.</p>
        ) : (
          <RoomRangeForm types={typeOptions} />
        )}
      </section>

      <section className="card p-5">
        <h2 className="mb-4 font-semibold">3. Quartos cadastrados ({rooms.length})</h2>
        <div className="space-y-2">
          {rooms.map((room) => (
            <RoomRow key={room.id} room={room} types={typeOptions} />
          ))}
          {rooms.length === 0 && <p className="text-sm text-zinc-500">Nenhum quarto ainda.</p>}
        </div>
      </section>
    </div>
  );
}
