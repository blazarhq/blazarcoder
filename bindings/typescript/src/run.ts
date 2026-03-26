import { buildBlazarcoderConfig, parseBlazarcoderConfig, serializeBlazarcoderConfig } from "./config.js";
import { buildBlazarcoderArgs } from "./cli.js";
import type { PartialBlazarcoderConfig, BlazarcoderConfig, BlazarcoderCliOptions } from "./types.js";
import fs from "node:fs";

export type BlazarcoderRunInput = {
	pipelineFile: string;
	host: string;
	port: number;
	configFile: string;
	config?: PartialBlazarcoderConfig;
	/**
	 * If true, ignore existing config file and require a full config payload.
	 * If false (default), merge provided fields into existing config (if present).
	 */
	fullOverride?: boolean;
	delayMs?: number;
	streamId?: string;
	latencyMs?: number;
	reducedPacketSize?: boolean;
	algorithm?: BlazarcoderCliOptions["algorithm"];
};

export type BlazarcoderRunArtifacts = {
	config: BlazarcoderConfig;
	ini: string;
	args: Array<string>;
};

/**
 * Build blazarcoder runtime artifacts (config object, INI text, CLI args).
 * Does NOT perform any filesystem writes—callers can persist the INI as needed.
 */
export function buildBlazarcoderRunArtifacts(
	input: BlazarcoderRunInput,
): BlazarcoderRunArtifacts {
	let baseConfig: PartialBlazarcoderConfig | undefined;

	const fullOverride = input.fullOverride ?? false;

	if (!fullOverride) {
		try {
			const existing = fs.readFileSync(input.configFile, "utf8");
			baseConfig = parseBlazarcoderConfig(existing);
		} catch {
			baseConfig = undefined;
		}
	}

	if (fullOverride && !input.config) {
		throw new Error("Full override requested but no config provided");
	}

	let mergedConfig: PartialBlazarcoderConfig;

	if (fullOverride) {
		mergedConfig = input.config!;
	} else {
		mergedConfig = {
			...baseConfig,
			...input.config,
			general: {
				...(baseConfig?.general ?? {}),
				...(input.config?.general ?? {}),
			},
			srt: {
				...(baseConfig?.srt ?? {}),
				...(input.config?.srt ?? {}),
			},
			adaptive: input.config?.adaptive ?? baseConfig?.adaptive,
			aimd: input.config?.aimd ?? baseConfig?.aimd,
		};
	}

	// Validate that balancer-specific sections are present when the balancer requires them in full override mode
	if (fullOverride) {
		if (!mergedConfig.general || !mergedConfig.srt) {
			throw new Error("Full override requires general and srt sections");
		}
		const balancer = mergedConfig.general?.balancer;
		if (balancer === "adaptive" && !mergedConfig.adaptive) {
			throw new Error("Full override requires adaptive section when balancer=adaptive");
		}
		if (balancer === "aimd" && !mergedConfig.aimd) {
			throw new Error("Full override requires aimd section when balancer=aimd");
		}
	}

	const { config, ini } = buildBlazarcoderConfig(mergedConfig);

	const args = buildBlazarcoderArgs({
		pipelineFile: input.pipelineFile,
		host: input.host,
		port: input.port,
		configFile: input.configFile,
		delayMs: input.delayMs,
		streamId: input.streamId,
		latencyMs: input.latencyMs ?? config.srt.latency,
		reducedPacketSize: input.reducedPacketSize,
		algorithm: input.algorithm ?? config.general.balancer,
	});

	return { config, ini, args };
}
