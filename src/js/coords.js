/**
 * Парсит строку с координатами.
 * Поддерживает форматы: "51.50851, -0.12572", "51.50851,-0.12572", "[51.50851, -0.12572]"
 */
export function parseCoords(str) {
  if (!str) throw new Error('Пустая строка');
  
  // Убираем квадратные скобки и лишние пробелы по краям
  const cleanStr = str.replace(/[\[\]]/g, '').trim();
  
  // Разделяем по запятой
  const parts = cleanStr.split(',');
  if (parts.length !== 2) throw new Error('Неверный формат');
  
  const lat = parseFloat(parts[0].trim());
  const lon = parseFloat(parts[1].trim());
  
  if (isNaN(lat) || isNaN(lon)) {
    throw new Error('Неверный формат');
  }
  
  // Опционально: проверка диапазонов широты и долготы
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new Error('Координаты вне допустимого диапазона');
  }
  
  return { lat, lon };
}