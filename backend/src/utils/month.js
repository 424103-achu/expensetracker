export function getMonthKey(dateStr = new Date().toISOString().slice(0, 10)) {
  return dateStr.slice(0, 7);
}
