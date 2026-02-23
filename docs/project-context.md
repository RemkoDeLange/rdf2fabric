# Project Context - Fabric RDF Translation

## Session Summary
**Date:** 2026-02-23  
**Project:** fabric_rdf_translation  
**Location:** `C:\Users\redelang\Code\cd-rdf-dev-01\fabric_rdf_translation`

---

## Project Background

This project is being developed to build a **complex Fabric application** for RDF translation. The user is connected to a Microsoft Fabric capacity and wants to follow best practices for local development.

---

## Decisions Made

### 1. Local-First Development Approach ✅
- **Decision:** Build the application locally with a structured folder approach
- **Rationale:** 
  - Enables version control with Git
  - Supports code review workflows (PR-based)
  - Full VS Code IDE capabilities
  - CI/CD ready for multi-environment deployments (Dev → Test → Prod)

### 2. Git Repository Initialized ✅
- **Decision:** Initialize Git early, during requirements gathering phase
- **Rationale:** Track requirements evolution, enable collaboration, nothing lost

### 3. Project Structure ✅
```
fabric_rdf_translation/
├── .git/                     # Version control
├── .gitignore                # Fabric-optimized ignore rules
├── README.md                 # Project overview
│
├── docs/                     # Documentation
│   ├── requirements.md       # Business & technical requirements
│   ├── architecture.md       # System design (diagram included)
│   ├── data-sources.md       # Source systems & RDF mappings
│   └── project-context.md    # This file
│
└── src/                      # Fabric item definitions
    ├── lakehouses/           # Lakehouse definitions
    ├── notebooks/            # Spark notebooks
    ├── pipelines/            # Data pipelines
    ├── warehouses/           # Data warehouse definitions
    └── reports/              # Power BI reports
```

---

## Current Status

🟡 **Phase: Requirements Gathering** (In Progress)

- [x] Project folder structure created
- [x] Git repository initialized
- [x] Documentation templates in place
- [x] Business problem documented
- [x] Decision framework defined (3 categories: A/B/C)
- [x] Fabric technical requirements researched
- [ ] Test data (NEN 2660-2) uploaded and analyzed
- [ ] Architecture finalized
- [ ] Fabric workspace linked

---

## Key Decisions Made This Session

### Decision Framework Structure
Adopted 3-category approach for RDF → LPG translation:
- **Category A**: Auto-resolvable (7 items) - deterministic transformations
- **Category B**: Human decision required (12 items) - need guidance UI
- **Category C**: Not resolvable (8 items) - document limitations

### Fabric Technical Requirements (from docs research)
- Data must be in **managed Lakehouse tables** (Delta format)
- Graph model maps tables to nodes/edges via column mappings
- Column names must avoid special characters
- Schema evolution NOT supported - requires reingest

### User Interface Approach
- Decision-making: Fabric App (wizard-style) preferred over Power BI
- Execution: Spark Notebooks + Pipelines
- Each B-category decision needs: explanation, examples, preview

---

## Next Steps

1. **Upload NEN 2660-2 Test Data**
   - Add normative files (SKOS, RDFS, OWL, SHACL)
   - Add example TTL files (bridge, road network, hospital)
   - Analyze structure to validate decision framework

2. **Design Architecture**
   - Update `docs/architecture.md` with specific components
   - Define data flow: RDF files → Lakehouse → Ontology → Graph

3. **Prototype Decision UI**
   - Evaluate Fabric App capabilities for wizard workflows
   - Design guidance content for each B-category decision

4. **Link to Fabric Workspace**
   - Create or connect to Fabric workspace
   - Test Ontology/Graph preview features

---

## Fabric Workloads Reference

Potential workloads for this RDF translation project:

| Workload | Use Case in This Project |
|----------|-------------------------|
| **Lakehouse** | Store raw data (Bronze) and transformed data (Silver/Gold) |
| **Notebooks** | RDF translation logic, ontology mapping, validation |
| **Pipelines** | Orchestrate ingestion and transformation workflows |
| **Warehouse** | Optional - if SQL-based analytics needed |
| **Reports** | Visualize translation metrics, data quality |

---

## Key Commands

```bash
# Navigate to project
cd "C:\Users\redelang\Code\cd-rdf-dev-01\fabric_rdf_translation"

# Check git status
git status

# Commit changes
git add .
git commit -m "Your commit message"

# Open in VS Code
code .
```

---

## Questions to Answer (Requirements Phase)

1. What data sources need RDF translation?
2. What RDF format(s) are required? (Turtle, N-Triples, JSON-LD, RDF/XML?)
3. What ontologies/vocabularies will be used?
4. What are the transformation rules?
5. Who/what consumes the RDF output?
6. What are the volume and performance requirements?

---

## Resources

- [Microsoft Fabric Documentation](https://learn.microsoft.com/en-us/fabric/)
- [OneLake Overview](https://learn.microsoft.com/en-us/fabric/onelake/onelake-overview)
- [Fabric REST API](https://learn.microsoft.com/en-us/rest/api/fabric/)
