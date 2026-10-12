// Renders a JSON-LD structured-data script. Server component — safe to embed
// anywhere in a page's tree.

/**
 * JSON for embedding inside a <script> element. JSON.stringify alone is not
 * safe there: a "</script>" (or "<!--") inside any string value would end the
 * script early and let the rest run as HTML. Escaping "<" removes that, and
 * U+2028 / U+2029 are escaped because they were line terminators in JavaScript
 * string literals before ES2019.
 */
export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />
}
