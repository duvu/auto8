import {
  Injectable,
  Logger,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { PrismaService } from "../prisma/prisma.service";

interface ActiveConfig {
  provider: string;
  apiKey: string;
  model: string;
  baseUrl: string | null;
}

@Injectable()
export class LlmService implements OnModuleInit {
  private readonly logger = new Logger(LlmService.name);

  // In-memory cache
  private cachedConfig: ActiveConfig | null = null;
  private cachedAt = 0;
  private readonly CACHE_TTL_MS = 60_000;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    const existing = await this.prisma.llmSetting.findUnique({ where: { id: "default" } });
    if (!existing) {
      const apiKey = this.configService.get<string>("OPENAI_API_KEY");
      if (apiKey) {
        const model = this.configService.get<string>("OPENAI_MODEL") ?? "gpt-4o-mini";
        await this.prisma.llmSetting.create({
          data: { id: "default", provider: "openai", apiKey, model },
        });
        this.logger.log("Seeded LlmSetting from OPENAI_API_KEY env var");
      }
    }
  }

  invalidateCache(): void {
    this.cachedConfig = null;
    this.cachedAt = 0;
  }

  private async getActiveConfig(): Promise<ActiveConfig | null> {
    const now = Date.now();
    if (this.cachedConfig && now - this.cachedAt < this.CACHE_TTL_MS) {
      return this.cachedConfig;
    }

    const row = await this.prisma.llmSetting.findUnique({ where: { id: "default" } });
    if (!row) return null;

    const isUsable = row.provider === "ollama" || row.apiKey.length > 0;
    if (!isUsable) return null;

    this.cachedConfig = {
      provider: row.provider,
      apiKey: row.apiKey,
      model: row.model,
      baseUrl: row.baseUrl ?? null,
    };
    this.cachedAt = now;
    return this.cachedConfig;
  }

  async isConfigured(): Promise<boolean> {
    const config = await this.getActiveConfig();
    return config !== null;
  }

  async getModel(): Promise<string> {
    const config = await this.getActiveConfig();
    return config?.model ?? "gpt-4o-mini";
  }

  async completeJson(systemPrompt: string, userPrompt: string): Promise<unknown> {
    const config = await this.getActiveConfig();
    if (!config) {
      this.logger.log("LlmService: no active config — returning null");
      return null;
    }

    try {
      switch (config.provider) {
        case "openai":
        case "ollama":
          return await this.completeWithOpenAi(config, systemPrompt, userPrompt);
        case "anthropic":
          return await this.completeWithAnthropic(config, systemPrompt, userPrompt);
        case "google":
          return await this.completeWithGoogle(config, systemPrompt, userPrompt);
        default:
          this.logger.warn(`Unknown provider: ${config.provider}, trying OpenAI-compatible`);
          return await this.completeWithOpenAi(config, systemPrompt, userPrompt);
      }
    } catch (err) {
      this.logger.error(`LLM call failed: ${String(err)}`);
      throw err;
    }
  }

  private async completeWithOpenAi(
    config: ActiveConfig,
    systemPrompt: string,
    userPrompt: string,
  ): Promise<unknown> {
    const clientOptions: ConstructorParameters<typeof OpenAI>[0] = {
      apiKey: config.apiKey || "ollama",
    };
    if (config.baseUrl) clientOptions.baseURL = config.baseUrl;

    const client = new OpenAI(clientOptions);
    const response = await client.chat.completions.create({
      model: config.model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    const content = response.choices[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content) as unknown;
  }

  private async completeWithAnthropic(
    config: ActiveConfig,
    systemPrompt: string,
    userPrompt: string,
  ): Promise<unknown> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
    const client = new Anthropic({ apiKey: config.apiKey });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const response = await (client.messages.create as Function)({
      model: config.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }) as { content: Array<{ type: string; text: string }> };

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock) return null;
    // Extract JSON from the text response
    const match = /\{[\s\S]*\}/.exec(textBlock.text);
    if (!match) return null;
    return JSON.parse(match[0]) as unknown;
  }

  private async completeWithGoogle(
    config: ActiveConfig,
    systemPrompt: string,
    userPrompt: string,
  ): Promise<unknown> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
    const genAI = new GoogleGenerativeAI(config.apiKey);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    const model = genAI.getGenerativeModel({
      model: config.model,
      generationConfig: { responseMimeType: "application/json" },
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    const result = await model.generateContent(`${systemPrompt}\n\n${userPrompt}`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    const text: string = result.response.text();
    if (!text) return null;
    const match = /\{[\s\S]*\}/.exec(text);
    if (!match) return null;
    return JSON.parse(match[0]) as unknown;
  }
}
