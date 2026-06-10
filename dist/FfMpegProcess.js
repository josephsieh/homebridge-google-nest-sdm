"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FfmpegProcess = void 0;
const child_process_1 = require("child_process");
const stream_1 = require("stream");
class FfmpegProcess {
    process;
    constructor(cameraName, sessionId, ffmpegArgs, stdin, log, debug, delegate, callback) {
        let pathToFfmpeg = require('ffmpeg-for-homebridge');
        if (!pathToFfmpeg)
            pathToFfmpeg = 'ffmpeg';
        log.debug(`Stream command: ${pathToFfmpeg} ${ffmpegArgs} ${stdin}`, cameraName);
        let started = false;
        this.process = (0, child_process_1.spawn)(pathToFfmpeg, ffmpegArgs.split(/\s+/), { env: process.env, stdio: 'pipe' });
        if (!this.process.stdin && stdin) {
            log.error('FFmpegProcess failed to start stream: input to ffmpeg was provided as stdin, but the process does not support stdin.', cameraName);
            delegate.stopStream(sessionId);
        }
        if (this.process.stdin) {
            this.process.stdin.on('error', (error) => {
                if (!error.message.includes('EPIPE')) {
                    log.error(error.message, cameraName);
                }
            });
            if (stdin) {
                const sdpStream = this.convertStringToStream(stdin);
                sdpStream.resume();
                sdpStream.pipe(this.process.stdin);
            }
        }
        const stderrLines = [];
        if (this.process.stderr) {
            this.process.stderr.on('data', (data) => {
                if (!started) {
                    started = true;
                    if (callback) {
                        callback();
                    }
                }
                const lines = data.toString().split(/\r?\n/);
                for (const line of lines) {
                    if (line.trim()) {
                        stderrLines.push(line);
                        log.debug(line, cameraName);
                    }
                }
                if (stderrLines.length > 50) {
                    stderrLines.splice(0, stderrLines.length - 50);
                }
            });
        }
        this.process.on('error', (error) => {
            log.error('Failed to start stream: ' + error.message, cameraName);
            if (callback) {
                callback(new Error('FFmpeg process creation failed'));
            }
            delegate.stopStream(sessionId);
        });
        this.process.on('exit', (code, signal) => {
            const message = 'FFmpeg exited with code: ' + code + ' and signal: ' + signal;
            if (code == null || code === 255) {
                if (this.process.killed) {
                    log.debug(message + ' (Expected)', cameraName);
                }
                else {
                    log.error(message + ' (Unexpected)', cameraName);
                }
            }
            else {
                log.error(message + ' (Error)', cameraName);
                log.error(`Stream command: ${pathToFfmpeg} ${ffmpegArgs}`, cameraName);
                if (stdin) {
                    log.error('Stream stdin:', cameraName);
                    stdin.split(/\r?\n/).forEach((line) => {
                        log.error('  ' + line, cameraName);
                    });
                }
                if (stderrLines.length > 0) {
                    log.error('FFmpeg stderr:', cameraName);
                    stderrLines.forEach((line) => {
                        log.error('  ' + line, cameraName);
                    });
                }
                delegate.stopStream(sessionId);
                if (!started && callback) {
                    callback(new Error(message));
                }
                else {
                    delegate.getController().forceStopStreamingSession(sessionId);
                }
            }
        });
    }
    stop() {
        this.process.kill('SIGTERM');
        const killTimeout = setTimeout(() => {
            if (this.process.exitCode === null && !this.process.killed) {
                this.process.kill('SIGKILL');
            }
        }, 500);
        this.process.once('exit', () => {
            clearTimeout(killTimeout);
        });
    }
    getStdin() {
        return this.process.stdin;
    }
    convertStringToStream(stringToConvert) {
        const stream = new stream_1.Readable();
        stream._read = () => { };
        stream.push(stringToConvert);
        stream.push(null);
        return stream;
    }
}
exports.FfmpegProcess = FfmpegProcess;
//# sourceMappingURL=FfMpegProcess.js.map