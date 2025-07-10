import AVFoundation
import ScreenCaptureKit
import CoreAudio

class RecorderCLI: NSObject, SCStreamDelegate, SCStreamOutput {
    static var screenCaptureStream: SCStream?
    static weak var sharedInstance: RecorderCLI?
    var contentEligibleForSharing: SCShareableContent?
    let semaphoreRecordingStopped = DispatchSemaphore(value: 0)
    var streamFunctionCalled = false
    var streamFunctionTimeout: TimeInterval = 3.0 // Timeout in seconds
    
    // Microphone recording components
    private var audioEngine: AVAudioEngine?
    private var microphoneNode: AVAudioInputNode?
    
    // Audio mixing
    private let sharedAudioFormat = AVAudioFormat(standardFormatWithSampleRate: 48000, channels: 2)!
    private var microphoneBuffer: [Float] = []
    private let microphoneBufferLock = NSLock()
    private let maxMicrophoneBufferSize = 48000 // 1 second at 48kHz

    override init() {
        super.init()
        RecorderCLI.sharedInstance = self
        processCommandLineArguments()
    }

    func processCommandLineArguments() {
        let arguments = CommandLine.arguments
        guard arguments.contains("--stream") else {
            if arguments.contains("--check-permissions") {
                PermissionsRequester.requestScreenCaptureAccess { granted in
                    if granted {
                        ResponseHandler.returnResponse(["code": "PERMISSION_GRANTED"])
                    } else {
                        ResponseHandler.returnResponse(["code": "PERMISSION_DENIED"])
                    }
                }
            } else {
                ResponseHandler.returnResponse(["code": "INVALID_ARGUMENTS"])
            }

            return
        }
    }

    func executeRecordingProcess() {
        self.updateAvailableContent()
        self.setupMicrophoneRecording()
        setupInterruptSignalHandler()
        setupStreamFunctionTimeout()
        semaphoreRecordingStopped.wait()
    }

    func setupInterruptSignalHandler() {
        let interruptSignalHandler: @convention(c) (Int32) -> Void = { signal in
            if signal == SIGINT {
                // Get the shared instance to call terminateAllRecording
                if let recorder = RecorderCLI.sharedInstance {
                    recorder.terminateAllRecording()
                } else {
                    RecorderCLI.terminateRecording()
                }

                let timestamp = Date()
                let formattedTimestamp = ISO8601DateFormatter().string(from: timestamp)
                ResponseHandler.returnResponse(["code": "STREAMING_STOPPED", "timestamp": formattedTimestamp])
            }
        }

        signal(SIGINT, interruptSignalHandler)
    }

    func setupStreamFunctionTimeout() {
        DispatchQueue.global().asyncAfter(deadline: .now() + streamFunctionTimeout) { [weak self] in
            guard let self = self else { return }
            if !self.streamFunctionCalled {
                RecorderCLI.terminateRecording()
                ResponseHandler.returnResponse(["code": "STREAM_FUNCTION_NOT_CALLED"], shouldExitProcess: true)
            } else {
                let timestamp = Date()
                let formattedTimestamp = ISO8601DateFormatter().string(from: timestamp)
                ResponseHandler.returnResponse(["code": "STREAMING_STARTED", "timestamp": formattedTimestamp], shouldExitProcess: false)
            }
        }
    }

    func updateAvailableContent() {
        SCShareableContent.getExcludingDesktopWindows(true, onScreenWindowsOnly: true) { [weak self] content, error in
            guard let self = self else { return }
            if let error = error {
                ResponseHandler.returnResponse(["code": "CONTENT_FETCH_FAILED", "error": error.localizedDescription])
                return
            }
            self.contentEligibleForSharing = content
            self.setupRecordingEnvironment()
        }
    }

    func setupRecordingEnvironment() {
        guard let firstDisplay = contentEligibleForSharing?.displays.first else {
            ResponseHandler.returnResponse(["code": "NO_DISPLAY_FOUND"])
            return
        }

        let screenContentFilter = SCContentFilter(display: firstDisplay, excludingApplications: [], exceptingWindows: [])

        Task { await initiateRecording(with: screenContentFilter) }
    }


    func initiateRecording(with filter: SCContentFilter) async {
        let streamConfiguration = SCStreamConfiguration()
        configureStream(streamConfiguration)

        do {
            RecorderCLI.screenCaptureStream = SCStream(filter: filter, configuration: streamConfiguration, delegate: self)

            try RecorderCLI.screenCaptureStream?.addStreamOutput(self, type: .audio, sampleHandlerQueue: .global())
            try await RecorderCLI.screenCaptureStream?.startCapture()
        } catch {
            ResponseHandler.returnResponse(["code": "CAPTURE_FAILED", "error": error.localizedDescription])
        }
    }

    func configureStream(_ configuration: SCStreamConfiguration) {
        configuration.width = 2
        configuration.height = 2
        configuration.minimumFrameInterval = CMTime(value: 1, timescale: CMTimeScale.max)
        configuration.showsCursor = false
        configuration.capturesAudio = true
        configuration.sampleRate = 48000
        configuration.channelCount = 2
    }

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of outputType: SCStreamOutputType) {
        self.streamFunctionCalled = true
        guard let audioBuffer = sampleBuffer.asPCMBuffer, sampleBuffer.isValid else { return }

        // Mix microphone audio if available
        let mixedBuffer = mixMicrophoneAudio(with: audioBuffer)
        
        let audioData = self.audioBufferToData(mixedBuffer)
        let base64String = audioData.base64EncodedString()
        
        let timestamp = Date()
        let formattedTimestamp = ISO8601DateFormatter().string(from: timestamp)
        
        ResponseHandler.returnResponse([
            "code": "AUDIO_CHUNK",
            "data": base64String,
            "timestamp": formattedTimestamp,
            "sampleRate": mixedBuffer.format.sampleRate,
            "channels": mixedBuffer.format.channelCount,
            "frameLength": mixedBuffer.frameLength
        ], shouldExitProcess: false)
    }

    func stream(_ stream: SCStream, didStopWithError error: Error) {
        ResponseHandler.returnResponse(["code": "STREAM_ERROR"], shouldExitProcess: false)
        RecorderCLI.terminateRecording()
        semaphoreRecordingStopped.signal()
    }

    static func terminateRecording() {
        screenCaptureStream?.stopCapture()
        screenCaptureStream = nil
    }
    
    func terminateAllRecording() {
        RecorderCLI.terminateRecording()
        audioEngine?.stop()
        audioEngine = nil
    }
    
    func setupMicrophoneRecording() {
        guard checkMicrophonePermission() else {
            ResponseHandler.returnResponse(["code": "MICROPHONE_PERMISSION_DENIED"])
            return
        }
        
        audioEngine = AVAudioEngine()
        guard let audioEngine = audioEngine else { return }
        
        microphoneNode = audioEngine.inputNode
        guard let microphoneNode = microphoneNode else { return }
        
        let inputFormat = microphoneNode.outputFormat(forBus: 0)
        
        // Convert microphone input to match system audio sample rate (48kHz)
        let targetFormat = AVAudioFormat(standardFormatWithSampleRate: 48000, channels: 1)!
        let converter = AVAudioConverter(from: inputFormat, to: targetFormat)!
        
        // Use a larger buffer size for Bluetooth devices which may have higher latency
        let bufferSize: AVAudioFrameCount = 4096
        
        microphoneNode.installTap(onBus: 0, bufferSize: bufferSize, format: inputFormat) { [weak self] buffer, _ in
            guard let self = self else { return }
            
            // Convert sample rate to match system audio (48kHz)
            let convertedCapacity = AVAudioFrameCount(Double(buffer.frameLength) * 48000 / inputFormat.sampleRate)
            guard let convertedBuffer = AVAudioPCMBuffer(pcmFormat: targetFormat, frameCapacity: convertedCapacity) else { return }
            
            var error: NSError?
            let inputBlock: AVAudioConverterInputBlock = { _, outStatus in
                outStatus.pointee = .haveData
                return buffer
            }
            
            converter.convert(to: convertedBuffer, error: &error, withInputFrom: inputBlock)
            
            if error == nil {
                self.addMicrophoneAudio(convertedBuffer)
            }
        }
        
        do {
            try audioEngine.start()
        } catch {
            ResponseHandler.returnResponse(["code": "MICROPHONE_START_FAILED", "error": error.localizedDescription])
        }
    }
    
    func addMicrophoneAudio(_ buffer: AVAudioPCMBuffer) {
        microphoneBufferLock.lock()
        defer { microphoneBufferLock.unlock() }
        
        guard let channelData = buffer.floatChannelData else { return }
        let frameLength = Int(buffer.frameLength)
        let channelCount = Int(buffer.format.channelCount)
        
        // Calculate RMS to detect if we're getting actual audio
        var rms: Float = 0.0
        var sampleCount = 0
        
        // Add microphone samples to buffer (mix down to mono if needed)
        for frame in 0..<frameLength {
            var sample: Float = 0.0
            for channel in 0..<channelCount {
                let channelSample = channelData[channel][frame]
                sample += channelSample
                rms += channelSample * channelSample
                sampleCount += 1
            }
            sample /= Float(channelCount) // Average channels
            
            microphoneBuffer.append(sample)
            
            // Keep buffer size manageable
            if microphoneBuffer.count > maxMicrophoneBufferSize {
                microphoneBuffer.removeFirst()
            }
        }
        
        // Calculate RMS level
        if sampleCount > 0 {
            rms = sqrt(rms / Float(sampleCount))
            
            // Debug: Write to a file for all audio activity (including silence)
            let debugMessage = "MIC BUFFER: RMS=\(rms), Frames=\(frameLength), Channels=\(channelCount), Format=\(buffer.format.description)\n"
            if let data = debugMessage.data(using: .utf8) {
                let fileURL = URL(fileURLWithPath: "/tmp/mic_debug.log")
                if FileManager.default.fileExists(atPath: fileURL.path) {
                    try? data.append(to: fileURL)
                } else {
                    try? data.write(to: fileURL)
                }
            }
        }
    }
    
    func mixMicrophoneAudio(with systemBuffer: AVAudioPCMBuffer) -> AVAudioPCMBuffer {
        // Create a copy of the system buffer to modify
        guard let mixedBuffer = AVAudioPCMBuffer(pcmFormat: systemBuffer.format, frameCapacity: systemBuffer.frameCapacity) else {
            return systemBuffer
        }
        
        mixedBuffer.frameLength = systemBuffer.frameLength
        
        // Copy system audio first
        for channel in 0..<Int(systemBuffer.format.channelCount) {
            guard let systemData = systemBuffer.floatChannelData?[channel],
                  let mixedData = mixedBuffer.floatChannelData?[channel] else { continue }
            
            memcpy(mixedData, systemData, Int(systemBuffer.frameLength) * MemoryLayout<Float>.size)
        }
        
        // Mix in microphone audio if available
        microphoneBufferLock.lock()
        let micSamplesToUse = min(microphoneBuffer.count, Int(systemBuffer.frameLength))
        
        if micSamplesToUse > 0 {
            let systemGain: Float = 0.8
            let micGain: Float = 1.2  // Increased gain for Bluetooth mics
            
            // Debug: Log mixing activity
            let micRMS = sqrt(microphoneBuffer.prefix(micSamplesToUse).map { $0 * $0 }.reduce(0, +) / Float(micSamplesToUse))
            if micRMS > 0.01 {
                let debugMessage = "MIXING: micSamples=\(micSamplesToUse), micRMS=\(micRMS), bufferSize=\(microphoneBuffer.count)\n"
                if let data = debugMessage.data(using: .utf8) {
                    let fileURL = URL(fileURLWithPath: "/tmp/mixing_debug.log")
                    if FileManager.default.fileExists(atPath: fileURL.path) {
                        try? data.append(to: fileURL)
                    } else {
                        try? data.write(to: fileURL)
                    }
                }
            }
            
            for channel in 0..<Int(mixedBuffer.format.channelCount) {
                guard let mixedData = mixedBuffer.floatChannelData?[channel] else { continue }
                
                for frame in 0..<micSamplesToUse {
                    let systemSample = mixedData[frame] * systemGain
                    let micSample = microphoneBuffer[frame] * micGain
                    mixedData[frame] = systemSample + micSample
                    
                    // Simple clipping prevention
                    if mixedData[frame] > 1.0 { mixedData[frame] = 1.0 }
                    if mixedData[frame] < -1.0 { mixedData[frame] = -1.0 }
                }
            }
            
            // Remove used samples
            microphoneBuffer.removeFirst(micSamplesToUse)
        }
        
        microphoneBufferLock.unlock()
        
        return mixedBuffer
    }
    
    
    func checkMicrophonePermission() -> Bool {
        switch AVCaptureDevice.authorizationStatus(for: .audio) {
        case .authorized:
            return true
        case .notDetermined:
            // Request permission synchronously (not ideal but needed for CLI)
            let semaphore = DispatchSemaphore(value: 0)
            var granted = false
            
            AVCaptureDevice.requestAccess(for: .audio) { permission in
                granted = permission
                semaphore.signal()
            }
            
            semaphore.wait()
            return granted
        case .denied, .restricted:
            return false
        @unknown default:
            return false
        }
    }
}

extension RecorderCLI {
    func audioBufferToData(_ buffer: AVAudioPCMBuffer) -> Data {
        let channelCount = Int(buffer.format.channelCount)
        let frameLength = Int(buffer.frameLength)
        
        var data = Data()
        data.reserveCapacity(frameLength * channelCount * MemoryLayout<Int16>.size)
        
        // Convert Float32 to Int16 and interleave
        for frame in 0..<frameLength {
            for channel in 0..<channelCount {
                if let channelData = buffer.floatChannelData?[channel] {
                    let floatSample = channelData[frame]
                    // Convert float32 (-1.0 to 1.0) to int16 (-32768 to 32767)
                    let clampedSample = max(-1.0, min(1.0, floatSample))
                    let int16Sample = Int16(clampedSample * 32767.0)
                    let sampleBytes = withUnsafeBytes(of: int16Sample) { Data($0) }
                    data.append(sampleBytes)
                }
            }
        }
        
        return data
    }
}

extension Data {
    func append(to fileURL: URL) throws {
        if let fileHandle = FileHandle(forWritingAtPath: fileURL.path) {
            defer {
                fileHandle.closeFile()
            }
            fileHandle.seekToEndOfFile()
            fileHandle.write(self)
        } else {
            try write(to: fileURL)
        }
    }
}

class PermissionsRequester {
    static func requestScreenCaptureAccess(completion: @escaping (Bool) -> Void) {
        if !CGPreflightScreenCaptureAccess() {
            let result = CGRequestScreenCaptureAccess()
            completion(result)
        } else {
            completion(true)
        }
    }
}

class ResponseHandler {
    static func returnResponse(_ response: [String: Any], shouldExitProcess: Bool = true) {
        if let jsonData = try? JSONSerialization.data(withJSONObject: response),
           let jsonString = String(data: jsonData, encoding: .utf8) {
            print(jsonString)
            fflush(stdout)
        } else {
            print("{\"code\": \"JSON_SERIALIZATION_FAILED\"}")
            fflush(stdout)
        }

        if shouldExitProcess {
            exit(0)
        }
    }
}

// https://developer.apple.com/documentation/screencapturekit/capturing_screen_content_in_macos
// For Sonoma updated to https://developer.apple.com/forums/thread/727709
extension CMSampleBuffer {
    var asPCMBuffer: AVAudioPCMBuffer? {
        try? self.withAudioBufferList { audioBufferList, _ -> AVAudioPCMBuffer? in
            guard let absd = self.formatDescription?.audioStreamBasicDescription else { return nil }
            guard let format = AVAudioFormat(standardFormatWithSampleRate: absd.mSampleRate, channels: absd.mChannelsPerFrame) else { return nil }
            return AVAudioPCMBuffer(pcmFormat: format, bufferListNoCopy: audioBufferList.unsafePointer)
        }
    }
}

// Based on https://gist.github.com/aibo-cora/c57d1a4125e145e586ecb61ebecff47c
extension AVAudioPCMBuffer {
    var asSampleBuffer: CMSampleBuffer? {
        let asbd = self.format.streamDescription
        var sampleBuffer: CMSampleBuffer? = nil
        var format: CMFormatDescription? = nil

        guard CMAudioFormatDescriptionCreate(
            allocator: kCFAllocatorDefault,
            asbd: asbd,
            layoutSize: 0,
            layout: nil,
            magicCookieSize: 0,
            magicCookie: nil,
            extensions: nil,
            formatDescriptionOut: &format
        ) == noErr else { return nil }

        var timing = CMSampleTimingInfo(
            duration: CMTime(value: 1, timescale: Int32(asbd.pointee.mSampleRate)),
            presentationTimeStamp: CMClockGetTime(CMClockGetHostTimeClock()),
            decodeTimeStamp: .invalid
        )

        guard CMSampleBufferCreate(
            allocator: kCFAllocatorDefault,
            dataBuffer: nil,
            dataReady: false,
            makeDataReadyCallback: nil,
            refcon: nil,
            formatDescription: format,
            sampleCount: CMItemCount(self.frameLength),
            sampleTimingEntryCount: 1,
            sampleTimingArray: &timing,
            sampleSizeEntryCount: 0,
            sampleSizeArray: nil,
            sampleBufferOut: &sampleBuffer
        ) == noErr else { return nil }

        guard CMSampleBufferSetDataBufferFromAudioBufferList(
            sampleBuffer!,
            blockBufferAllocator: kCFAllocatorDefault,
            blockBufferMemoryAllocator: kCFAllocatorDefault,
            flags: 0,
            bufferList: self.mutableAudioBufferList
        ) == noErr else { return nil }

        return sampleBuffer
    }
}


let app = RecorderCLI()
app.executeRecordingProcess()

