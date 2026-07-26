/**
 * ค้นหาแบบ substring ทั่วไป ใช้กับตารางที่ยังไม่มีระบบค้นหาของตัวเอง
 */
export function matchesKeyword<T>(
  item: T,
  keyword: string,
  extractFields: (item: T) => string[]
): boolean {
  const trimmed = keyword.trim().toLowerCase();

  if (!trimmed) {
    return true;
  }

  const searchableText = extractFields(item)
    .join(" ")
    .toLowerCase();

  return searchableText.includes(trimmed);
}
