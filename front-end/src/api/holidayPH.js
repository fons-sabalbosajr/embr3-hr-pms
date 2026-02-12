export async function fetchPhilippineHolidays(year) {
  // Using Nager.Date API (no API key required)
  const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/PH`;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });
    if (!res.ok) return [];
    const holidays = await res.json();
    // Returns array of { date: "YYYY-MM-DD", localName: "Holiday Name", ... }

    // The API provides 'name' (English) and 'localName'. We will use the English name.
    // NOTE: Chinese New Year is currently inaccurate in this upstream source for PH;
    // exclude it so it won't be treated as an official holiday in DTR screens/PDF.
    return (Array.isArray(holidays) ? holidays : [])
      .filter((holiday) => {
        const n = String(holiday?.name || holiday?.localName || "");
        return !/\bchinese\s+new\s+year\b/i.test(n);
      })
      .map((holiday) => ({
        ...holiday,
        localName: holiday.name,
      }));
  } catch {
    return [];
  }
}