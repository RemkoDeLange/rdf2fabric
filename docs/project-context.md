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

🟡 **Phase: Requirements Gathering**

- [x] Project folder structure created
- [x] Git repository initialized
- [x] Documentation templates in place
- [ ] Requirements documented
- [ ] Architecture finalized
- [ ] Data sources identified
- [ ] Fabric workspace linked

---

## Next Steps

1. **Document Requirements**
   - Open `docs/requirements.md`
   - Fill in business problem, objectives, data sources
   - Define RDF translation requirements (formats, ontologies, rules)

2. **Identify Data Sources**
   - Document source systems in `docs/data-sources.md`
   - Define RDF mappings and target ontologies

3. **Design Architecture**
   - Update `docs/architecture.md` with specific components
   - Decide on Fabric workloads needed (Lakehouse, Notebooks, Pipelines, etc.)

4. **Link to Fabric Workspace**
   - Use VS Code Fabric extension to link local folder to remote workspace
   - Or create new workspace if needed

5. **Push to Remote Repository**
   ```bash
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

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
