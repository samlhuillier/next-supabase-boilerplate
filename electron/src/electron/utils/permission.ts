import { promisify } from "util";
import { exec } from "child_process";
import * as path from "path";
import { app } from "electron";

const execAsync = promisify(exec);

interface PermissionResponse {
  code: string;
}

const getRecorderPath = (): string => {
  if (app.isPackaged) {
    // In packaged app, the binary is directly in Resources
    return path.join(process.resourcesPath, "Recorder");
  } else {
    // In development
    return "./src/swift/Recorder";
  }
};

export const checkPermissions = async (): Promise<boolean> => {
  const recorderPath: string = getRecorderPath();
  console.log("recorderPath", recorderPath);
  const { stdout: checkPermissionStdout } = await execAsync(
    `"${recorderPath}" --check-permissions`
  );
  console.log("checkPermissionStdout", checkPermissionStdout);
  const { code: checkPermissionCode }: PermissionResponse = JSON.parse(
    checkPermissionStdout
  );
  console.log("checkPermissionCode", checkPermissionCode);

  return checkPermissionCode === "PERMISSION_GRANTED";
};
