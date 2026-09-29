export function greetingAt(now: Date, timeZone: string): string {
  const hour = Number(new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).formatToParts(now).find((part) => part.type === "hour")?.value);
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}
