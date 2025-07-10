import * as fs from "fs";
import * as path from "path";
import { app } from "electron";

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  data?: any;
}

class Logger {
  private logDir: string;
  private currentLogFile: string;
  private maxLogSize = 10 * 1024 * 1024; // 10MB
  private maxLogFiles = 5;

  constructor() {
    // Create logs directory in user data path for packaged app, or in project root for dev
    if (app.isPackaged) {
      this.logDir = path.join(app.getPath("userData"), "logs");
    } else {
      this.logDir = path.join(process.cwd(), "logs");
    }

    this.ensureLogDirectory();
    this.currentLogFile = this.getCurrentLogFile();
    this.rotateLogsIfNeeded();
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private getCurrentLogFile(): string {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    return path.join(this.logDir, `app-${today}.log`);
  }

  private rotateLogsIfNeeded(): void {
    try {
      // Check if current log file exists and its size
      if (fs.existsSync(this.currentLogFile)) {
        const stats = fs.statSync(this.currentLogFile);
        if (stats.size > this.maxLogSize) {
          this.rotateLogs();
        }
      }

      // Clean up old log files
      this.cleanOldLogs();
    } catch (error) {
      console.error("Error rotating logs:", error);
    }
  }

  private rotateLogs(): void {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const rotatedFile = this.currentLogFile.replace(
        ".log",
        `-${timestamp}.log`
      );
      fs.renameSync(this.currentLogFile, rotatedFile);
    } catch (error) {
      console.error("Error rotating log file:", error);
    }
  }

  private cleanOldLogs(): void {
    try {
      const logFiles = fs
        .readdirSync(this.logDir)
        .filter((file) => file.endsWith(".log"))
        .map((file) => ({
          name: file,
          path: path.join(this.logDir, file),
          mtime: fs.statSync(path.join(this.logDir, file)).mtime,
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // Keep only the most recent log files
      if (logFiles.length > this.maxLogFiles) {
        const filesToDelete = logFiles.slice(this.maxLogFiles);
        filesToDelete.forEach((file) => {
          try {
            fs.unlinkSync(file.path);
          } catch (error) {
            console.error(`Error deleting old log file ${file.name}:`, error);
          }
        });
      }
    } catch (error) {
      console.error("Error cleaning old logs:", error);
    }
  }

  private writeLog(level: string, message: string, data?: any): void {
    try {
      // Update current log file path (in case date changed)
      const newLogFile = this.getCurrentLogFile();
      if (newLogFile !== this.currentLogFile) {
        this.currentLogFile = newLogFile;
      }

      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: level.toUpperCase(),
        message,
        ...(data && { data }),
      };

      const logLine = `[${logEntry.timestamp}] ${logEntry.level}: ${
        logEntry.message
      }${logEntry.data ? ` | Data: ${JSON.stringify(logEntry.data)}` : ""}\n`;

      // Also log to console in development
      if (!app.isPackaged) {
        const consoleMethod =
          level === "error"
            ? console.error
            : level === "warn"
            ? console.warn
            : console.log;
        consoleMethod(`[${level.toUpperCase()}] ${message}`, data || "");
      }

      // Write to file
      fs.appendFileSync(this.currentLogFile, logLine);

      // Check if we need to rotate logs after writing
      this.rotateLogsIfNeeded();
    } catch (error) {
      // Fallback to console if file logging fails
      console.error("Failed to write to log file:", error);
      console.log(`[${level.toUpperCase()}] ${message}`, data || "");
    }
  }

  info(message: string, data?: any): void {
    this.writeLog("info", message, data);
  }

  warn(message: string, data?: any): void {
    this.writeLog("warn", message, data);
  }

  error(message: string, data?: any): void {
    this.writeLog("error", message, data);
  }

  debug(message: string, data?: any): void {
    this.writeLog("debug", message, data);
  }

  getLogDir(): string {
    return this.logDir;
  }

  // getCurrentLogFile(): string {
  //   return this.currentLogFile;
  // }
}

// Create and export a singleton instance
export const logger = new Logger();

// Export convenience functions that match console API
export const log = {
  info: (message: string, data?: any) => logger.info(message, data),
  warn: (message: string, data?: any) => logger.warn(message, data),
  error: (message: string, data?: any) => logger.error(message, data),
  debug: (message: string, data?: any) => logger.debug(message, data),
  // Alias for console.log compatibility
  log: (message: string, data?: any) => logger.info(message, data),
};
