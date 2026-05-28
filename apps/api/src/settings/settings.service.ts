import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { LlmService } from "../llm/llm.service";
import type { LlmSettingView, LlmTestResult, UpdateLlmSettingInput } from "@auto8/shared";
import type { UpdateLlmSettingDto } from "./dto/update-llm-setting.dto";

function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 8) return apiKey ? "***" : "";
  return `${apiKey.slice(0, 3)}***${apiKey.slice(-4)}`;
}

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmService: LlmService,
  ) {}

  async getLlmSetting(): Promise<LlmSettingView> {
    const row = await this.prisma.llmSetting.findUnique({ where: { id: "default" } });
    if (!row) {
      return {
        provider: "openai",
        model: "gpt-4o-mini",
        baseUrl: null,
        apiKeyMasked: "",
        isConfigured: false,
        updatedAt: new Date().toISOString(),
      };
    }
    const isConfigured = row.provider === "ollama" || row.apiKey.length > 0;
    return {
      provider: row.provider as LlmSettingView["provider"],
      model: row.model,
      baseUrl: row.baseUrl ?? null,
      apiKeyMasked: maskApiKey(row.apiKey),
      isConfigured,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async updateLlmSetting(dto: UpdateLlmSettingDto): Promise<LlmSettingView> {
    const input = dto as UpdateLlmSettingInput;
    // Only update apiKey if provided (don't overwrite with empty)
    const existingRow = await this.prisma.llmSetting.findUnique({ where: { id: "default" } });
    const apiKey = input.apiKey !== undefined ? input.apiKey : (existingRow?.apiKey ?? "");

    const row = await this.prisma.llmSetting.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        provider: input.provider,
        apiKey,
        model: input.model,
        baseUrl: input.baseUrl ?? null,
      },
      update: {
        provider: input.provider,
        apiKey,
        model: input.model,
        baseUrl: input.baseUrl ?? null,
      },
    });

    this.llmService.invalidateCache();
    this.logger.log(`LLM setting updated: provider=${row.provider}, model=${row.model}`);

    const isConfigured = row.provider === "ollama" || row.apiKey.length > 0;
    return {
      provider: row.provider as LlmSettingView["provider"],
      model: row.model,
      baseUrl: row.baseUrl ?? null,
      apiKeyMasked: maskApiKey(row.apiKey),
      isConfigured,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async testLlmConnection(): Promise<LlmTestResult> {
    const isConfigured = await this.llmService.isConfigured();
    if (!isConfigured) {
      throw new ServiceUnavailableException("LLM provider not configured");
    }

    const start = Date.now();
    try {
      const result = await this.llmService.completeJson(
        "You are a test assistant. Return a JSON object with a single field.",
        'Return exactly: {"status": "ok"}',
      );
      const latencyMs = Date.now() - start;
      const response = result ? JSON.stringify(result) : "";
      return { ok: true, latencyMs, response };
    } catch (err) {
      const latencyMs = Date.now() - start;
      const error = err instanceof Error ? err.message : String(err);
      this.logger.warn(`LLM test failed: ${error}`);
      return { ok: false, latencyMs, error };
    }
  }
}
