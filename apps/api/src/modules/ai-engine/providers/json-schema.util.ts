import type { ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * Keys Gemini's `responseSchema` accepts. It implements a subset of OpenAPI 3
 * and rejects the whole request if it sees anything outside this list — including
 * the `additionalProperties` and `$schema` that zod-to-json-schema emits by
 * default, and the `default` that `.default()` produces.
 */
const GEMINI_ALLOWED_KEYS = new Set([
  'type',
  'format',
  'description',
  'nullable',
  'enum',
  'items',
  'properties',
  'required',
  'propertyOrdering',
]);

type JsonSchemaNode = Record<string, unknown>;

/**
 * Converts a Zod schema to a Gemini-safe response schema.
 *
 * `$refStrategy: 'none'` inlines every definition — Gemini does not resolve
 * `$ref`. `target: 'openApi3'` emits `nullable: true` rather than a `["string",
 * "null"]` type union, which Gemini also rejects.
 */
export function toGeminiSchema(schema: ZodTypeAny, name: string): JsonSchemaNode {
  // Cast: the library's generic recursion exceeds TypeScript's instantiation
  // depth on deeply nested schemas; the runtime call is unaffected.
  const raw = zodToJsonSchema(schema as never, {
    name,
    $refStrategy: 'none',
    target: 'openApi3',
  }) as JsonSchemaNode;

  // zodToJsonSchema wraps the result in { definitions: { [name]: … } } when a
  // name is supplied.
  const definitions = raw.definitions as Record<string, JsonSchemaNode> | undefined;
  const root = definitions?.[name] ?? raw;

  return sanitize(root);
}

function sanitize(node: unknown): JsonSchemaNode {
  if (Array.isArray(node)) {
    return node.map(sanitize) as unknown as JsonSchemaNode;
  }
  if (node === null || typeof node !== 'object') {
    return node as JsonSchemaNode;
  }

  const input = node as JsonSchemaNode;
  const output: JsonSchemaNode = {};

  for (const [key, value] of Object.entries(input)) {
    if (!GEMINI_ALLOWED_KEYS.has(key)) continue;

    if (key === 'properties' && value && typeof value === 'object') {
      const properties: JsonSchemaNode = {};
      for (const [property, child] of Object.entries(value as JsonSchemaNode)) {
        properties[property] = sanitize(child);
      }
      output.properties = properties;
    } else if (key === 'items') {
      output.items = sanitize(value);
    } else if (key === 'required' && Array.isArray(value)) {
      output.required = value;
    } else {
      output[key] = value;
    }
  }

  // A property that Zod made optional via `.default()` loses its default here,
  // so make sure it is not also listed as required — the model would be forced
  // to invent a value.
  if (Array.isArray(output.required) && output.properties) {
    const known = Object.keys(output.properties as JsonSchemaNode);
    output.required = (output.required as string[]).filter((key) => known.includes(key));
  }

  return output;
}

/** Plain JSON Schema for OpenAI-compatible providers, which accept the full spec. */
export function toJsonSchema(schema: ZodTypeAny, name: string): JsonSchemaNode {
  return zodToJsonSchema(schema as never, { name, $refStrategy: 'none' }) as JsonSchemaNode;
}
