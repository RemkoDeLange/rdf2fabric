# Decision Reference Guide

> **RDF2Fabric v0.2.1**

This guide explains all 12 translation decisions (B-decisions) that control how RDF data maps to Fabric Graph.

---

## Overview

When translating RDF to Fabric Graph, several modeling decisions must be made because the two paradigms don't map 1:1. These decisions are grouped into categories:

| Category | Decisions | Description |
|----------|-----------|-------------|
| **Structure** | B1, B6, B8, B12 | How to derive node types and edge types |
| **Identity** | B2, B11 | How to handle identifiers |
| **Multiplicity** | B3, B4 | Multi-type resources, named graphs |
| **Data Types** | B5, B7 | Language tags, datatype coercion |
| **Relationships** | B9, B10 | Edge vs property, inverse properties |

---

## B1: Node Type Strategy

**Question:** How do we derive node types (labels) from RDF classes?

### Options

| Option | Description | When to Use |
|--------|-------------|-------------|
| **Use RDF Class** *(default)* | Each `rdfs:Class` or `owl:Class` becomes a node type | When your RDF has a well-defined schema |
| **Infer from Predicates** | Group nodes by their common predicates | For instance-only data without schema |
| **Single Type** | All resources become one generic node type | When you don't need type distinction |
| **URI Pattern** | Extract type from URI structure (e.g., `/Person/123`) | When URIs encode type information |

### Auto-Resolution

This decision is **auto-resolved** at schema levels 2+ (RDFS, OWL, SHACL) using "Use RDF Class".

### Example

```turtle
# RDF Input
:Bridge123 a nen:Bridge .
:Road456 a nen:Road .

# With "Use RDF Class" (B1=class):
Node(id="Bridge123", type="Bridge")
Node(id="Road456", type="Road")

# With "Single Type" (B1=single):
Node(id="Bridge123", type="Resource")
Node(id="Road456", type="Resource")
```

---

## B2: Blank Node Handling

**Question:** How do we handle RDF blank nodes (anonymous resources)?

### The Problem

RDF blank nodes have no persistent identifier. They're like "something exists" without naming it. Fabric Graph requires all nodes to have IDs.

### Options

| Option | Description | When to Use |
|--------|-------------|-------------|
| **Generate IDs** *(default)* | Create stable UUIDs for blank nodes | Most common; preserves structure |
| **Inline as Properties** | Collapse simple blank nodes into properties | When blank nodes are just value holders |
| **Skolemize** | Replace with well-known URIs | For interoperability with other systems |
| **Skip** | Exclude blank node structures | When blank nodes aren't needed |

### Example

```turtle
# RDF Input with blank node
:Bridge123 nen:hasComponent [
    a nen:Deck ;
    nen:length "50m"
] .

# With "Generate IDs" (B2=generate):
Node(id="Bridge123", type="Bridge")
Node(id="_b0_deck", type="Deck", length="50m")
Edge(source="Bridge123", target="_b0_deck", type="hasComponent")

# With "Inline as Properties" (B2=inline):
Node(id="Bridge123", type="Bridge", component_deck_length="50m")
```

---

## B3: Multi-Type Resources

**Question:** How do we handle resources with multiple `rdf:type` values?

### The Problem

RDF allows resources to have multiple types (e.g., something can be both a `Person` and an `Employee`). Fabric nodes have a single primary type.

### Options

| Option | Description | When to Use |
|--------|-------------|-------------|
| **Most Specific** *(default)* | Use the most specific class in hierarchy | With OWL/RDFS class hierarchies |
| **First Declared** | Use the first type encountered | When order matters |
| **Duplicate Nodes** | Create a node for each type | When you need all type perspectives |
| **Merge Types** | Combine names (e.g., "Person_Employee") | Simple but can get verbose |

### When This Matters

If your data has statements like:

```turtle
:JohnDoe a :Person, :Employee, :Manager .
```

### Example

```turtle
# RDF Input
:JohnDoe a :Person, :Employee, :Manager .

# With "Most Specific" (B3=primary), assuming Manager < Employee < Person:
Node(id="JohnDoe", type="Manager")

# With "Merge Types" (B3=merge):
Node(id="JohnDoe", type="Person_Employee_Manager")
```

---

## B4: Named Graph Strategy

**Question:** How do we preserve RDF named graph context?

### The Problem

RDF datasets can contain multiple named graphs (e.g., data from different sources, different versions). Fabric Graph doesn't have native named graph support.

### Options

| Option | Description | When to Use |
|--------|-------------|-------------|
| **Graph Property** *(default)* | Add `_graph` property to nodes/edges | Preserves provenance without complexity |
| **Separate Graphs** | Create separate Fabric graphs per named graph | When graphs must be isolated *(not implemented)* |
| **Ignore** | Merge all graphs, discard context | When provenance doesn't matter |

### Example

```turtle
# TriG Input with named graphs
GRAPH <http://source1.example.org/> {
    :Bridge123 a nen:Bridge .
}
GRAPH <http://source2.example.org/> {
    :Bridge123 nen:status "active" .
}

# With "Graph Property" (B4=property):
Node(id="Bridge123", type="Bridge", _graph="http://source1.example.org/")
# Properties merged with graph tracking
```

---

## B5: Language Tag Handling

**Question:** How do we handle multilingual literals?

### The Problem

RDF literals can have language tags (e.g., `"Brug"@nl`, `"Bridge"@en`). Fabric properties are single-valued strings.

### Options

| Option | Description | When to Use |
|--------|-------------|-------------|
| **Property Suffix** *(default)* | Create `label_en`, `label_nl` properties | When you need all languages queryable |
| **Preferred Language** | Keep only specified language | When one language is sufficient |
| **Array of Values** | Store all translations in array | For flexible multilingual support |
| **Nested Object** | Store as `{en: "...", nl: "..."}` | For structured access |

### Example

```turtle
# RDF Input
:Bridge123 rdfs:label "Brug"@nl, "Bridge"@en .

# With "Property Suffix" (B5=suffix):
Node(id="Bridge123", label_nl="Brug", label_en="Bridge")

# With "Preferred Language" (B5=preferred, lang=en):
Node(id="Bridge123", label="Bridge")
```

---

## B6: Edge Type Derivation

**Question:** How do we derive edge types from RDF object properties?

### Options

| Option | Description | When to Use |
|--------|-------------|-------------|
| **Use Property Name** *(default)* | Each object property becomes an edge type | Standard approach with schema |
| **Domain-Range** | Include source/target types in edge name | For more specific edge types |
| **Generic Relations** | Use generic "relates_to" edge type | When edge semantics don't matter |

### Auto-Resolution

This decision is **auto-resolved** at schema levels 2+ using "Use Property Name".

### Example

```turtle
# RDF Input
:Bridge123 nen:hasPart :Deck456 .

# With "Use Property Name" (B6=property):
Edge(source="Bridge123", target="Deck456", type="hasPart")

# With "Domain-Range" (B6=domain-range):
Edge(source="Bridge123", target="Deck456", type="Bridge_hasPart_Deck")
```

---

## B7: Datatype Coercion

**Question:** How do we map RDF datatypes to Fabric types?

### The Problem

RDF has rich datatypes (`xsd:integer`, `xsd:dateTime`, `xsd:decimal`, custom types, etc.). Fabric Ontology supports: String, BigInt, Double, Boolean, DateTime.

### Options

| Option | Description | When to Use |
|--------|-------------|-------------|
| **Strict Mapping** *(default)* | Map to closest Fabric type, validate values | For data integrity |
| **All Strings** | Store all values as strings | When type flexibility matters |
| **Infer from Values** | Detect type from actual data values | For schema-less data |

### Type Mapping Table

| RDF Type | Fabric Type |
|----------|-------------|
| `xsd:string` | String |
| `xsd:integer`, `xsd:int`, `xsd:long` | BigInt |
| `xsd:decimal`, `xsd:float`, `xsd:double` | Double |
| `xsd:boolean` | Boolean |
| `xsd:dateTime`, `xsd:date` | DateTime |
| *(other)* | String (fallback) |

---

## B8: Property Attachment

**Question:** Which properties attach to nodes vs edges?

### The Problem

RDF allows properties on any resource. Fabric distinguishes node properties from edge properties. Most datatype properties naturally attach to nodes.

### Options

| Option | Description | When to Use |
|--------|-------------|-------------|
| **Subject Node** *(default)* | Datatype properties go on the subject node | Standard approach |
| **Support Reification** | If property references statement, attach to edge | For statement-level metadata *(not implemented)* |
| **Duplicate** | Copy properties to both node and related edges | For query convenience *(not implemented)* |

### Note

This decision is **low priority** because RDF reification patterns are rare in typical data.

---

## B9: Edge vs Property

**Question:** When should object properties become edges vs nested properties?

### The Problem

Some object properties point to simple lookup values (like enumeration members) that could be stored as properties rather than creating separate nodes.

### Options

| Option | Description | When to Use |
|--------|-------------|-------------|
| **All as Edges** *(default)* | Every object property creates an edge | Standard, preserves full graph structure |
| **Enums as Properties** | Small enumerations become string properties | For simplification *(not implemented)* |
| **Instance Threshold** | Types with few instances become properties | Automatic simplification *(not implemented)* |

### Auto-Resolution

This decision is **auto-resolved** at schema levels 3+ (OWL, SHACL).

---

## B10: Inverse Properties

**Question:** How do we handle `owl:inverseOf` relationships?

### The Problem

OWL can declare inverse properties (e.g., `parent`/`child`, `hasPart`/`isPartOf`). Should we materialize both directions as edges?

### Options

| Option | Description | When to Use |
|--------|-------------|-------------|
| **Materialize Both** *(default)* | Create edges in both directions | For complete queryability |
| **Single Direction** | Keep only one property, rely on queries | For storage efficiency |
| **Skip Inverse** | Ignore inverse declarations | When inverses aren't needed |

### Auto-Resolution

This decision is **auto-resolved** at schema levels 3+ (OWL).

### Example

```turtle
# OWL schema declares inverse
:hasPart owl:inverseOf :isPartOf .

# RDF data
:Bridge123 :hasPart :Deck456 .

# With "Materialize Both" (B10=materialize):
Edge(source="Bridge123", target="Deck456", type="hasPart")
Edge(source="Deck456", target="Bridge123", type="isPartOf")
```

---

## B11: URI → ID Generation

**Question:** How do we generate Fabric node IDs from RDF URIs?

### The Problem

RDF uses full URIs as identifiers (e.g., `https://example.org/resource/Bridge123`). Fabric prefers shorter string IDs.

### Options

| Option | Description | When to Use |
|--------|-------------|-------------|
| **Local Name** *(default)* | Use the fragment or last segment of URI | Most readable, may have collisions |
| **Use rdfs:label** | Use label if available, fallback to local name | For human-readable IDs |
| **Hash URI** | Generate short hash from full URI | Guarantees uniqueness |
| **Full URI** | Store complete URI as ID | Preserves full identity |

### Example

```turtle
# RDF Input
<https://example.org/infrastructure/Bridge123> rdfs:label "IJssel Bridge" .

# With "Local Name" (B11=local-name):
Node(id="Bridge123", ...)

# With "Use rdfs:label" (B11=label):
Node(id="IJssel Bridge", ...)

# With "Hash URI" (B11=hash):
Node(id="a7f3c2d1", ...)
```

---

## B12: Hierarchy Strategy

**Question:** How do we handle class/property hierarchies?

### The Problem

RDF schemas define hierarchies (`rdfs:subClassOf`, `rdfs:subPropertyOf`). Fabric Ontology supports single-level types.

### Options

| Option | Description | When to Use |
|--------|-------------|-------------|
| **Flatten** *(default)* | Ignore hierarchy, use leaf classes only | Simplest approach |
| **Preserve** | Create hierarchy edges between types | When hierarchy queries matter |
| **Inherit Properties** | Copy parent properties to children | For complete child definitions |

### Auto-Resolution

This decision is **auto-resolved** at schema levels 1+ (SKOS, RDFS, OWL, SHACL).

### Example

```turtle
# RDFS hierarchy
:Road rdfs:subClassOf :Infrastructure .
:Highway rdfs:subClassOf :Road .

# With "Flatten" (B12=flatten):
# Only Highway used as type, Road/Infrastructure ignored

# With "Preserve" (B12=preserve):
# Hierarchy edges: Highway → Road → Infrastructure
```

---

## Decision Quick Reference

| ID | Name | Default | Auto at Level |
|----|------|---------|---------------|
| B1 | Node Type Strategy | `class` | 2+ |
| B2 | Blank Node Handling | `generate` | - |
| B3 | Multi-Type Resources | `primary` | - |
| B4 | Named Graph Strategy | `property` | - |
| B5 | Language Tag Handling | `suffix` | - |
| B6 | Edge Type Derivation | `property` | 2+ |
| B7 | Datatype Coercion | `strict` | 4 |
| B8 | Property Attachment | `subject` | 2+ |
| B9 | Edge vs Property | `all-edges` | 3+ |
| B10 | Inverse Properties | `materialize` | 3+ |
| B11 | URI → ID Generation | `local-name` | - |
| B12 | Hierarchy Strategy | `flatten` | 1+ |

---

## See Also

- [User Guide](README.md) — Installation and quick start
- [Troubleshooting](troubleshooting.md) — Common issues
- [Architecture](../architecture.md) — System design
