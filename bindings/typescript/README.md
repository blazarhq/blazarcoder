# @blazarbox/blazarcoder (TypeScript bindings)

Type-safe helpers for blazarcoder integration:

- Zod v4 schemas for config and CLI options
- Defaults aligned with the blazarcoder C implementation
- Config generator (`buildBlazarcoderConfig`, `serializeBlazarcoderConfig`)
- CLI args builder (`buildBlazarcoderArgs`) that always prefers `-c <config>` (legacy `-b` removed)
- Pipeline builder (`PipelineBuilder`) to generate hardware-specific GStreamer launch strings
- Process helpers (`spawnBlazarcoder`, `sendHup`, `sendTerm`, `writeConfig`, `writePipeline`)

## Pipeline Builder

```ts
import { PipelineBuilder } from "@blazarbox/blazarcoder";

const result = PipelineBuilder.build({
  hardware: "rk3588",
  source: "hdmi",
  overrides: { resolution: "1080p", framerate: 30 },
});

console.log(result.pipeline); // GStreamer launch string
```

Helpers:
- `PipelineBuilder.listHardwareTypes()` → `["jetson","rk3588","n100","generic"]`
- `PipelineBuilder.listSources(hardware)` → per-hardware sources
- `PipelineBuilder.build({ hardware, source, overrides, writeTo? })` → pipeline string and optional file path

Notes:
- Pipelines are validated to contain `appsink` and encoder elements (`venc_bps`/`venc_kbps`)
- Resolution/framerate defaults come from per-source metadata
- `writeTo` writes the pipeline string to disk (for blazarcoder `-p <file>`)

## Usage

```ts
import {
  buildBlazarcoderArgs,
  buildBlazarcoderConfig,
  serializeBlazarcoderConfig,
} from "@blazarbox/blazarcoder";

const { config, ini } = buildBlazarcoderConfig({
  general: { max_bitrate: 6000 },
  srt: { latency: 2000 },
});

// Write ini to blazarcoder.conf, then run blazarcoder
const args = buildBlazarcoderArgs({
  pipelineFile: "/usr/share/blazarcoder/pipelines/generic/h264_camlink_1080p",
  host: "127.0.0.1",
  port: 9000,
  configFile: "/tmp/blazarcoder.conf",
  latencyMs: config.srt.latency,
  algorithm: config.general.balancer,
});
```
