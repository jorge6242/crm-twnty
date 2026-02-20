/**
 * Normaliza un número de teléfono eliminando caracteres especiales
 * @param {string} phone - Número de teléfono a normalizar
 * @returns {string} - Solo dígitos del teléfono
 * @example
 * normalizePhone("+34 612-345-678") // "34612345678"
 * normalizePhone("(34) 612 345 678") // "34612345678"
 */
export const normalizePhone = (phone: string): string => {
  if (!phone || typeof phone !== 'string') return '';
  // Eliminar: espacios, guiones, paréntesis, símbolo +
  return phone.replace(/[\s\-\(\)\+]/g, '');
}
