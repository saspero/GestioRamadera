import bcrypt from 'bcryptjs'

const COST_FACTOR = 12 // Mínim recomanat per seguretat

/**
 * Genera un hash bcrypt d'una contrasenya.
 * Usar únicament al backend, mai al client.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST_FACTOR)
}

/**
 * Compara una contrasenya en clar amb el seu hash.
 * Retorna true si coincideixen, false en cas contrari.
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
