import { Timestamp } from 'firebase/firestore';

export const extractTimestampMs = (val: any): number => {
  if (!val) return 0;
  if (typeof val === 'number' && !isNaN(val) && val > 0) {
    if (val < 10000000000) return val * 1000;
    return val;
  }
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.getTime();
  }
  if (val instanceof Timestamp) {
    try {
      return val.toMillis();
    } catch (e) {}
  }
  if (typeof val?.toMillis === 'function') {
    try {
      const ms = val.toMillis();
      if (typeof ms === 'number' && !isNaN(ms) && ms > 0) return ms;
    } catch (e) {}
  }
  if (typeof val?.toDate === 'function') {
    try {
      const d = val.toDate();
      if (d instanceof Date && !isNaN(d.getTime())) return d.getTime();
    } catch (e) {}
  }
  if (typeof val?.seconds === 'number' && !isNaN(val.seconds)) {
    const ms = val.seconds * 1000 + (val.nanoseconds ? Math.floor(val.nanoseconds / 1000000) : 0);
    if (ms > 0) return ms;
  }
  if (typeof val?._seconds === 'number' && !isNaN(val._seconds)) {
    const ms = val._seconds * 1000 + (val._nanoseconds ? Math.floor(val._nanoseconds / 1000000) : 0);
    if (ms > 0) return ms;
  }
  if (typeof val?.timestampMs === 'number' && val.timestampMs > 0) {
    return val.timestampMs;
  }
  if (typeof val?.latestMessageAtMs === 'number' && val.latestMessageAtMs > 0) {
    return val.latestMessageAtMs;
  }
  if (typeof val?.updatedAtMs === 'number' && val.updatedAtMs > 0) {
    return val.updatedAtMs;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed) {
      const parsed = Date.parse(trimmed);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  }
  if (typeof val === 'object' && val !== null) {
    if (val.latestMessageAt && val.latestMessageAt !== val) {
      const ms = extractTimestampMs(val.latestMessageAt);
      if (ms > 0) return ms;
    }
    if (val.timestamp && val.timestamp !== val) {
      const ms = extractTimestampMs(val.timestamp);
      if (ms > 0) return ms;
    }
    if (val.updatedAt && val.updatedAt !== val) {
      const ms = extractTimestampMs(val.updatedAt);
      if (ms > 0) return ms;
    }
    if (val.createdAt && val.createdAt !== val) {
      const ms = extractTimestampMs(val.createdAt);
      if (ms > 0) return ms;
    }
  }
  return 0;
};

export const toDateSafe = (timestamp: any): Date | null => {
  if (!timestamp) return null;
  const ms = extractTimestampMs(timestamp);
  if (ms > 0) return new Date(ms);
  return null;
};

/**
 * Intelligent relative timestamp formatter for Aeirmist
 * - Within 24h: 2m ago, 3h ago, etc.
 * - Same year: 12 Jun at 6:45 PM
 * - Different year: 12 Jun 2024 at 6:45 PM
 */
export const formatAeirmistTimestamp = (timestamp: any): string => {
  if (!timestamp) return 'Just now';
  
  const date = toDateSafe(timestamp);
  if (!date) return 'Just now';

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  
  if (diffInSeconds < 3600) {
    return `${Math.floor(diffInSeconds / 60)}m ago`;
  }
  
  if (diffInSeconds < 86400) {
    return `${Math.floor(diffInSeconds / 3600)}h ago`;
  }

  const isSameYear = date.getFullYear() === now.getFullYear();
  const day = date.getDate();
  const month = date.toLocaleString('default', { month: 'short' });
  const year = date.getFullYear();
  const time = date.toLocaleString('default', { hour: 'numeric', minute: '2-digit', hour12: true });

  // Check if yesterday
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday at ${time}`;
  }

  if (isSameYear) {
    return `${day} ${month} at ${time}`;
  }

  return `${day} ${month} ${year} at ${time}`;
};

/**
 * Short relative timestamp for messages/comments/seen status
 * e.g. "2m", "3h", "1d"
 */
export const formatShortTimestamp = (timestamp: any): string => {
  if (!timestamp) return 'now';
  
  const date = toDateSafe(timestamp);
  if (!date) return 'now';

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
  
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

/**
 * Formats a timestamp for use as a date separator in chat
 * e.g. "Today", "Yesterday", "June 12"
 */
export const formatDateSeparator = (timestamp: any): string => {
  if (!timestamp) return '';
  
  const date = toDateSafe(timestamp);
  if (!date) return '';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (messageDate.getTime() === today.getTime()) return 'Today';
  if (messageDate.getTime() === yesterday.getTime()) return 'Yesterday';

  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
  if (date.getFullYear() !== now.getFullYear()) {
    options.year = 'numeric';
  }
  return date.toLocaleDateString('en-US', options);
};

/**
 * Formats a timestamp to show only the time (e.g. "9:50 PM")
 */
export const formatTimeOnly = (timestamp: any): string => {
  if (!timestamp) return '';
  if (typeof timestamp === 'string') {
    const trimmed = timestamp.trim();
    if (/^\d{1,2}:\d{2}(\s*(AM|PM|am|pm))?$/.test(trimmed)) {
      return trimmed;
    }
  }
  
  const date = toDateSafe(timestamp);
  if (!date) return typeof timestamp === 'string' ? timestamp : '';

  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
};

/**
 * Formatter for active status (e.g. "Active now", "Active 2m ago")
 */
export const formatActiveStatus = (isOnline: boolean, lastSeen: any, hideExactTime: boolean = false): string => {
  if (isOnline && !hideExactTime) return 'Active now';
  if (hideExactTime) return 'Last seen recently';
  if (!lastSeen) return 'Offline';
  
  const formattedTime = formatAeirmistTimestamp(lastSeen);
  if (formattedTime === 'Just now' || formattedTime.includes('ago')) {
    return `Active ${formattedTime}`;
  }
  return `Last seen ${formattedTime}`;
};

/**
 * Canonical conversation time formatter for Aeirmist inbox
 * - Today: 7:42 PM (12-hour format)
 * - Yesterday: Yesterday
 * - Within current week: weekday (e.g. Tuesday)
 * - Older: short date (e.g. 12 Mar, or 12 Mar 2024 if different year)
 * Safe fallback, never crashes.
 */
export const formatConversationTime = (timestamp: any): string => {
  if (!timestamp) return '';

  // Extract nested timestamp if an object containing timestamp fields was passed
  if (
    typeof timestamp === 'object' &&
    !(timestamp instanceof Date) &&
    !(timestamp instanceof Timestamp) &&
    typeof timestamp.toMillis !== 'function' &&
    typeof timestamp.toDate !== 'function'
  ) {
    if (timestamp.latestMessageAt) timestamp = timestamp.latestMessageAt;
    else if (timestamp.updatedAt) timestamp = timestamp.updatedAt;
    else if (timestamp.timestamp) timestamp = timestamp.timestamp;
    else if (timestamp.createdAt) timestamp = timestamp.createdAt;
  }

  const date = toDateSafe(timestamp);
  if (!date) return '';

  const now = new Date();
  
  // Guard against slight future clock skew (< 5 min)
  if (date.getTime() > now.getTime()) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  // Today: same calendar day in local time
  const isToday = 
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  // Yesterday: previous calendar day in local time
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const isYesterday = 
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return 'Yesterday';
  }

  // Within current calendar week (since Sunday of the current week)
  const currentDayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday ... 6 = Saturday
  const startOfCurrentWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - currentDayOfWeek, 0, 0, 0, 0);
  
  if (date.getTime() >= startOfCurrentWeek.getTime()) {
    return date.toLocaleDateString([], { weekday: 'long' });
  }

  // Older: short date e.g. "12 Mar". If different year, "12 Mar 2024"
  const isSameYear = date.getFullYear() === now.getFullYear();
  if (isSameYear) {
    return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
  }

  return date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * Meta styled inbox timestamp formatter (aliases canonical formatConversationTime)
 */
export const formatMetaInboxTimestamp = formatConversationTime;

