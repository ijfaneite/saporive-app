/**
 * @fileoverview Generates formatted order IDs.
 */

/**
 * Generates a formatted order ID string based on the current date and a sequential counter.
 * The format is YYMMDD-XXX.
 * @param counter The sequential number for the order.
 * @returns The formatted order ID string.
 */
export function generarIdCorrelativo(counter: number): string {
    const date = new Date();
    const year = String(date.getFullYear()).slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const counterStr = String(counter).padStart(3, '0');
    return `${year}${month}${day}-${counterStr}`;
}
