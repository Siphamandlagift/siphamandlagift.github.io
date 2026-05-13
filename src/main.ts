import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig, createAppConfig, type RuntimeAppConfig } from './app/app.config';
import { App } from './app/app';

async function loadRuntimeAppConfig(): Promise<RuntimeAppConfig> {
  try {
    const response = await fetch('/app-config.json', { cache: 'no-store' });
    const contentType = response.headers.get('content-type') || '';

    if (!response.ok || !contentType.includes('application/json')) {
      return {};
    }

    return await response.json() as RuntimeAppConfig;
  } catch {
    return {};
  }
}

const runtimeConfig = await loadRuntimeAppConfig();
const resolvedAppConfig = Object.keys(runtimeConfig).length ? createAppConfig(runtimeConfig) : appConfig;

bootstrapApplication(App, resolvedAppConfig)
  .catch((err) => console.error(err));
