/**
 * Ontology Fetcher Service
 * 
 * Dereferences external namespace URIs to fetch ontology definitions.
 * Uses content negotiation to request RDF formats.
 */

export interface FetchResult {
  uri: string;
  success: boolean;
  content?: string;
  format?: string;
  error?: string;
  cachedPath?: string;
}

export interface FetchProgress {
  uri: string;
  status: 'pending' | 'fetching' | 'success' | 'failed';
  error?: string;
}

// RDF content types in order of preference
const RDF_ACCEPT_HEADERS = [
  'text/turtle',
  'application/rdf+xml',
  'application/n-triples',
  'application/ld+json',
  'text/n3',
  '*/*;q=0.1'
].join(', ');

// Map content types to file extensions
const CONTENT_TYPE_TO_EXT: Record<string, string> = {
  'text/turtle': '.ttl',
  'application/x-turtle': '.ttl',
  'text/n3': '.n3',
  'application/rdf+xml': '.rdf',
  'application/xml': '.rdf',
  'text/xml': '.rdf',
  'application/n-triples': '.nt',
  'application/ld+json': '.jsonld',
  'application/json': '.jsonld',
};

/**
 * Extract a safe filename from a URI
 */
function uriToFilename(uri: string): string {
  try {
    const url = new URL(uri);
    // Use domain + path hash for uniqueness
    const domain = url.hostname.replace(/\./g, '_');
    const pathPart = url.pathname
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 50);
    return `${domain}_${pathPart || 'index'}`;
  } catch {
    // Fallback for invalid URIs
    return uri.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 60);
  }
}

/**
 * Get the cache path for a namespace URI
 */
export function getCachePath(uri: string, ext: string = '.ttl'): string {
  const filename = uriToFilename(uri);
  return `cache/external_ontologies/${filename}${ext}`;
}

/**
 * Detect file extension from content type header
 */
function getExtensionFromContentType(contentType: string | null): string {
  if (!contentType) return '.ttl';
  
  // Parse content type (e.g., "text/turtle; charset=utf-8")
  const mimeType = contentType.split(';')[0].trim().toLowerCase();
  return CONTENT_TYPE_TO_EXT[mimeType] || '.ttl';
}

/**
 * Fetch an ontology from a namespace URI with content negotiation
 */
export async function fetchOntology(uri: string): Promise<FetchResult> {
  try {
    // Follow redirects and use content negotiation
    const response = await fetch(uri, {
      method: 'GET',
      headers: {
        'Accept': RDF_ACCEPT_HEADERS,
        'User-Agent': 'RDF2Fabric/1.0 (Ontology Fetcher)',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return {
        uri,
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const contentType = response.headers.get('Content-Type');
    const content = await response.text();
    const ext = getExtensionFromContentType(contentType);

    // Validate we got something that looks like RDF
    if (!content || content.length < 10) {
      return {
        uri,
        success: false,
        error: 'Empty or invalid response',
      };
    }

    // Basic validation - check for common RDF patterns
    const looksLikeRdf = 
      content.includes('@prefix') ||          // Turtle
      content.includes('PREFIX') ||           // SPARQL-style Turtle
      content.includes('xmlns:') ||           // RDF/XML
      content.includes('<rdf:RDF') ||         // RDF/XML
      content.includes('"@context"') ||       // JSON-LD
      content.includes('<http') ||            // N-Triples
      content.includes('owl:') ||             // OWL
      content.includes('rdfs:');              // RDFS

    if (!looksLikeRdf) {
      // Might be HTML - some servers return HTML even with Accept headers
      if (content.includes('<!DOCTYPE') || content.includes('<html')) {
        return {
          uri,
          success: false,
          error: 'Server returned HTML instead of RDF. Try adding .ttl or .rdf to the URI.',
        };
      }
    }

    return {
      uri,
      success: true,
      content,
      format: ext.replace('.', ''),
      cachedPath: getCachePath(uri, ext),
    };
  } catch (error) {
    // Handle CORS errors (common when fetching from browser)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        uri,
        success: false,
        error: 'CORS blocked - server does not allow browser requests. May need server-side proxy.',
      };
    }

    return {
      uri,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch multiple ontologies with progress tracking
 */
export async function fetchOntologies(
  uris: string[],
  onProgress?: (progress: FetchProgress[]) => void
): Promise<FetchResult[]> {
  const progress: FetchProgress[] = uris.map(uri => ({
    uri,
    status: 'pending',
  }));

  if (onProgress) {
    onProgress([...progress]);
  }

  const results: FetchResult[] = [];

  for (let i = 0; i < uris.length; i++) {
    const uri = uris[i];
    
    // Update status to fetching
    progress[i] = { uri, status: 'fetching' };
    if (onProgress) {
      onProgress([...progress]);
    }

    // Fetch the ontology
    const result = await fetchOntology(uri);
    results.push(result);

    // Update status based on result
    progress[i] = {
      uri,
      status: result.success ? 'success' : 'failed',
      error: result.error,
    };
    if (onProgress) {
      onProgress([...progress]);
    }
  }

  return results;
}

/**
 * Check if a URI is likely to be dereferenceable
 */
export function isDeferenceable(uri: string): boolean {
  try {
    const url = new URL(uri);
    // HTTP(S) URIs are dereferenceable
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
