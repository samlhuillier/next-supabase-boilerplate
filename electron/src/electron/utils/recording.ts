import { spawn, ChildProcess } from "node:child_process";
import * as path from "path";
import * as fs from "fs";
import { app } from "electron";
import { checkPermissions } from "./permission";
import {
  startTranscription,
  stopTranscription,
  sendAudioToDeepgram,
} from "./deepgram";
import { logger } from "./logger";

let recordingProcess: ChildProcess | null = null;
let audioFileStream: fs.WriteStream | null = null;
let audioChunkCount = 0;

interface RecordingResponse {
  code: string;
  timestamp: string;
  path?: string;
  data?: string;
  sampleRate?: number;
  channels?: number;
  frameLength?: number;
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

// const convertSequentialToInterleaved = (
//   buffer: Buffer,
//   channels: number
// ): Buffer => {
//   const bytesPerSample = 4; // float32 = 4 bytes
//   const samplesPerChannel = buffer.length / bytesPerSample / channels;
//   const interleavedBuffer = Buffer.alloc(buffer.length);

//   for (let sample = 0; sample < samplesPerChannel; sample++) {
//     for (let channel = 0; channel < channels; channel++) {
//       const sourceIndex =
//         (channel * samplesPerChannel + sample) * bytesPerSample;
//       const targetIndex = (sample * channels + channel) * bytesPerSample;

//       // Copy 4 bytes (float32 sample)
//       buffer.copy(
//         interleavedBuffer,
//         targetIndex,
//         sourceIndex,
//         sourceIndex + bytesPerSample
//       );
//     }
//   }

//   return interleavedBuffer;
// };

const startAudioRecording = (): void => {
  if (app.isPackaged) {
    logger.info("Skipping audio file recording in packaged app");
    return;
  }
  // Create audio recording directory
  const audioDir = path.join(process.cwd(), "recorded-audio");
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }

  // Create a timestamped filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const audioFilePath = path.join(audioDir, `recording-${timestamp}.raw`);

  // Create write stream for audio data
  audioFileStream = fs.createWriteStream(audioFilePath);
  audioChunkCount = 0;

  logger.info(`Started recording audio to: ${audioFilePath}`);

  // Save audio metadata
  const metadataPath = path.join(
    audioDir,
    `recording-${timestamp}.metadata.json`
  );
  const metadata = {
    startTime: new Date().toISOString(),
    sampleRate: 48000, // From Swift code
    channels: 2, // From Swift code
    format: "float32",
    encoding: "interleaved", // Now properly interleaved
    filePath: audioFilePath,
    note: "Audio data has been converted from sequential to interleaved format",
  };
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
};

const stopAudioRecording = (): void => {
  if (audioFileStream) {
    audioFileStream.end();
    audioFileStream = null;
    logger.info(`Stopped recording audio. Total chunks: ${audioChunkCount}`);
  }
};

const saveAudioChunk = (audioData: string): void => {
  if (audioFileStream && audioData) {
    try {
      // Convert base64 to buffer and write directly (no conversion needed)
      const audioBuffer = Buffer.from(audioData, "base64");
      audioFileStream.write(audioBuffer);
      audioChunkCount++;

      // Log progress every 100 chunks
      if (audioChunkCount % 100 === 0) {
        logger.info(`Saved ${audioChunkCount} audio chunks`);
      }
    } catch (error) {
      logger.error("Error saving audio chunk:", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
};

const initStreaming = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const args: string[] = ["--stream"];

    const recorderPath: string = getRecorderPath();
    logger.info("Recording process path:", { recorderPath });
    recordingProcess = spawn(recorderPath, args);
    logger.info("Recording process started");
    let buffer = "";
    recordingProcess.stdout?.on("data", (data: Buffer) => {
      // logger.debug("Recording process data:", { dataPreview: data.toString().slice(0, 100) });
      buffer += data.toString();

      // Process complete JSON messages (separated by newlines)
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);

        if (line.length === 0) continue;

        try {
          const response: RecordingResponse = JSON.parse(line);

          if (response.code === "STREAMING_STARTED") {
            logger.info(
              "Recording process started - STREAMING_STARTED received"
            );
            const timestamp: number = new Date(response.timestamp).getTime();
            global.mainWindow.webContents.send(
              "streaming-status",
              "START_STREAMING",
              timestamp
            );

            // Start audio recording
            startAudioRecording();

            // Start Deepgram transcription when streaming starts
            logger.info("About to call startTranscription()");
            startTranscription();
            logger.info("startTranscription() called successfully");

            resolve(true);
          } else if (response.code === "STREAMING_STOPPED") {
            logger.info("Recording process stopped");
            const timestamp: number = new Date(response.timestamp).getTime();
            global.mainWindow.webContents.send(
              "streaming-status",
              "STOP_STREAMING",
              timestamp
            );

            // Stop audio recording
            stopAudioRecording();

            // Stop Deepgram transcription when streaming stops
            stopTranscription();
          } else if (response.code === "AUDIO_CHUNK") {
            // Send audio chunk to renderer process
            const timestamp: number = new Date(response.timestamp).getTime();

            global.mainWindow.webContents.send(
              "streaming-status",
              "START_STREAMING",
              timestamp
            );
            // logger.debug("Sending audio chunk to renderer process");
            global.mainWindow.webContents.send("audio-chunk", {
              data: response.data,
              timestamp: response.timestamp,
              sampleRate: response.sampleRate,
              channels: response.channels,
              frameLength: response.frameLength,
            });

            // Save audio chunk to file
            if (response.data) {
              saveAudioChunk(response.data);
            }

            // Send audio data to Deepgram for transcription
            if (response.data) {
              sendAudioToDeepgram(response.data);
            }
          } else if (
            response.code !== "STREAMING_STARTED" &&
            response.code !== "STREAMING_STOPPED" &&
            response.code !== "AUDIO_CHUNK"
          ) {
            logger.info("Recording process ended");
            resolve(false);
          }
        } catch (error) {
          logger.error("Failed to parse JSON line:", {
            error: error instanceof Error ? error.message : String(error),
            lineLength: line.length,
            linePreview: line.substring(0, 100) + "...",
          });
        }
      }
    });
  });
};

export const startStreaming = async (): Promise<void> => {
  const isPermissionGranted: boolean = await checkPermissions();

  if (!isPermissionGranted) {
    global.mainWindow.loadFile(
      path.join(__dirname, "../dist/src/react/permission-denied/index.html")
    );

    return;
  }

  while (true) {
    const streamingStarted: boolean = await initStreaming();

    if (streamingStarted) {
      break;
    }
  }
};

export const stopStreaming = (): void => {
  if (recordingProcess !== null) {
    recordingProcess.kill("SIGINT");
    recordingProcess = null;
  }

  // Stop audio recording
  stopAudioRecording();

  // Make sure to stop transcription when streaming stops
  stopTranscription();
};

// Keep legacy function names for backward compatibility
export const startRecording = startStreaming;
export const stopRecording = stopStreaming;
