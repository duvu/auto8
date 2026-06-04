import { DynamicModule, Global, Module, OnModuleInit } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";

import { PLUGIN_MANIFESTS_TOKEN, type PluginManifest } from "./plugin.interfaces";
import { PluginRegistryService } from "./plugin-registry.service";

@Global()
@Module({})
export class PluginRegistryModule implements OnModuleInit {
  constructor(
    private readonly registry: PluginRegistryService,
    private readonly moduleRef: ModuleRef,
  ) {}

  onModuleInit(): void {
    this.registry.setModuleRef(this.moduleRef);
    this.registry.validate();
  }

  static register(manifests: PluginManifest[]): DynamicModule {
    return {
      module: PluginRegistryModule,
      providers: [
        { provide: PLUGIN_MANIFESTS_TOKEN, useValue: manifests },
        PluginRegistryService,
      ],
      exports: [PluginRegistryService],
    };
  }
}
