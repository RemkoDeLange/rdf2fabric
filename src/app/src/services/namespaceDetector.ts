/**
 * Namespace Detector Service
 * 
 * Extracts namespace prefixes from RDF files (Turtle, RDF/XML, etc.)
 * to identify external ontologies that could be dereferenced.
 */

export interface DetectedNamespace {
  prefix: string;
  uri: string;
  isExternal: boolean;      // true if URI points to external domain
  isWellKnown: boolean;     // true if known standard (RDF, RDFS, OWL, XSD, etc.)
  description?: string;     // Human-readable description for well-known namespaces
}

// Well-known standard namespaces (don't need dereferencing)
const WELL_KNOWN_NAMESPACES: Record<string, string> = {
  'http://www.w3.org/1999/02/22-rdf-syntax-ns#': 'RDF',
  'http://www.w3.org/2000/01/rdf-schema#': 'RDFS',
  'http://www.w3.org/2002/07/owl#': 'OWL',
  'http://www.w3.org/2001/XMLSchema#': 'XSD',
  'http://www.w3.org/XML/1998/namespace': 'XML',
  'http://www.w3.org/ns/shacl#': 'SHACL',
  'http://www.w3.org/2004/02/skos/core#': 'SKOS',
  'http://purl.org/dc/terms/': 'Dublin Core Terms',
  'http://purl.org/dc/elements/1.1/': 'Dublin Core Elements',
  'http://xmlns.com/foaf/0.1/': 'FOAF',
  'http://www.w3.org/ns/prov#': 'PROV-O',
  'http://www.w3.org/ns/dcat#': 'DCAT',
  'http://www.w3.org/ns/org#': 'ORG',
};

// Known external ontologies with descriptions
const KNOWN_EXTERNAL_ONTOLOGIES: Record<string, string> = {
  'http://qudt.org/schema/qudt/': 'QUDT - Quantities, Units, Dimensions',
  'http://qudt.org/vocab/unit/': 'QUDT Units vocabulary',
  'https://qudt.org/schema/qudt/': 'QUDT - Quantities, Units, Dimensions',
  'https://qudt.org/vocab/unit/': 'QUDT Units vocabulary',
  'https://schema.org/': 'Schema.org',
  'http://schema.org/': 'Schema.org',
  'https://w3id.org/nen2660/def#': 'NEN 2660-2 (BIM standard)',
  'http://www.opengis.net/ont/geosparql#': 'GeoSPARQL',
  'http://www.w3.org/2003/01/geo/wgs84_pos#': 'WGS84 Geo',
  'http://www.w3.org/ns/sosa/': 'SOSA (Sensors)',
  'http://www.w3.org/ns/ssn/': 'SSN (Semantic Sensor Network)',
  'http://www.buildingsmart-tech.org/ifcOWL/IFC4_ADD2#': 'IFC4 (Building Smart)',
  'https://w3id.org/bot#': 'BOT (Building Topology)',
  'http://www.w3.org/2006/time#': 'OWL-Time',
};

/**
 * Extract namespace prefixes from Turtle content
 * Matches: @prefix prefix: <uri> .
 * And:     PREFIX prefix: <uri>
 */
function extractTurtlePrefixes(content: string): Map<string, string> {
  const prefixes = new Map<string, string>();
  
  // Match @prefix declarations: @prefix prefix: <uri> .
  const atPrefixRegex = /@prefix\s+(\w*)\s*:\s*<([^>]+)>\s*\./gi;
  let match;
  while ((match = atPrefixRegex.exec(content)) !== null) {
    const [, prefix, uri] = match;
    prefixes.set(prefix || '', uri);
  }
  
  // Match PREFIX declarations (SPARQL-style): PREFIX prefix: <uri>
  const prefixRegex = /PREFIX\s+(\w*)\s*:\s*<([^>]+)>/gi;
  while ((match = prefixRegex.exec(content)) !== null) {
    const [, prefix, uri] = match;
    prefixes.set(prefix || '', uri);
  }
  
  return prefixes;
}

/**
 * Extract namespace prefixes from RDF/XML content
 * Matches: xmlns:prefix="uri" and xmlns="uri"
 */
function extractRdfXmlNamespaces(content: string): Map<string, string> {
  const prefixes = new Map<string, string>();
  
  // Match xmlns:prefix="uri"
  const xmlnsRegex = /xmlns:(\w+)\s*=\s*["']([^"']+)["']/gi;
  let match;
  while ((match = xmlnsRegex.exec(content)) !== null) {
    const [, prefix, uri] = match;
    prefixes.set(prefix, uri);
  }
  
  // Match default namespace xmlns="uri"
  const defaultXmlnsRegex = /xmlns\s*=\s*["']([^"']+)["']/gi;
  while ((match = defaultXmlnsRegex.exec(content)) !== null) {
    const [, uri] = match;
    prefixes.set('', uri);
  }
  
  return prefixes;
}

/**
 * Extract namespace prefixes from JSON-LD content
 * Looks for @context with prefix mappings
 */
function extractJsonLdContext(content: string): Map<string, string> {
  const prefixes = new Map<string, string>();
  
  try {
    const json = JSON.parse(content);
    const context = json['@context'];
    
    if (typeof context === 'object' && context !== null) {
      for (const [key, value] of Object.entries(context)) {
        if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
          prefixes.set(key, value);
        } else if (typeof value === 'object' && value !== null && '@id' in value) {
          const id = (value as { '@id': string })['@id'];
          if (typeof id === 'string') {
            prefixes.set(key, id);
          }
        }
      }
    }
  } catch {
    // Invalid JSON, skip
  }
  
  return prefixes;
}

/**
 * Detect RDF format from file extension
 */
function detectFormat(fileName: string): 'turtle' | 'rdfxml' | 'jsonld' | 'ntriples' | 'unknown' {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.ttl') || lower.endsWith('.nt')) return 'turtle';
  if (lower.endsWith('.rdf') || lower.endsWith('.xml') || lower.endsWith('.owl')) return 'rdfxml';
  if (lower.endsWith('.jsonld') || lower.endsWith('.json')) return 'jsonld';
  if (lower.endsWith('.nq') || lower.endsWith('.trig')) return 'turtle';
  return 'unknown';
}

/**
 * Check if a namespace URI is external (not a local file namespace)
 */
function isExternalNamespace(uri: string, fileUri?: string): boolean {
  // Standard HTTP(S) URIs are external
  if (!uri.startsWith('http://') && !uri.startsWith('https://')) {
    return false;
  }
  
  // If the file has a base URI, check if namespace is from same domain
  if (fileUri) {
    try {
      const nsUrl = new URL(uri);
      const fileUrl = new URL(fileUri);
      if (nsUrl.host === fileUrl.host) {
        return false;
      }
    } catch {
      // Invalid URL, treat as external
    }
  }
  
  return true;
}

/**
 * Classify a namespace as well-known, known external, or unknown external
 */
function classifyNamespace(prefix: string, uri: string): DetectedNamespace {
  const isWellKnown = uri in WELL_KNOWN_NAMESPACES;
  const knownDescription = WELL_KNOWN_NAMESPACES[uri] || KNOWN_EXTERNAL_ONTOLOGIES[uri];
  
  return {
    prefix,
    uri,
    isExternal: !isWellKnown && isExternalNamespace(uri),
    isWellKnown,
    description: knownDescription,
  };
}

/**
 * Extract and classify all namespaces from RDF content
 */
export function detectNamespaces(fileName: string, content: string): DetectedNamespace[] {
  const format = detectFormat(fileName);
  let prefixes: Map<string, string>;
  
  switch (format) {
    case 'turtle':
      prefixes = extractTurtlePrefixes(content);
      break;
    case 'rdfxml':
      prefixes = extractRdfXmlNamespaces(content);
      break;
    case 'jsonld':
      prefixes = extractJsonLdContext(content);
      break;
    default:
      // Try all parsers for unknown formats
      prefixes = extractTurtlePrefixes(content);
      if (prefixes.size === 0) {
        prefixes = extractRdfXmlNamespaces(content);
      }
      if (prefixes.size === 0) {
        prefixes = extractJsonLdContext(content);
      }
  }
  
  // Classify each namespace
  const namespaces: DetectedNamespace[] = [];
  for (const [prefix, uri] of prefixes) {
    namespaces.push(classifyNamespace(prefix, uri));
  }
  
  // Sort: external first, then by prefix
  namespaces.sort((a, b) => {
    if (a.isExternal !== b.isExternal) return a.isExternal ? -1 : 1;
    if (a.isWellKnown !== b.isWellKnown) return a.isWellKnown ? 1 : -1;
    return a.prefix.localeCompare(b.prefix);
  });
  
  return namespaces;
}

/**
 * Merge namespaces from multiple files, deduplicating by URI
 */
export function mergeNamespaces(allNamespaces: DetectedNamespace[][]): DetectedNamespace[] {
  const byUri = new Map<string, DetectedNamespace>();
  
  for (const fileNamespaces of allNamespaces) {
    for (const ns of fileNamespaces) {
      // Keep the first occurrence (with its prefix)
      if (!byUri.has(ns.uri)) {
        byUri.set(ns.uri, ns);
      }
    }
  }
  
  const merged = Array.from(byUri.values());
  
  // Sort: external first, then by prefix
  merged.sort((a, b) => {
    if (a.isExternal !== b.isExternal) return a.isExternal ? -1 : 1;
    if (a.isWellKnown !== b.isWellKnown) return a.isWellKnown ? 1 : -1;
    return a.prefix.localeCompare(b.prefix);
  });
  
  return merged;
}

/**
 * Get summary statistics for detected namespaces
 */
export function getNamespaceStats(namespaces: DetectedNamespace[]): {
  total: number;
  external: number;
  wellKnown: number;
  fetchable: number;
} {
  const external = namespaces.filter(ns => ns.isExternal).length;
  const wellKnown = namespaces.filter(ns => ns.isWellKnown).length;
  
  return {
    total: namespaces.length,
    external,
    wellKnown,
    fetchable: external, // External namespaces can be fetched
  };
}
