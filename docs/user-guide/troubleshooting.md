# Troubleshooting Guide

> **RDF2Fabric v0.2.1**

Common issues and solutions for RDF2Fabric.

---

## Table of Contents

1. [Installation Issues](#installation-issues)
2. [Notebook Errors](#notebook-errors)
3. [Web App Issues](#web-app-issues)
4. [RDF Parsing Problems](#rdf-parsing-problems)
5. [Fabric API Errors](#fabric-api-errors)
6. [Graph Materialization Issues](#graph-materialization-issues)
7. [Performance Issues](#performance-issues)

---

## Installation Issues

### Jena JAR Build Fails

**Symptom:** Maven build fails when running `mvnw package`

**Solutions:**

1. **Check Java version:**
   ```bash
   java -version
   # Requires Java 11+
   ```

2. **Clear Maven cache:**
   ```bash
   # Windows
   rmdir /s /q %USERPROFILE%\.m2\repository
   
   # Linux/Mac
   rm -rf ~/.m2/repository
   ```

3. **Use `-DskipTests`:**
   ```bash
   ./mvnw package -DskipTests
   ```

### Fabric Environment Won't Publish

**Symptom:** Uploading JAR to Fabric Environment fails

**Solutions:**

- Ensure JAR is under 500MB (jena-shaded is ~20MB, should work)
- Check workspace capacity is active
- Try refreshing browser and re-uploading
- Wait 2-3 minutes after upload before publishing

---

## Notebook Errors

### "Jena class not found" Error

**Symptom:** `java.lang.ClassNotFoundException: org.apache.jena.*`

**Solutions:**

1. **Attach the environment:**
   - Open notebook settings
   - Under "Environment", select `env_rdf_jena`
   - Click "Save"

2. **Restart session:**
   - Stop current Spark session
   - Start new session with environment attached

3. **Verify JAR is published:**
   - Go to `env_rdf_jena` environment
   - Check "Custom libraries" shows the JAR
   - Status should be "Published" not "Pending"

### "Lakehouse not mounted" Error

**Symptom:** `FileNotFoundException` or lakehouse path issues

**Solutions:**

1. **Attach lakehouse to notebook:**
   - Open notebook
   - In the Explorer panel, click "Lakehouses"
   - Click "Add" and select your lakehouse

2. **Use correct paths:**
   ```python
   # Correct
   path = "/lakehouse/default/Files/raw/data.ttl"
   
   # Incorrect (absolute ABFS path)
   path = "abfss://workspace@onelake.dfs.fabric.microsoft.com/..."
   ```

### "Out of Memory" During Parsing

**Symptom:** Spark executor runs out of memory on large files

**Solutions:**

1. **Increase driver memory:**
   - Notebook settings → Spark configuration
   - Set `spark.driver.memory` to `8g` or higher

2. **Process in batches:**
   - Split large files into smaller chunks
   - Use `mode=append` for incremental processing

3. **Use smaller dataset for testing:**
   - Create a subset of your data
   - Test pipeline before running on full dataset

---

## Web App Issues

### Authentication Fails

**Symptom:** Sign-in loop or "unauthorized" error

**Solutions:**

1. **Check redirect URI:**
   - Azure Portal → App registrations → Your app
   - Verify `http://localhost:5173` is in redirect URIs

2. **Clear browser cache:**
   - Open DevTools → Application → Clear site data
   - Try incognito/private window

3. **Check API permissions:**
   - App must have `User.Read` and Fabric API permissions
   - Admin consent may be required

### "Failed to fetch" WorkspaceErrors

**Symptom:** Workspace list fails to load

**Solutions:**

1. **Check workspace URL format:**
   ```
   ✓ https://app.fabric.microsoft.com/groups/YOUR-WORKSPACE-ID
   ✗ https://app.fabric.microsoft.com/workspaces/...
   ```

2. **Verify permissions:**
   - You must be a workspace member (Admin, Member, or Contributor)

3. **Check network:**
   - Open browser DevTools → Network tab
   - Look for 401/403 errors on Fabric API calls

### File Browser Empty

**Symptom:** OneLake file browser shows no files

**Solutions:**

1. **Verify lakehouse has Files folder:**
   - Files are under `Files/`, not `Tables/`
   - Create test file if folder is empty

2. **Check CORS settings:**
   - OneLake DFS API may have CORS restrictions
   - Try from Fabric-hosted app (not localhost)

3. **Wait for indexing:**
   - Newly uploaded files may take a few minutes to appear

---

## RDF Parsing Problems

### "Malformed RDF" Errors

**Symptom:** Parser fails with syntax errors

**Solutions:**

1. **Validate your RDF:**
   - Use online validators like [RDF Playground](https://rdf-playground.org/)
   - Check for unclosed quotes, missing prefixes

2. **Check encoding:**
   - File must be UTF-8 encoded
   - Check for BOM (Byte Order Mark) issues

3. **Verify file extension matches format:**
   | Extension | Expected Format |
   |-----------|-----------------|
   | `.ttl` | Turtle |
   | `.rdf`, `.xml` | RDF/XML |
   | `.jsonld` | JSON-LD |

### JSON-LD Parsing Fails

**Symptom:** JSON-LD files fail to parse

**Solutions:**

1. **Check @context:**
   - JSON-LD requires valid `@context`
   - External context URLs must be accessible

2. **Validate JSON syntax:**
   - Use JSON validator first
   - Then check JSON-LD structure

3. **Try conversion:**
   - Convert to Turtle using external tool
   - Then import the Turtle file

### Named Graphs Not Detected

**Symptom:** TriG/N-Quads named graphs ignored

**Solutions:**

1. **Use correct format:**
   - TriG (`.trig`) for Turtle + named graphs
   - N-Quads (`.nq`) for N-Triples + named graphs

2. **Set B4 decision:**
   - B4 = "property" to preserve graph context
   - B4 = "ignore" will merge all graphs

---

## Fabric API Errors

### "Ontology update failed" (400 Bad Request)

**Symptom:** NB08 fails when uploading ontology definition

**Solutions:**

1. **Check entity type names:**
   - Must be 1-26 characters
   - Alphanumeric + hyphens/underscores only
   - No spaces or special characters

2. **Verify IDs are strings:**
   - All IDs in JSON must be strings, not integers
   - Check `id`, `entityIdParts`, `propertyId` fields

3. **Include all existing parts:**
   - `updateDefinition` requires ALL existing parts
   - Missing parts will be deleted

### "LRO timeout" Errors

**Symptom:** Long-running operation times out

**Solutions:**

1. **Increase timeout:**
   ```python
   # In NB08, increase polling timeout
   MAX_POLL_ATTEMPTS = 60  # 5 minutes
   POLL_INTERVAL = 5       # seconds
   ```

2. **Check operation status manually:**
   - Copy the Location header URL
   - Poll it manually in browser/Postman

3. **Retry the operation:**
   - Some LROs fail transiently
   - Wait a few minutes and retry

### "Graph refresh failed"

**Symptom:** RefreshGraph operation fails

**Solutions:**

1. **Check data bindings:**
   - All entity types must have valid bindings
   - Source tables must exist and have data

2. **Verify lakehouse settings:**
   - OneLake security must be disabled
   - Tables must be "managed" (not external)

3. **Wait and retry:**
   - Fabric IQ is in preview — occasional failures
   - Wait 5-10 minutes and try again

---

## Graph Materialization Issues

### "No entities in graph"

**Symptom:** Graph refresh succeeds but no data appears

**Solutions:**

1. **Check gold tables have data:**
   ```python
   display(spark.table("gold_nodes").limit(10))
   display(spark.table("gold_edges").limit(10))
   ```

2. **Verify column mappings:**
   - Binding column names must match table columns exactly
   - Check `uri` property is mapped correctly

3. **Check entity key property:**
   - Each entity type needs `entityIdParts` pointing to key property
   - Key property values must be unique

### "Properties not queryable in GQL"

**Symptom:** GQL queries return "property not found"

**Solutions:**

1. **Refresh the Graph Model:**
   - Schema changes require graph refresh
   - Wait for refresh to complete

2. **Check property names:**
   - Property names in ontology must match GQL query
   - Names are case-sensitive

3. **Verify property binding:**
   - Property must be bound to source column
   - Column must have non-null values

### "Edges missing in graph"

**Symptom:** Nodes appear but edges don't

**Solutions:**

1. **Check edge source/target IDs:**
   - `source_id` must match existing node IDs
   - `target_id` must match existing node IDs

2. **Verify relationship bindings:**
   - Check `Contextualizations` in ontology definition
   - Source/target key bindings must be correct

3. **Run validation:**
   ```python
   # Check for orphan edges
   edges = spark.table("gold_edges")
   nodes = spark.table("gold_nodes")
   
   orphans = edges.join(
       nodes, 
       edges.source_id == nodes.uri, 
       "left_anti"
   )
   display(orphans)
   ```

---

## Performance Issues

### Pipeline Takes Too Long

**Solutions:**

1. **Use larger compute:**
   - Workspace settings → Spark settings
   - Increase executor count and memory

2. **Optimize input:**
   - Pre-filter unnecessary triples
   - Remove duplicate statements

3. **Skip unnecessary steps:**
   - If only testing parsing, run NB01 only
   - Skip NB07-09 if testing transformation

### Web App Slow

**Solutions:**

1. **Reduce polling frequency:**
   - Default is 10 seconds
   - Increase for large datasets

2. **Use production build:**
   ```bash
   npm run build
   npm run preview
   ```

3. **Check browser DevTools:**
   - Look for slow network requests
   - Check memory usage

---

## Getting Help

If you're still stuck:

1. **Check the logs:**
   - Notebook output cells show detailed errors
   - Browser DevTools → Console for web app errors

2. **Review documentation:**
   - [Architecture](../architecture.md)
   - [Project Status](../project-status.md)

3. **Open an issue:**
   - GitHub: https://github.com/RemkoDeLange/rdf2fabric/issues
   - Include: error message, steps to reproduce, notebook output

---

## See Also

- [User Guide](README.md) — Installation and quick start
- [Decision Reference](decision-reference.md) — All 12 decisions explained
