import { hash, verify } from "@node-rs/argon2";

// ================================================================
// SENHAS — Argon2id
// ================================================================
//
// Parâmetros padrão da biblioteca: Argon2id, m=19 MiB, t=2, p=1
// (mínimo recomendado pela OWASP). O salt é gerado por hash e fica
// embutido no resultado ($argon2id$v=19$m=...$salt$hash).

export async function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export async function verifyPassword(
  passwordHash: string,
  password: string
): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    // Hash corrompido ou em formato desconhecido: nunca autentica.
    return false;
  }
}

// Hash de uma senha aleatória, calculado uma vez. Usado quando o e-mail
// não existe, para que o tempo de resposta do login não revele se a
// conta existe.
let dummyHash: Promise<string> | undefined;

export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hash(crypto.randomUUID());
  await verifyPassword(await dummyHash, password);
  return false;
}
