import React, { useState, useEffect, useRef } from "react";

interface ElectronWindow extends Window {
  require: (module: string) => any;
}

declare const window: ElectronWindow;

const { ipcRenderer, shell } = window.require("electron");
const path = window.require("path");
const os = window.require("os");

interface RecordingParams {
  filepath: string;
  filename: string;
}

interface User {
  id: string;
  email: string;
  name?: string;
}

interface TranscriptData {
  transcript: string;
  isFinal: boolean;
  timestamp: string;
  speaker?: number;
}

function App(): React.JSX.Element {
  const [selectedFolderPath, setSelectedFolderPath] = useState<string>(
    path.join(os.homedir(), "Desktop")
  );
  const [recordingFilename, setRecordingFilename] = useState<string>("");
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [outputFilePath, setOutputFilePath] = useState<string>(
    "Start Recording to see the file path"
  );
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
  const [transcripts, setTranscripts] = useState<TranscriptData[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState<string>("");

  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleSelectedFolder = (_: any, path: string): void => {
      setSelectedFolderPath(path);
    };

    const handleRecordingStatus = (
      _: any,
      status: string,
      timestamp: number,
      filepath: string
    ): void => {
      if (status === "START_RECORDING") {
        startTimeRef.current = timestamp;
        setIsStarting(false);
        setIsRecording(true);
        setOutputFilePath(filepath);
        updateElapsedTime();
      }

      if (status === "STOP_RECORDING") {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        setIsRecording(false);
      }
    };

    const handleAuthSuccess = (_: any, data: { user: User }): void => {
      setUser(data.user);
      setIsLoadingAuth(false);
    };

    const handleAuthSignout = (): void => {
      setUser(null);
    };

    const handleTranscriptData = (_: any, data: TranscriptData): void => {
      console.log("Received transcript data:", data);
      if (data.isFinal) {
        // Add final transcript to the list
        setTranscripts((prev) => [...prev, data]);
        setCurrentTranscript("");
      } else {
        // Update current interim transcript
        setCurrentTranscript(data.transcript);
      }
    };

    // Check for current user on app start
    const checkCurrentUser = async (): Promise<void> => {
      try {
        const currentUser = await ipcRenderer.invoke("get-current-user");
        if (currentUser) {
          setUser({
            id: currentUser.id,
            email: currentUser.email,
            name: currentUser.user_metadata?.name || currentUser.email,
          });
        }
      } catch (error) {
        console.error("Failed to get current user:", error);
      } finally {
        setIsLoadingAuth(false);
      }
    };

    checkCurrentUser();

    ipcRenderer.on("selected-folder", handleSelectedFolder);
    ipcRenderer.on("recording-status", handleRecordingStatus);
    ipcRenderer.on("auth-success", handleAuthSuccess);
    ipcRenderer.on("auth-signout", handleAuthSignout);
    ipcRenderer.on("transcript-data", handleTranscriptData);

    return () => {
      ipcRenderer.removeListener("selected-folder", handleSelectedFolder);
      ipcRenderer.removeListener("recording-status", handleRecordingStatus);
      ipcRenderer.removeListener("auth-success", handleAuthSuccess);
      ipcRenderer.removeListener("auth-signout", handleAuthSignout);
      ipcRenderer.removeListener("transcript-data", handleTranscriptData);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const updateElapsedTime = (): void => {
    if (startTimeRef.current !== null) {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsedTime(elapsed);
      timerRef.current = setTimeout(updateElapsedTime, 1000);
    }
  };

  const handleSelectFolder = (): void => {
    ipcRenderer.send("open-folder-dialog");
  };

  const handleStartRecording = (): void => {
    setIsStarting(true);
    const params: RecordingParams = {
      filepath: selectedFolderPath,
      filename: recordingFilename,
    };
    ipcRenderer.send("start-recording", params);
  };

  const handleStopRecording = (): void => {
    ipcRenderer.send("stop-recording");
    // Clear transcripts when stopping
    setTranscripts([]);
    setCurrentTranscript("");
  };

  const handleOutputFilePathClick = (): void => {
    if (outputFilePath !== "Start Recording to see the file path") {
      const parentDir = path.dirname(outputFilePath);
      shell.openPath(parentDir);
    }
  };

  const handleSignIn = (): void => {
    ipcRenderer.send("open-web-auth");
  };

  const handleSignOut = (): void => {
    ipcRenderer.send("sign-out");
  };

  if (isLoadingAuth) {
    return (
      <div className="bg-gray-100 h-screen flex items-center justify-center">
        <div className="bg-white shadow-md rounded-md p-6 max-w-md mx-auto text-center">
          <div className="inline-block w-8 h-8 border-4 border-t-transparent border-blue-500 rounded-full animate-spin mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="bg-gray-100 h-screen flex items-center justify-center">
        <div className="bg-white shadow-md rounded-md p-6 max-w-md mx-auto text-center">
          <h1 className="text-2xl font-bold mb-4">
            Electron System Audio Recorder
          </h1>
          <p className="text-gray-600 mb-6">
            Please sign in to use the audio recorder
          </p>
          <button
            onClick={handleSignIn}
            className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 h-screen flex items-center justify-center">
      <div className="bg-white shadow-md rounded-md p-6 max-w-md mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Electron System Audio Recorder</h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              {user.name || user.email}
            </span>
            <button
              onClick={handleSignOut}
              className="text-sm text-blue-500 hover:text-blue-700"
            >
              Sign Out
            </button>
          </div>
        </div>

        <div className="mb-4">
          <label className="block font-medium mb-2">
            Recording Path:{" "}
            <span className="text-gray-500">{selectedFolderPath}</span>
          </label>
          <button
            onClick={handleSelectFolder}
            disabled={isRecording}
            className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 hover:bg-blue-100 transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Select Folder
          </button>
        </div>

        <div className="mb-4">
          <label className="block font-medium mb-2 mr-2">
            Recording Filename:
          </label>
          <div className="flex gap-4">
            <input
              type="text"
              value={recordingFilename}
              onChange={(e) => setRecordingFilename(e.target.value)}
              disabled={isRecording}
              className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <span className="ml-2 bg-gray-200 text-gray-500 rounded-md px-2">
              .flac
            </span>
          </div>
        </div>

        <div className="flex justify-between mt-8">
          <button
            onClick={handleStartRecording}
            disabled={isRecording}
            className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isStarting ? (
              <>
                Starting{" "}
                <span className="inline-block ml-4 w-4 h-4 border-4 border-t-transparent border-white rounded-full animate-spin"></span>
              </>
            ) : (
              "Start Recording"
            )}
          </button>
          <button
            onClick={handleStopRecording}
            disabled={!isRecording}
            className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Stop Recording
          </button>
        </div>

        <div className="mt-4 text-gray-500">
          Elapsed Time: <span>{elapsedTime}s</span>
        </div>

        <div className="mt-2">
          <label className="block font-medium">Output File Path:</label>
          <div
            onClick={handleOutputFilePathClick}
            className="text-gray-500 cursor-pointer hover:text-blue-500"
          >
            {outputFilePath}
          </div>
        </div>

        {/* Transcript Display */}
        {isRecording && (
          <div className="mt-4 border-t pt-4">
            <label className="block font-medium mb-2">Live Transcript:</label>
            <div className="bg-gray-50 border rounded-md p-3 max-h-40 overflow-y-auto">
              {transcripts.map((transcript, index) => (
                <div key={index} className="mb-1 text-sm">
                  <span className="text-gray-400 text-xs">
                    [{new Date(transcript.timestamp).toLocaleTimeString()}]
                  </span>
                  <span className="ml-2">{transcript.transcript}</span>
                </div>
              ))}
              {currentTranscript && (
                <div className="text-sm text-gray-600 italic">
                  <span className="text-gray-400 text-xs">[Live]</span>
                  <span className="ml-2">{currentTranscript}</span>
                </div>
              )}
              {transcripts.length === 0 && !currentTranscript && (
                <div className="text-gray-400 text-sm italic">
                  Waiting for audio transcription...
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
