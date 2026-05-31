import { DynamicModule, Global, Module, OnModuleInit } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";

import type { PluginManifest } from "./plugin.interfaces";
import { PluginRegistryService } from "./plugin-registry.service";

@Global()
@Module({})
export class PluginRegistryModule implements OnModuleInit {
  private static manifests: PluginManifest[] = [];

  static register(manifests: PluginManifest[]): DynamicModule {
    PluginRegistryModule.manifests = manifests;

    // Collect all plugin module classes for import
    const pluginModules = manifests.map((m) => m.module);

    return {
      module: PluginRegistryModule,
      imports: pluginModules,
      providers: [PluginRegistryService],
      exports: [PluginRegistryService],
    };
  }

  constructor(
    private readonly registry: PluginRegistryService,
    private readonly moduleRef: ModuleRef,
  ) {}

  onModuleInit(): void {
    this.registry.register(PluginRegistryModule.manifests);
    this.registry.validate(this.moduleRef);
  }
}
