/**
 * Google Calendar FreeBusy API wrapper.
 * Read-only — uses POST /calendar/v3/freeBusy.
 * Never reads event titles or details; only busy/free time blocks.
 * Filters to business hours (Mon–Fri, 9am–5pm local time).
 */

export interface CalendarSlot {
  start: Date;
  end: Date;
}

interface FreeBusyPeriod {
  start: string;
  end: string;
}

interface FreeBusyResponse {
  calendars: {
    primary: {
      busy: FreeBusyPeriod[];
      errors?: { domain: string; reason: string }[];
    };
  };
}

const SLOT_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const BUSINESS_START_HOUR = 9;
const BUSINESS_END_HOUR = 17;
const MAX_SLOTS = 10;
const DAYS_AHEAD = 7;

/** Returns true if the given date is a weekday (Mon–Fri). */
function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

/**
 * Fetch free 30-min slots from Google Calendar FreeBusy API.
 * Returns up to MAX_SLOTS available slots over the next DAYS_AHEAD weekdays.
 */
export async function getFreeBusySlots(
  accessToken: string,
  daysAhead: number = DAYS_AHEAD
): Promise<CalendarSlot[]> {
  const now = new Date();
  // Start from the next 30-min boundary
  const startTime = new Date(Math.ceil(now.getTime() / SLOT_DURATION_MS) * SLOT_DURATION_MS);
  const endTime = new Date(startTime.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const body = {
    timeMin: startTime.toISOString(),
    timeMax: endTime.toISOString(),
    items: [{ id: 'primary' }],
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Calendar API error: ${res.status}`);
  }

  const data: FreeBusyResponse = await res.json();
  const busyPeriods = (data.calendars?.primary?.busy || []).map(b => ({
    start: new Date(b.start).getTime(),
    end: new Date(b.end).getTime(),
  }));

  // Build candidate 30-min slots within business hours over next N days
  const slots: CalendarSlot[] = [];
  const cursor = new Date(startTime);

  while (cursor < endTime && slots.length < MAX_SLOTS) {
    if (!isWeekday(cursor)) {
      // Skip to Monday
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(BUSINESS_START_HOUR, 0, 0, 0);
      continue;
    }

    const hour = cursor.getHours();
    if (hour < BUSINESS_START_HOUR) {
      cursor.setHours(BUSINESS_START_HOUR, 0, 0, 0);
      continue;
    }
    if (hour >= BUSINESS_END_HOUR) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(BUSINESS_START_HOUR, 0, 0, 0);
      continue;
    }

    const slotStart = cursor.getTime();
    const slotEnd = slotStart + SLOT_DURATION_MS;

    // Check if this slot overlaps any busy period
    const isBusy = busyPeriods.some(
      b => slotStart < b.end && slotEnd > b.start
    );

    if (!isBusy) {
      slots.push({ start: new Date(slotStart), end: new Date(slotEnd) });
    }

    cursor.setTime(slotStart + SLOT_DURATION_MS);
  }

  return slots;
}

/** Format a CalendarSlot into a human-readable string for email insertion. */
export function formatSlotForEmail(slot: CalendarSlot): string {
  const opts: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };
  return slot.start.toLocaleString('en-US', opts);
}

/** Build the availability block text to insert into an email draft. */
export function buildAvailabilityText(slots: CalendarSlot[], maxSlots = 5): string {
  const selected = slots.slice(0, maxSlots);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const lines = selected.map(s => `• ${formatSlotForEmail(s)}`).join('\n');
  return `I'm available at the following times (${tz}):\n${lines}\n\nPlease reply with your preferred time and I'll send a calendar invite.`;
}

/** Quick availability check for a preview (no slot building). */
export async function checkCalendarAccess(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return res.ok;
  } catch {
    return false;
  }
}
