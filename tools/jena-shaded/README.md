# Jena Shaded JAR for Fabric Spark

This Maven project builds a **shaded uber JAR** containing Apache Jena with relocated dependencies to avoid classloader conflicts in Microsoft Fabric Spark environments.

## Why This Is Needed

Microsoft Fabric Spark includes its own versions of common libraries (Jackson, Guava, etc.). When loading Apache Jena JARs separately, version conflicts cause runtime errors:

- `JsonSerialize`/`JsonDeserialize` class loading errors (Jackson conflict)
- `NoClassDefFoundError: caffeine/cache/...` (missing transitive dependency)
- Various classloader conflicts at runtime

The shaded JAR solves this by:

1. **Bundling** all Jena dependencies into a single JAR
2. **Relocating** conflicting packages (caffeine, Google libraries) to `shaded.*`
3. **Excluding** Spark-provided libraries (Jackson) to use Fabric's versions

## Prerequisites

- **Java 11** (matches Fabric Spark runtime)
  ```powershell
  winget install Microsoft.OpenJDK.11
  ```

## Build

### Windows

```powershell
cd tools/jena-shaded
.\mvnw.cmd package -DskipTests
```

### Linux/Mac

```bash
cd tools/jena-shaded
./mvnw package -DskipTests
```

### Output

```
target/jena-shaded-4.10.0.jar  (~18 MB)
```

## Fabric Environment Setup

1. Open Fabric workspace → **New** → **Environment**
2. Name: `env_rdf_jena`
3. Go to **Custom libraries** section
4. Click **Upload** → select `target/jena-shaded-4.10.0.jar`
5. Click **Publish** (takes ~1-2 minutes)
6. Attach environment to notebook:
   - Open notebook → **Environment** dropdown → select `env_rdf_jena`
7. **Stop and restart** the Spark session

## Version Information

| Component | Version | Notes |
|-----------|---------|-------|
| Apache Jena | 4.10.0 | RDF/SPARQL library |
| Java Target | 11 | Matches Fabric Spark |
| Caffeine | 3.1.8 | Relocated to `shaded.caffeine` |
| Google Guava | (bundled) | Relocated to `shaded.google` |
| Jackson | excluded | Uses Fabric's Jackson 2.15.2 |

## What's Included

The shaded JAR bundles:

- `jena-arq` - SPARQL query engine
- `jena-core` - RDF model API
- `jena-base` - Base utilities
- `jena-iri` - IRI handling
- All transitive dependencies (except Jackson)

## Troubleshooting

### "JsonSerialize class not found" error

Rebuild with Jackson excluded (already done in this pom.xml).

### "NoClassDefFoundError: caffeine"

Ensure caffeine is bundled and relocated. Check JAR contents:

```powershell
jar tf target/jena-shaded-4.10.0.jar | findstr caffeine
# Should show: shaded/caffeine/...
```

### Session not picking up JAR changes

After updating the Environment, you must:

1. Stop the current Spark session completely
2. Restart the session

Just re-running cells is not enough.

## License

Apache Jena is licensed under Apache License 2.0.
