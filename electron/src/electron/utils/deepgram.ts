import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import dotenv from "dotenv";
import { logger } from "./logger";

dotenv.config();

interface DeepgramInstance {
  client: any;
  connection: any;
  isConnected: boolean;
  keepAliveInterval: NodeJS.Timeout | null;
}

let deepgramInstance: DeepgramInstance | null = null;

const setupDeepgram = (): DeepgramInstance => {
  logger.info("Setting up Deepgram client...");

  try {
    const client = createClient("566dc84dc3dff4092ec0d42cef9cd2aaadd277bb");
    logger.info("Deepgram client created successfully");

    logger.info("Creating live connection...");
    const connection = client.listen.live({
      smart_format: true,
      model: "nova-3",
      language: "en-US",
      encoding: "linear16",
      sample_rate: 44100,
      channels: 2,
      diarize: true,
    });
    logger.info("Live connection created successfully");

    const instance: DeepgramInstance = {
      client,
      connection,
      isConnected: false,
      keepAliveInterval: null,
    };

    // Set up keepalive
    instance.keepAliveInterval = setInterval(() => {
      logger.debug("deepgram: keepalive");
      if (instance.connection && instance.isConnected) {
        instance.connection.keepAlive();
      }
    }, 10 * 1000);

    // Connection opened
    connection.addListener(LiveTranscriptionEvents.Open, async () => {
      logger.info("deepgram: connected");
      instance.isConnected = true;
    });

    // Transcript received
    connection.addListener(LiveTranscriptionEvents.Transcript, (data: any) => {
      // Only process the transcript if it's not empty
      if (data.channel?.alternatives?.[0]?.transcript) {
        const transcript = data.channel.alternatives[0].transcript;
        const isFinal = data.is_final;
        logger.info(`Transcript (${isFinal ? "final" : "interim"}):`, {
          transcript,
        });

        // Send transcript to renderer process via IPC
        if (global.mainWindow) {
          logger.debug("Sending transcript to renderer process");
          global.mainWindow.webContents.send("transcript-data", {
            transcript,
            isFinal,
            timestamp: new Date().toISOString(),
            speaker: data.channel?.alternatives?.[0]?.words?.[0]?.speaker,
          });
        }
      }
    });

    // Connection closed
    connection.addListener(LiveTranscriptionEvents.Close, async () => {
      logger.info("deepgram: disconnected");
      instance.isConnected = false;
      if (instance.keepAliveInterval) {
        clearInterval(instance.keepAliveInterval);
        instance.keepAliveInterval = null;
      }
    });

    // Error handling
    connection.addListener(
      LiveTranscriptionEvents.Error,
      async (error: any) => {
        logger.error("deepgram: error received", { error });
        instance.isConnected = false;
      }
    );

    // Metadata handling
    connection.addListener(LiveTranscriptionEvents.Metadata, (data: any) => {
      logger.info("deepgram: metadata received");
      logger.debug("deepgram metadata:", { metadata: data });
    });

    logger.info("Deepgram listeners set up successfully");
    return instance;
  } catch (error) {
    logger.error("Error setting up Deepgram:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
};

export const startTranscription = (): void => {
  logger.info("startTranscription called");

  if (deepgramInstance && deepgramInstance.isConnected) {
    logger.info("Deepgram already connected");
    return;
  }

  try {
    logger.info("Starting Deepgram transcription...");
    deepgramInstance = setupDeepgram();
    logger.info("Deepgram instance created, connection state:", {
      isConnected: deepgramInstance.isConnected,
      connectionExists: !!deepgramInstance.connection,
    });

    // Add timeout to check connection status
    setTimeout(() => {
      if (deepgramInstance) {
        logger.info("Connection status after 5 seconds:", {
          isConnected: deepgramInstance.isConnected,
          readyState: deepgramInstance.connection?.getReadyState?.() || "N/A",
        });
      }
    }, 5000);
  } catch (error) {
    logger.error("Error starting transcription:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
};

export const stopTranscription = (): void => {
  if (deepgramInstance) {
    logger.info("Stopping Deepgram transcription...");

    if (deepgramInstance.keepAliveInterval) {
      clearInterval(deepgramInstance.keepAliveInterval);
    }

    if (deepgramInstance.connection) {
      deepgramInstance.connection.finish();
      deepgramInstance.connection.removeAllListeners();
    }

    deepgramInstance = null;
  }
};

export const sendAudioToDeepgram = (audioData: string): void => {
  if (!deepgramInstance || !deepgramInstance.isConnected) {
    logger.warn("Deepgram not connected, cannot send audio data");
    return;
  }

  try {
    // logger.debug("deepgram: sending audio data");
    // Convert base64 audio data to buffer
    const audioBuffer = Buffer.from(audioData, "base64");

    if (deepgramInstance.connection.getReadyState() === 1 /* OPEN */) {
      deepgramInstance.connection.send(audioBuffer);
      // logger.debug("Audio data sent to Deepgram");
    } else if (
      deepgramInstance.connection.getReadyState() >= 2 /* CLOSING or CLOSED */
    ) {
      logger.info("Deepgram connection closed, attempting to reconnect...");
      // Restart the connection
      stopTranscription();
      startTranscription();
    }
  } catch (error) {
    logger.error("Error sending audio to Deepgram:", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export const isTranscriptionActive = (): boolean => {
  return deepgramInstance?.isConnected ?? false;
};
