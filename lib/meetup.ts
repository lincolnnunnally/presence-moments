/**
 * Weekly meetups on a coin run (owner, 2026-11-19: "every Monday at Birdies
 * 10 am"). The schedule and weeks off are kept in the run's batch notes and
 * edited in Laser Engraving -> Tokens. The same rules are mirrored in Laser's
 * tokens_router.py (_next_meetings) so the page and the emails agree.
 */

export const MEETUP_TZ = "America/New_York";
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export type MeetupSkip = { date: string; note: string };

export type MeetupSchedule = {
  weekday: number;
  /** "HH:MM", 24-hour, in MEETUP_TZ. */
  time: string;
  place: string | null;
  address: string | null;
  skips: MeetupSkip[];
};

export type MeetupDate = { date: string; skipped: boolean; note: string | null };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]?\d|2[0-3]):([0-5]\d)$/;

function str(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

/** Read the schedule from a run's notes. Null when the run is not a weekly meetup. */
export function meetupFrom(notes: Record<string, unknown>): MeetupSchedule | null {
  const weekday = Number(notes.meetup_weekday);
  const time = str(notes.meetup_time, 5);
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !time || !TIME.test(time)) return null;
  let skips: MeetupSkip[] = [];
  const raw = notes.meetup_skips;
  const list = typeof raw === "string" ? (() => { try { return JSON.parse(raw); } catch { return []; } })() : raw;
  if (Array.isArray(list)) {
    skips = list
      .map((item) => ({ date: str(item?.date, 10) || "", note: str(item?.note, 300) || "" }))
      .filter((item) => DATE.test(item.date));
  }
  return { weekday, time, place: str(notes.meetup_place, 120), address: str(notes.meetup_address, 200), skips };
}

/** The calendar date and clock time right now in the meetup's time zone. */
function localNow(now: Date): { date: string; minutes: number; weekday: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: MEETUP_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return { date, minutes: Number(parts.hour) * 60 + Number(parts.minute), weekday };
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * The next `count` meeting dates, weeks off included and marked. A meeting
 * stays "next" until two hours after it starts, so a scan during the meetup
 * still shows today's.
 */
export function upcomingMeetings(schedule: MeetupSchedule, now = new Date(), count = 6): MeetupDate[] {
  const local = localNow(now);
  const [h, m] = schedule.time.split(":").map(Number);
  let ahead = (schedule.weekday - local.weekday + 7) % 7;
  if (ahead === 0 && local.minutes > h * 60 + m + 120) ahead = 7;
  const first = addDays(local.date, ahead);
  const skips = new Map(schedule.skips.map((skip) => [skip.date, skip.note]));
  return Array.from({ length: count }, (_, index) => {
    const date = addDays(first, index * 7);
    return { date, skipped: skips.has(date), note: skips.get(date) || null };
  });
}

export function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** "Monday, November 24" */
export function formatMeetingDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function isEmail(value: string): boolean {
  return /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i.test(value) && value.length <= 254;
}
