import { LogLevel } from '../../types/dashboard';

interface LogLineProps {
  timestamp: string;
  level: LogLevel;
  message: string;
}

/**
 * Level colors per UI-SPEC
 * INFO: #58a6ff (blue)
 * EXEC: #d2a8ff (purple)
 * SUCCESS: #238636 (green)
 * WARN: #d29922 (yellow)
 * ERROR: #f85149 (red)
 */
const levelColors: Record<LogLevel, string> = {
  INFO: '#58a6ff',
  EXEC: '#d2a8ff',
  SUCCESS: '#238636',
  WARN: '#d29922',
  ERROR: '#f85149',
};

/**
 * Format timestamp to "yyyy-MM-dd HH:mm:ss"
 */
function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function LogLine({ timestamp, level, message }: LogLineProps) {
  const formattedTimestamp = formatTimestamp(timestamp);
  const levelColor = levelColors[level];

  return (
    <div className="font-mono text-[13px] leading-[20px] whitespace-pre-wrap">
      <span className="text-[#6b7780]">[{formattedTimestamp}]</span>
      <span className="ml-2" style={{ color: levelColor }}>
        [{level}]
      </span>
      <span className="ml-2 text-[#c9d1d9]">{message}</span>
    </div>
  );
}