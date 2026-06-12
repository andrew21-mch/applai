import { logger } from '../utils/logger';
import { parseJsonFromText } from '../utils/jsonParse';

const DEFAULT_BASE_URL = 'http://localhost:11434';
const FALLBACK_MODEL = 'minimax-m2.5:cloud';

interface OllamaChatResponse {
  message?: { content?: string };
  error?: string;
}

interface OllamaTagsResponse {
  models?: { name: string }[];
}

let resolvedModel: string | null = null;

function getConfig() {
  return {
    baseUrl: (process.env.OLLAMA_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, ''),
  };
}

export async function listOllamaModels(): Promise<string[]> {
  const { baseUrl } = getConfig();
  try {
    const response = await fetch(`${baseUrl}/api/tags`);
    if (!response.ok) return [];

    const data = (await response.json()) as OllamaTagsResponse;
    return (data.models ?? []).map((m) => m.name);
  } catch {
    return [];
  }
}

export async function resolveOllamaModel(): Promise<string> {
  if (resolvedModel) return resolvedModel;

  const configured = process.env.OLLAMA_MODEL?.trim();
  if (configured) {
    resolvedModel = configured;
    return configured;
  }

  const available = await listOllamaModels();
  if (available.length > 0) {
    resolvedModel = available[0];
    logger.info('Auto-selected Ollama model', { model: resolvedModel, available });
    return resolvedModel;
  }

  resolvedModel = FALLBACK_MODEL;
  return resolvedModel;
}

export function resetOllamaModelCache(): void {
  resolvedModel = null;
}

async function getModel(): Promise<string> {
  return resolveOllamaModel();
}

export async function complete(prompt: string, maxTokens = 1024): Promise<string> {
  const { baseUrl } = getConfig();
  const model = await getModel();

  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        options: { num_predict: maxTokens },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      if (response.status === 404 && body.includes('not found')) {
        resetOllamaModelCache();
        throw new Error(
          `Ollama model '${model}' not found. Run 'ollama list' and set OLLAMA_MODEL in .env to an installed model.`,
        );
      }
      throw new Error(`Ollama request failed (${response.status}): ${body}`);
    }

    const data = (await response.json()) as OllamaChatResponse;

    if (data.error) {
      throw new Error(data.error);
    }

    const content = data.message?.content?.trim();
    if (!content) {
      throw new Error('Empty response from Ollama');
    }

    return content;
  } catch (err) {
    logger.error('Ollama API call failed', { model, baseUrl, err });
    throw err;
  }
}

export async function completeJson<T>(prompt: string, maxTokens = 512): Promise<T> {
  const { baseUrl } = getConfig();
  const model = await getModel();

  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        format: 'json',
        options: { num_predict: maxTokens },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      if (response.status === 404 && body.includes('not found')) {
        resetOllamaModelCache();
        throw new Error(
          `Ollama model '${model}' not found. Run 'ollama list' and set OLLAMA_MODEL in .env to an installed model.`,
        );
      }
      throw new Error(`Ollama JSON request failed (${response.status}): ${body}`);
    }

    const data = (await response.json()) as OllamaChatResponse;
    const text = data.message?.content?.trim() ?? '';

    if (!text) {
      throw new Error('Empty JSON response from Ollama');
    }

    return parseJsonFromText<T>(text);
  } catch (firstErr) {
    try {
      const retry = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          options: { num_predict: maxTokens, temperature: 0.1 },
        }),
      });
      const data = (await retry.json()) as OllamaChatResponse;
      return parseJsonFromText<T>(data.message?.content?.trim() ?? '');
    } catch (err) {
      logger.error('Ollama JSON call failed', { model, baseUrl, err, firstErr });
      throw err;
    }
  }
}

export async function checkOllamaHealth(): Promise<boolean> {
  const { baseUrl } = getConfig();
  try {
    const response = await fetch(`${baseUrl}/api/tags`);
    return response.ok;
  } catch {
    return false;
  }
}

export async function getOllamaStatus(): Promise<{
  connected: boolean;
  model: string | null;
  available: string[];
}> {
  const connected = await checkOllamaHealth();
  const available = connected ? await listOllamaModels() : [];
  const model = connected ? await resolveOllamaModel() : null;

  return { connected, model, available };
}
