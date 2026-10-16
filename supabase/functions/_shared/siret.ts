// Copie Deno de isValidSiret (src/lib/entity-id.ts) et de public.is_valid_siret (migration
// entity_identifiers) : 14 chiffres + clé de Luhn, exception La Poste (somme multiple de 5).
export function isValidSiret(value: string | null | undefined): boolean {
  if (!value || !/^\d{14}$/.test(value)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let digit = Number(value[13 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  if (sum % 10 === 0) return true;
  if (value.startsWith("356000000")) {
    return [...value].reduce((acc, d) => acc + Number(d), 0) % 5 === 0;
  }
  return false;
}
