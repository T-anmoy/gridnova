// A small OpenAPI 3.1 reader + JSON-Schema checker for the contract drift guard.
// It understands the subset FastAPI/pydantic emits: $ref, type, enum, anyOf/oneOf/allOf,
// properties/required, items, string length, numeric bounds. Anything it does not
// understand is ignored (never a false failure).
import { readFileSync } from 'node:fs'
import path from 'node:path'

type Schema = Record<string, unknown>
export interface OpenApi {
  paths: Record<string, Record<string, { requestBody?: { content?: Record<string, { schema?: Schema }> }; responses?: Record<string, { content?: Record<string, { schema?: Schema }> }> }>>
  components: { schemas: Record<string, Schema> }
}

export const SNAPSHOT_PATH = path.resolve(__dirname, '../../contract/openapi.json')
let cached: OpenApi | undefined
export function loadOpenApi(): OpenApi {
  cached ??= JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as OpenApi
  return cached
}

function deref(spec: OpenApi, schema: Schema): Schema {
  const ref = schema.$ref
  if (typeof ref !== 'string') return schema
  const name = ref.replace('#/components/schemas/', '')
  const target = spec.components.schemas[name]
  if (!target) throw new Error(`Unresolved $ref ${ref}`)
  return deref(spec, target)
}

export function requestSchema(spec: OpenApi, route: string, method: string): Schema | undefined {
  return spec.paths[route]?.[method]?.requestBody?.content?.['application/json']?.schema
}

/** The first 2xx JSON response schema; `undefined` when absent or empty (`{}`). */
export function responseSchema(spec: OpenApi, route: string, method: string): Schema | undefined {
  const responses = spec.paths[route]?.[method]?.responses ?? {}
  const ok = Object.keys(responses).find((c) => c.startsWith('2'))
  const schema = ok ? responses[ok]?.content?.['application/json']?.schema : undefined
  return schema && Object.keys(schema).length ? schema : undefined
}

/** Returns a list of problems; empty means the value satisfies the schema. */
export function validate(spec: OpenApi, schemaIn: Schema, value: unknown, at = '$'): string[] {
  const schema = deref(spec, schemaIn)
  if (Array.isArray(schema.allOf)) return (schema.allOf as Schema[]).flatMap((s) => validate(spec, s, value, at))
  for (const key of ['anyOf', 'oneOf'] as const) {
    const options = schema[key]
    if (Array.isArray(options)) {
      const attempts = (options as Schema[]).map((s) => validate(spec, s, value, at))
      return attempts.some((a) => a.length === 0) ? [] : [`${at}: matches none of ${options.length} alternatives (${attempts.map((a) => a[0]).join(' | ')})`]
    }
  }
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) return [`${at}: ${JSON.stringify(value)} is not one of ${JSON.stringify(schema.enum)}`]

  const type = schema.type
  const problems: string[] = []
  const isNum = typeof value === 'number' && Number.isFinite(value)
  switch (type) {
    case 'null':
      return value === null ? [] : [`${at}: expected null`]
    case 'string':
      if (typeof value !== 'string') return [`${at}: expected string, got ${JSON.stringify(value)}`]
      if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) problems.push(`${at}: longer than ${schema.maxLength}`)
      if (typeof schema.minLength === 'number' && value.length < schema.minLength) problems.push(`${at}: shorter than ${schema.minLength}`)
      return problems
    case 'integer':
      if (!isNum || !Number.isInteger(value)) return [`${at}: expected integer, got ${JSON.stringify(value)}`]
    // falls through to the numeric bounds
    case 'number':
      if (!isNum) return [`${at}: expected number, got ${JSON.stringify(value)}`]
      if (typeof schema.minimum === 'number' && (value as number) < schema.minimum) problems.push(`${at}: below minimum ${schema.minimum}`)
      if (typeof schema.maximum === 'number' && (value as number) > schema.maximum) problems.push(`${at}: above maximum ${schema.maximum}`)
      if (typeof schema.exclusiveMinimum === 'number' && (value as number) <= schema.exclusiveMinimum) problems.push(`${at}: not above ${schema.exclusiveMinimum}`)
      return problems
    case 'boolean':
      return typeof value === 'boolean' ? [] : [`${at}: expected boolean, got ${JSON.stringify(value)}`]
    case 'array': {
      if (!Array.isArray(value)) return [`${at}: expected array`]
      const items = schema.items as Schema | undefined
      return items ? value.flatMap((v, i) => validate(spec, items, v, `${at}[${i}]`)) : []
    }
    case 'object':
    default: {
      if (type !== 'object' && !schema.properties) return []
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return [`${at}: expected object`]
      const obj = value as Record<string, unknown>
      const props = (schema.properties ?? {}) as Record<string, Schema>
      for (const req of (schema.required ?? []) as string[]) if (!(req in obj) || obj[req] === undefined) problems.push(`${at}.${req}: required but missing`)
      for (const [k, v] of Object.entries(obj)) {
        if (v === undefined) continue
        if (props[k]) problems.push(...validate(spec, props[k], v, `${at}.${k}`))
        else if (schema.additionalProperties === false) problems.push(`${at}.${k}: not allowed by the contract`)
      }
      return problems
    }
  }
}
