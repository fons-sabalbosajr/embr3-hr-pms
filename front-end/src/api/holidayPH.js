export async function fetchPhilippineHolidays(year) {
  // Using Nager.Date API (no API key required)
  const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/PH`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const holidays = await res.json();
  // Returns array of { date: "YYYY-MM-DD", localName: "Holiday Name", ... }
  return holidays;
}