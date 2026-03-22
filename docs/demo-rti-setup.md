# Real-Time Intelligence Demo Setup

One-time setup checklist for the RTI demonstration components.

## Fabric Items (Actual Names)

| Item | Type | Status |
|------|------|--------|
| `eh_hospital_dev_01` | Eventhouse | ✅ Created |
| `eh_hospital_dev_01` | KQL Database | ✅ Created |
| `es_operating-room_dev_01` | Eventstream | ✅ Created |
| `Ziekenhuis_lvl4_v2_Ontology` | Ontology | ✅ Created |
| `GraphQuerySet_01` | Graph QuerySet | ✅ Created |

## Prerequisites

- [x] Pipeline completed (NB00-NB09)
- [x] Ontology deployed with `Operatiekamer` node type
- [x] Graph refreshed with data
- [x] Eventhouse and KQL Database created
- [x] Eventstream created with Custom App source

## Step 1: Create Eventhouse ✅

| Setting | Value |
|---------|-------|
| Name | `eh_hospital_dev_01` |
| Workspace | Same as ontology workspace |

## Step 2: Create KQL Database ✅

| Setting | Value |
|---------|-------|
| Name | `eh_hospital_dev_01` |
| Parent | `eh_hospital_dev_01` |

## Step 3: Create Eventstream ✅

| Setting | Value |
|---------|-------|
| Name | `es_operating-room_dev_01` |
| Workspace | Same as ontology workspace |

## Step 4: Configure Eventstream Source ✅

1. Open `es_operating-room_dev_01`
2. Add source → **Custom App**
3. Name: `notebook_source`
4. **Copy the connection string** → needed for notebook

## Step 5: Configure Eventstream Destination

1. Add destination → **KQL Database**
2. Select `eh_hospital_dev_01`
3. Table name: `OperatiekamerTelemetry`
4. Input data format: JSON
5. Create table with schema:

```kql
.create table OperatiekamerTelemetry (
    operatiekamer_id: string,
    timestamp: datetime,
    temperature_celsius: real,
    status: string,
    run_id: string
)
```

> **Note:** The `run_id` column tracks which notebook run generated the events. Use it to filter or clean up data from multiple runs.

## Step 6: Bind KQL Table to Ontology

1. Open `Ziekenhuis_lvl4_v2_Ontology` in portal
2. Select `Operatiekamer` node type
3. Add data binding → KQL Database
4. Select `eh_hospital_dev_01` → `OperatiekamerTelemetry`
5. Map `operatiekamer_id` to node `id` or `label`

## Step 7: Enable Ontology Data Agent

1. Open Ontology settings
2. Enable "Ontology Data Agent"
3. Configure agent name/description

## Step 8: Upload and Run Demo Notebook

1. Upload `01_eventstream_demo.ipynb` to Fabric
2. Configure `EVENTSTREAM_CONNECTION_STRING` in notebook
3. Run demo options:
   - **Backfill only**: Run `backfill_historical_data()` to populate 24h of past data
   - **Live only**: Run `run_demo()` for real-time streaming
   - **Full demo**: Run `run_full_demo()` for backfill + live streaming

> **Tip:** Each run has a unique `run_id`. If you run multiple times, use KQL queries to filter or clear old data.

---

## Event Schema

| Field | Type | Example | Update Frequency |
|-------|------|---------|------------------|
| `operatiekamer_id` | string | `Operatiekamer_1` | — |
| `timestamp` | datetime | `2026-03-21T14:30:00Z` | Every event |
| `temperature_celsius` | real | `21.5` | ~1 min |
| `status` | string | `In Use` | ~1 hour |
| `run_id` | string | `a1b2c3d4` | Per notebook run |

**Status values:**
- `Available` - Room ready for next procedure
- `In Use` - Surgery in progress
- `Cleaning` - Post-procedure cleaning
- `Maintenance` - Equipment maintenance/repair

---

## Demo Flow

1. **Run Notebook** - Backfill 24h of history, then start live stream
2. **Show Eventstream** - Events flowing in real-time
3. **Show KQL Database** - Query recent telemetry
4. **Show Graph Query** - `MATCH (o:Operatiekamer) RETURN o.id, o.\`label\`, o.status`
5. **Show Ontology Agent** - "What is the current status of operating rooms?"

## Sample KQL Queries

```kql
// Recent events
OperatiekamerTelemetry
| where timestamp > ago(1h)
| order by timestamp desc
| take 100

// Current status per room
OperatiekamerTelemetry
| summarize arg_max(timestamp, *) by operatiekamer_id

// Temperature trend
OperatiekamerTelemetry
| where timestamp > ago(24h)
| summarize avg(temperature_celsius) by bin(timestamp, 1h), operatiekamer_id
| render timechart

// View all notebook runs
OperatiekamerTelemetry
| summarize count(), min(timestamp), max(timestamp) by run_id
| order by max_timestamp desc

// Clear table (start fresh)
.clear table OperatiekamerTelemetry data
```
