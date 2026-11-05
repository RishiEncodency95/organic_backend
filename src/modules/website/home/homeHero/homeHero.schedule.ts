/**
 * Hero banner scheduling — pure helpers (no DB), so they can be unit-tested.
 *
 * Admins enter schedule dates/times in India Standard Time (IST, UTC+05:30) but the
 * server usually runs in UTC. Parsing with `new Date(y, m, d, ...)` used the *server's*
 * timezone, so a slide set for 10:00 IST went live at 15:30 IST. Every schedule value is
 * therefore interpreted as IST, whatever timezone the server / browser runs in.
 */

export const IST_OFFSET_MS = 330 * 60 * 1000;

export const parseScheduleDateTime = (dateStr?: unknown, timeStr?: unknown, isEnd = false): number | null => {
  if (!dateStr || typeof dateStr !== "string" || !dateStr.trim()) return null;
  const parts = dateStr.trim().split("-");
  if (parts.length !== 3) return null;

  let year: number;
  let month: number;
  let day: number;

  if (parts[0].length === 4) {
    year = Number(parts[0]);
    month = Number(parts[1]) - 1;
    day = Number(parts[2]);
  } else if (parts[2].length === 4) {
    day = Number(parts[0]);
    month = Number(parts[1]) - 1;
    year = Number(parts[2]);
  } else {
    return null;
  }

  let hours = isEnd ? 23 : 0;
  let minutes = isEnd ? 59 : 0;
  let seconds = isEnd ? 59 : 0;
  let ms = isEnd ? 999 : 0;

  if (timeStr && typeof timeStr === "string" && timeStr.trim()) {
    const timeParts = timeStr.trim().split(":");
    if (timeParts.length >= 2) {
      hours = Number(timeParts[0]) || 0;
      minutes = Number(timeParts[1]) || 0;
      seconds = 0;
      ms = 0;
    }
  }

  // Wall-clock fields are IST: build them as UTC, then shift back by the IST offset.
  const value = Date.UTC(year, month, day, hours, minutes, seconds, ms) - IST_OFFSET_MS;
  return Number.isNaN(value) ? null : value;
};

/** Is the slide on the website at instant `now`? */
export const isSlideActiveAt = (slide: any, now: number): boolean => {
  // If schedule is not enabled, the slide is always active
  if (!slide.isScheduled) {
    return true;
  }

  const startMs = parseScheduleDateTime(slide.startDate, slide.startTime, false);
  if (startMs !== null && now < startMs) {
    return false; // not started yet
  }

  const endMs = parseScheduleDateTime(slide.endDate, slide.endTime, true);
  if (endMs !== null && now > endMs) {
    return false; // expired
  }

  return true;
};

/**
 * Is the slide on the website right now? Takes ONLY the slide, so it is safe to pass straight
 * to Array.filter (filter's 2nd argument is the index, which must never be read as a time).
 */
export const isSlideActive = (slide: any): boolean => isSlideActiveAt(slide, Date.now());

/** Returns a human-readable problem with a slide's schedule, or null when it is fine. */
export const validateSlideSchedule = (slide: any): string | null => {
  if (!slide?.isScheduled) return null;
  const startMs = parseScheduleDateTime(slide.startDate, slide.startTime, false);
  const endMs = parseScheduleDateTime(slide.endDate, slide.endTime, true);
  if (startMs !== null && endMs !== null && endMs < startMs) {
    return "The end date/time is before the start date/time.";
  }
  return null;
};
