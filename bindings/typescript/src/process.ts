/**
 * Process management for blazarcoder
 *
 * Provides utilities for finding, spawning, and signaling the blazarcoder process.
 */

import {
	spawn,
	execSync,
	type ChildProcess,
	type SpawnOptions,
} from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Default paths
const DEFAULT_EXEC_NAME = "blazarcoder";
const DEFAULT_SYSTEM_PATH = "/usr/bin/blazarcoder";
const DEFAULT_CONFIG_PATH = "/tmp/blazarcoder.conf";
const DEFAULT_PIPELINE_PATH = "/tmp/blazarcoder_pipeline";

/**
 * Try to find an executable in the system PATH using 'which' (Unix) or 'where' (Windows).
 * Returns the full path if found, or undefined if not found.
 */
function findInPath(binaryName: string): string | undefined {
	try {
		const isWindows = process.platform === "win32";
		const command = isWindows ? `where ${binaryName}` : `which ${binaryName}`;
		const result = execSync(command, {
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		}).trim();
		// 'where' on Windows may return multiple lines, take the first
		const firstLine = result.split("\n")[0]?.trim();
		if (firstLine && fs.existsSync(firstLine)) {
			return firstLine;
		}
	} catch {
		// Command failed or binary not found in PATH
	}
	return undefined;
}

/**
 * Options for finding the blazarcoder executable
 */
export interface BlazarcoderPathOptions {
	/**
	 * Explicit path to blazarcoder executable or directory containing it.
	 * If a directory, blazarcoder binary is expected inside.
	 */
	execPath?: string;
}

/**
 * Resolve the full path to the blazarcoder executable
 *
 * Resolution order:
 * 1. If execPath is provided and is a file, use it directly
 * 2. If execPath is a directory, look for blazarcoder inside
 * 3. Try to auto-detect from system PATH using 'which'/'where'
 * 4. Check if /usr/bin/blazarcoder exists
 * 5. Fall back to "blazarcoder" (let PATH decide at spawn time)
 */
export function getBlazarcoderExec(options: BlazarcoderPathOptions = {}): string {
	const { execPath } = options;

	// If explicit path provided
	if (execPath) {
		// Check if it's a file (direct path to executable)
		if (fs.existsSync(execPath) && fs.statSync(execPath).isFile()) {
			return execPath;
		}
		// Check if it's a directory containing blazarcoder
		const inDir = path.join(execPath, DEFAULT_EXEC_NAME);
		if (fs.existsSync(inDir) && fs.statSync(inDir).isFile()) {
			return inDir;
		}
		// Return as-is (might be in PATH or will fail at spawn time)
		return execPath.endsWith(DEFAULT_EXEC_NAME)
			? execPath
			: path.join(execPath, DEFAULT_EXEC_NAME);
	}

	// Try to auto-detect from system PATH
	const pathResult = findInPath(DEFAULT_EXEC_NAME);
	if (pathResult) {
		return pathResult;
	}

	// Check system path
	if (fs.existsSync(DEFAULT_SYSTEM_PATH)) {
		return DEFAULT_SYSTEM_PATH;
	}

	// Assume it's in PATH
	return DEFAULT_EXEC_NAME;
}

/**
 * Default paths used by blazarcoder
 */
export const BLAZARCODER_PATHS = {
	/** Default config file path */
	config: DEFAULT_CONFIG_PATH,
	/** Default pipeline file path */
	pipeline: DEFAULT_PIPELINE_PATH,
	/** Default system executable */
	systemExec: DEFAULT_SYSTEM_PATH,
} as const;

/**
 * Options for spawning blazarcoder
 */
export interface SpawnBlazarcoderOptions extends BlazarcoderPathOptions {
	/** Command line arguments */
	args: string[];
	/** Spawn options (stdio, cwd, env, etc.) */
	spawnOptions?: SpawnOptions;
}

/**
 * Spawn a blazarcoder process
 *
 * @param options - Spawn options including args and path
 * @returns ChildProcess instance
 */
export function spawnBlazarcoder(options: SpawnBlazarcoderOptions): ChildProcess {
	const exec = getBlazarcoderExec(options);
	return spawn(exec, options.args, options.spawnOptions ?? {});
}

/**
 * Options for sending signals to blazarcoder
 */
export interface SignalBlazarcoderOptions {
	/**
	 * Custom killall function.
	 * By default, uses the system killall command.
	 * This allows consumers to inject their own implementation.
	 */
	killall?: (args: string[]) => void | Promise<void>;
}

/**
 * Send SIGHUP to reload blazarcoder config
 *
 * Uses killall -HUP blazarcoder by default.
 * The config file is re-read when SIGHUP is received.
 */
export async function sendHup(options: SignalBlazarcoderOptions = {}): Promise<void> {
	const { killall } = options;

	if (killall) {
		await killall(["-HUP", DEFAULT_EXEC_NAME]);
	} else {
		// Use system killall
		return new Promise((resolve, reject) => {
			const proc = spawn("killall", ["-HUP", DEFAULT_EXEC_NAME], {
				stdio: "ignore",
			});
			proc.on("close", (code) => {
				// killall returns 1 if no process found, which is okay
				resolve();
			});
			proc.on("error", reject);
		});
	}
}

/**
 * Send SIGTERM to gracefully stop blazarcoder
 */
export async function sendTerm(options: SignalBlazarcoderOptions = {}): Promise<void> {
	const { killall } = options;

	if (killall) {
		await killall([DEFAULT_EXEC_NAME]);
	} else {
		return new Promise((resolve, reject) => {
			const proc = spawn("killall", [DEFAULT_EXEC_NAME], {
				stdio: "ignore",
			});
			proc.on("close", () => resolve());
			proc.on("error", reject);
		});
	}
}

/**
 * Check if blazarcoder is currently running
 */
export async function isRunning(): Promise<boolean> {
	return new Promise((resolve) => {
		const proc = spawn("pgrep", ["-x", DEFAULT_EXEC_NAME], {
			stdio: "ignore",
		});
		proc.on("close", (code) => {
			resolve(code === 0);
		});
		proc.on("error", () => resolve(false));
	});
}

/**
 * Write config file to disk
 */
export function writeConfig(ini: string, configPath = DEFAULT_CONFIG_PATH): void {
	fs.writeFileSync(configPath, ini);
}

/**
 * Check if config file exists
 */
export function configExists(configPath = DEFAULT_CONFIG_PATH): boolean {
	return fs.existsSync(configPath);
}

/**
 * Write pipeline file to disk
 */
export function writePipeline(
	pipeline: string,
	pipelinePath = DEFAULT_PIPELINE_PATH,
): void {
	fs.writeFileSync(pipelinePath, pipeline);
}
