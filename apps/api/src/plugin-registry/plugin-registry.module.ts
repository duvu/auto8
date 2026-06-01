import { DynamicModule, Global, Module } from "@nestjs/common";

import { PLUGIN_MANIFESTS_TOKEN, type PluginManifest } from "./plugin.interfaces";
import { PluginRegistryService } from "./plugin-registry.service";

@Global()
@Module({})
export class PluginRegistryModule {
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
