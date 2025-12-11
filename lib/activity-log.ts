type ActivityTiming = {
  startedAt?: string;
  timestamp?: string;
  durationMs?: number;
};

const formatTime = (value?: string) => {
  if (!value) {
    return 'En cours';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleTimeString();
};

const computeDuration = ({ startedAt, timestamp, durationMs }: ActivityTiming) => {
  if (typeof durationMs === 'number' && durationMs >= 0) {
    return durationMs;
  }
  if (!startedAt) {
    return undefined;
  }
  const startDate = new Date(startedAt);
  if (Number.isNaN(startDate.getTime())) {
    return undefined;
  }
  const endDate = timestamp ? new Date(timestamp) : new Date();
  if (Number.isNaN(endDate.getTime())) {
    return undefined;
  }
  const diff = endDate.getTime() - startDate.getTime();
  return diff >= 0 ? diff : undefined;
};

const formatDuration = (timing: ActivityTiming) => {
  const value = computeDuration(timing);
  if (value === undefined) {
    return 'En cours';
  }
  const totalSeconds = Math.max(0, Math.round(value / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  }
  return `${seconds}s`;
};

export { formatTime as formatActivityTime, formatDuration as formatActivityDuration, computeDuration as computeActivityDuration };
