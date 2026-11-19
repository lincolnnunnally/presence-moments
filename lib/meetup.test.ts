import assert from "node:assert/strict";
import test from "node:test";
import { formatMeetingDate, formatTime, isEmail, meetupFrom, upcomingMeetings } from "./meetup.ts";

const mondays = meetupFrom({ meetup_weekday: "1", meetup_time: "10:00", meetup_place: "Birdies" })!;

test("a run without a weekly schedule is not a meetup", () => {
  assert.equal(meetupFrom({}), null);
  assert.equal(meetupFrom({ meetup_weekday: "1", meetup_time: "25:00" }), null);
});

test("the next meeting is the coming Monday, in Georgia time", () => {
  // Wednesday Nov 19 2026, 3 pm Eastern
  const next = upcomingMeetings(mondays, new Date("2026-11-19T20:00:00Z"), 3);
  assert.deepEqual(next.map((m) => m.date), ["2026-11-23", "2026-11-30", "2026-12-07"]);
});

test("on Monday the meetup is still 'next' until two hours after it starts", () => {
  assert.equal(upcomingMeetings(mondays, new Date("2026-11-23T15:30:00Z"), 1)[0].date, "2026-11-23"); // 10:30 am ET
  assert.equal(upcomingMeetings(mondays, new Date("2026-11-23T17:30:00Z"), 1)[0].date, "2026-11-30"); // 12:30 pm ET
});

test("late Sunday night in Georgia is still Sunday, even though it is Monday in UTC", () => {
  assert.equal(upcomingMeetings(mondays, new Date("2026-11-23T03:00:00Z"), 1)[0].date, "2026-11-23");
});

test("a week off is marked with its note and the meeting after it still shows", () => {
  const off = meetupFrom({ meetup_weekday: 1, meetup_time: "10:00", meetup_skips: JSON.stringify([{ date: "2026-11-23", note: "Thanksgiving week" }]) })!;
  const [first, second] = upcomingMeetings(off, new Date("2026-11-19T20:00:00Z"), 2);
  assert.deepEqual(first, { date: "2026-11-23", skipped: true, note: "Thanksgiving week" });
  assert.equal(second.skipped, false);
});

test("times and dates read the way people say them", () => {
  assert.equal(formatTime("10:00"), "10:00 AM");
  assert.equal(formatTime("18:30"), "6:30 PM");
  assert.equal(formatMeetingDate("2026-11-23"), "Monday, November 23");
  assert.ok(isEmail("sam@example.com"));
  assert.ok(!isEmail("not an email"));
});
