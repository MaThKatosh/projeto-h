import type { Metadata } from "next";
import { getDb } from "@/lib/db";
import { getHotelSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Política de privacidade" };

// Política de privacidade pública (link na tela de entrada e na página do QR).
// Modelo: o hotel deve revisar com o seu responsável jurídico.
export default async function PrivacidadePublica() {
  const { hotelName } = await getHotelSettings(getDb());
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6 text-sm leading-relaxed text-zinc-800">
      <h1 className="text-2xl font-bold">Política de privacidade — {hotelName}</h1>
      <p>Esta página explica quais dados pessoais o {hotelName} trata, por que e quais são os seus direitos, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).</p>
      <h2 className="text-lg font-semibold">Quais dados</h2>
      <p>Na hospedagem: nome, documento, data de nascimento, sexo, nacionalidade, profissão, endereço, telefone, e-mail, motivo da viagem, procedência e destino (Ficha Nacional de Registro de Hóspedes), placa do veículo e o consumo e os pagamentos da estadia. Nunca guardamos o número do seu cartão: o pagamento é feito na maquininha.</p>
      <h2 className="text-lg font-semibold">Por que</h2>
      <ul className="list-disc pl-5">
        <li>Cumprir a obrigação legal de registro de hóspedes (Lei 11.771/2008) e obrigações fiscais.</li>
        <li>Prestar o serviço contratado: reserva, hospedagem, conta e atendimento dos seus pedidos.</li>
      </ul>
      <h2 className="text-lg font-semibold">Com quem compartilhamos</h2>
      <p>Apenas com órgãos públicos quando a lei exige e com prestadores necessários à reserva (por exemplo, o site onde você reservou). Não vendemos dados.</p>
      <h2 className="text-lg font-semibold">Por quanto tempo</h2>
      <p>Pelo prazo exigido em lei (em geral, 5 anos após a estadia). Depois disso, os dados que identificam você são anonimizados.</p>
      <h2 className="text-lg font-semibold">Seus direitos</h2>
      <p>Você pode pedir na recepção: confirmação e acesso aos seus dados, correção, cópia, e eliminação do que não for obrigatório guardar.</p>
      <h2 className="text-lg font-semibold">Pedidos pelo QR code do quarto</h2>
      <p>A página aberta pelo QR code registra apenas o pedido (por exemplo, limpeza ou um problema no quarto) e o quarto de onde ele veio.</p>
      <p className="text-xs text-zinc-500">Modelo de política: o hotel deve revisá-lo com seu responsável jurídico e informar o contato do encarregado de dados (DPO).</p>
    </main>
  );
}
