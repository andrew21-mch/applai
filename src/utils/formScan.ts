import type { Frame, Page } from 'playwright';

export interface ScannedFormField {
  fieldKey: string;
  tag: string;
  inputType: string;
  name: string | null;
  fieldId: string | null;
  label: string | null;
  placeholder: string | null;
  required: boolean;
  options: string[];
}

type FillContext = Page | Frame;

function contexts(page: Page): FillContext[] {
  return [page, ...page.frames().filter((f) => f !== page.mainFrame())];
}

async function scanContext(ctx: FillContext, frameIndex: number): Promise<ScannedFormField[]> {
  const fields: ScannedFormField[] = [];
  let index = 0;

  const elements = ctx.locator(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select',
  );
  const count = await elements.count().catch(() => 0);

  for (let i = 0; i < count; i++) {
    const el = elements.nth(i);
    try {
      if (!(await el.isVisible())) continue;

      const meta = await el.evaluate((node) => {
        const input = node as {
          tagName: string;
          type?: string;
          id: string;
          name: string;
          required: boolean;
          getAttribute(name: string): string | null;
          closest(selector: string): { textContent: string | null } | null;
          options?: Array<{ textContent: string | null }>;
        };
        const tag = input.tagName.toLowerCase();
        const inputType = tag === 'input' ? input.type || 'text' : tag;

        let label: string | null = null;
        const id = input.id || null;
        if (id) {
          const labelEl = (globalThis as { document?: { querySelector(s: string): { textContent: string | null } | null } }).document?.querySelector(`label[for="${id}"]`);
          label = labelEl?.textContent?.trim() ?? null;
        }
        if (!label) {
          label = input.closest('label')?.textContent?.trim() ?? null;
        }
        if (!label) {
          label = input.getAttribute('aria-label');
        }

        const options: string[] = [];
        if (tag === 'select' && input.options) {
          for (const opt of input.options) {
            const text = opt.textContent?.trim();
            if (text) options.push(text);
          }
        }

        return {
          tag,
          inputType,
          name: input.name || null,
          fieldId: id,
          label,
          placeholder: input.getAttribute('placeholder'),
          required: input.required || input.getAttribute('aria-required') === 'true',
          options,
        };
      });

      const fieldKey = `f${frameIndex}-${index++}`;
      fields.push({ fieldKey, ...meta });
    } catch {
      continue;
    }
  }

  return fields;
}

export async function scanFormFields(page: Page): Promise<ScannedFormField[]> {
  const all: ScannedFormField[] = [];
  const seen = new Set<string>();

  for (let frameIndex = 0; frameIndex < contexts(page).length; frameIndex++) {
    const ctx = contexts(page)[frameIndex];
    const batch = await scanContext(ctx, frameIndex);
    for (const field of batch) {
      const dedupeKey = `${field.name ?? ''}|${field.label ?? ''}|${field.placeholder ?? ''}|${field.inputType}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      all.push(field);
    }
  }

  return all;
}
