import { DynamicModule, Global, Module } from "@nestjs/common";

import { PLUGIN_MANIFESTS_TOKEN, type PluginManifest } from "./plugin.interfaces";
import { PluginRegistryService } from "./plugin-registry.service";

@Global()
@Module({})
export class PluginRegistryModule {
  static register(manifests: PluginManifest[]): DynamicModule {
    const pluginModules = manifests.map((m) => m.module);

    return {
      module: PluginRegistryModule,
      imports: pluginModules,
      providers: [
        { provide: PLUGIN_MANIFESTS_TOKEN, useValue: manifests },
        PluginRegistryService,
      ],
      exports: [PluginRegistryService],
    };
  }
}
