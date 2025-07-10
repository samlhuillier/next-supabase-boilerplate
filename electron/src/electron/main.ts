import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  IpcMainEvent,
  IpcMainInvokeEvent,
} from "electron";
import * as os from "os";
import * as path from "path";
import { URL } from "url";

import { checkPermissions } from "./utils/permission";
import { startStreaming, stopStreaming } from "./utils/recording";
import { handleAuthCallback, getCurrentUser, signOut } from "./utils/auth";
import { logger } from "./utils/logger";

declare global {
  var mainWindow: BrowserWindow;
}

const createWindow = async (): Promise<void> => {
  logger.info("Creating window...");
  global.mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: true,
    },
  });
  logger.info("Window created");

  logger.info("Checking permissions...");
  const isPermissionGranted: boolean = await checkPermissions();
  logger.info("Permission granted:", { isPermissionGranted });

  const recordingPath: string = path.join(
    __dirname,
    "../dist/src/react/recording/index.html"
  );
  const permissionPath: string = path.join(
    __dirname,
    "../dist/src/react/permission-denied/index.html"
  );

  logger.info("Recording screen path:", { recordingPath });
  logger.info("Permission screen path:", { permissionPath });

  if (isPermissionGranted) {
    logger.info("Loading recording screen...");
    global.mainWindow.loadFile(recordingPath);
  } else {
    logger.info("Loading permission denied screen...");
    global.mainWindow.loadFile(permissionPath);
  }
};

ipcMain.on("open-folder-dialog", async (event: IpcMainEvent): Promise<void> => {
  const desktopPath: string = path.join(os.homedir(), "Desktop");

  const { filePaths, canceled } = await dialog.showOpenDialog(
    global.mainWindow,
    {
      properties: ["openDirectory"],
      buttonLabel: "Select Folder",
      title: "Select a folder",
      message: "Please select a folder for saving the recording",
      defaultPath: desktopPath,
    }
  );

  if (!canceled) {
    event.sender.send("selected-folder", filePaths[0]);
  }
});

ipcMain.on("start-streaming", async (_: IpcMainEvent): Promise<void> => {
  await startStreaming();
});

ipcMain.on("stop-streaming", (): void => {
  stopStreaming();
});

// Keep legacy handlers for backward compatibility
ipcMain.on("start-recording", async (_: IpcMainEvent): Promise<void> => {
  await startStreaming();
});

ipcMain.on("stop-recording", (): void => {
  stopStreaming();
});

ipcMain.handle("check-permissions", async (): Promise<void> => {
  const isPermissionGranted: boolean = await checkPermissions();

  if (isPermissionGranted) {
    global.mainWindow.loadFile(
      path.join(__dirname, "../dist/src/react/recording/index.html")
    );
  } else {
    const response = await dialog.showMessageBox(global.mainWindow, {
      type: "warning",
      title: "Permission Denied",
      message:
        "You need to grant permission for screen recording. Would you like to open System Preferences now?",
      buttons: ["Open System Preferences", "Cancel"],
    });

    if (response.response === 0) {
      shell.openExternal(
        "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
      );
    }
  }
});

// Authentication IPC handlers
ipcMain.handle("get-current-user", async (): Promise<any> => {
  return await getCurrentUser();
});

ipcMain.on("sign-out", async (): Promise<void> => {
  await signOut();
});

ipcMain.on("open-web-auth", async (): Promise<void> => {
  const authUrl =
    process.env.NODE_ENV === "production"
      ? "https://next-supabase-boilerplate-olive.vercel.app"
      : "http://localhost:3000";
  shell.openExternal(`${authUrl}/auth?desktop=true`);
});

// Register protocol handler for deep linking
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("maurice", process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient("maurice");
}

// Handle deep link on Windows/Linux when app is already running
app.on("second-instance", (_, commandLine) => {
  if (global.mainWindow) {
    if (global.mainWindow.isMinimized()) global.mainWindow.restore();
    global.mainWindow.focus();
  }

  const url = commandLine.find((arg) => arg.startsWith("maurice://"));
  if (url) {
    handleDeepLink(url);
  }
});

// Handle deep link on macOS when app is already running
app.on("open-url", (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

const handleDeepLink = (url: string) => {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol === "maurice:" && parsedUrl.hostname === "auth") {
      const hashedToken = parsedUrl.searchParams.get("hashed_token");
      if (hashedToken) {
        handleAuthCallback(hashedToken);
      }
    }
  } catch (error) {
    logger.error("Failed to parse deep link URL:", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

app.whenReady().then(createWindow);

// Handle deep link when app is launched from protocol
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  // Check for deep link URL in process arguments when app is started
  const url = process.argv.find((arg) => arg.startsWith("maurice://"));
  if (url) {
    app.whenReady().then(() => {
      handleDeepLink(url);
    });
  }
}
