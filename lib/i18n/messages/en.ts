// Inglês: lido das tabelas português → inglês → espanhol (table-*.json).
// Para traduzir uma frase nova, acrescente uma linha numa tabela.
import type { Dict } from "@/lib/i18n/translate";
import t1 from "./table-1.json";
import t2 from "./table-2.json";
import t3 from "./table-3.json";
import t4 from "./table-4.json";
import t5 from "./table-5.json";
import t6 from "./table-6.json";

const en: Dict = Object.fromEntries([...t1, ...t2, ...t3, ...t4, ...t5, ...t6].map((row) => [row[0], row[1]]));

export default en;
