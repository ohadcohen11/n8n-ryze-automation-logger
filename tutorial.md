# Building n8n-nodes-ryze-automation-logger

A custom n8n node for logging Ryze workflow execution metrics to MySQL database. This node captures execution data from Ryze Pixel Sender and stores comprehensive metrics for monitoring and analysis.

---

## Package Information

- **Package Name**: `n8n-nodes-ryze-automation-logger`
- **Display Name**: Ryze Automation Logger
- **Description**: Log Ryze workflow execution metrics to MySQL database
- **Version**: 1.0.0
- **Dependencies**: `mysql2: ^3.6.0`

---

## Database Schema

### Table: `scraper_executions`

```sql
CREATE TABLE scraper_executions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  script_id VARCHAR(50) NOT NULL,
  execution_mode VARCHAR(20) NOT NULL,  -- 'regular' or 'monthly'
  execution_type VARCHAR(20) NOT NULL,  -- 'manual' or 'scheduled'
  workflow_name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL,          -- 'success' or 'error'
  items_processed INT NOT NULL DEFAULT 0,
  pixel_new INT NOT NULL DEFAULT 0,
  pixel_duplicates INT NOT NULL DEFAULT 0,
  pixel_updated INT NOT NULL DEFAULT 0,
  event_summary JSON,                   -- {"lead": 1, "sale": 5}
  full_details JSON,                    -- Complete Pixel Sender output
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_script_id (script_id),
  INDEX idx_created_at (created_at),
  INDEX idx_execution_type (execution_type)
);
```

---

## Input Data Format

### Example 1: With New Items
```json
[
  {
    "execution": {
      "mode": "regular",
      "dry_run": false,
      "script_id": "2000",
      "timestamp": "2025-12-11T13:32:03.613Z",
      "duration_ms": 33
    },
    "summary": {
      "total_input": 40,
      "new_items": 1,
      "exact_duplicates": 39,
      "updated_items": 0,
      "event_summary": {
        "lead": 1
      },
      "sent_to_pixel": 1,
      "pixel_success": 1,
      "pixel_failed": 0,
      "db_inserted": 1,
      "db_updated": 0
    },
    "details": {
      "sent_items": {
        "items": [
          {
            "trx_id": "Aircall-lead-64cb00021a0e",
            "event": "lead",
            "amount": "0",
            "commission_amount": 520,
            "status": "new",
            "pixel_status": "OK"
          }
        ],
        "total": 1,
        "showing": 1,
        "truncated": false
      },
      "failed_sends": []
    }
  }
]
```

### Example 2: All Duplicates (No New Items)
```json
[
  {
    "execution": {
      "mode": "regular",
      "dry_run": false,
      "script_id": "2000",
      "timestamp": "2025-12-11T19:06:55.000Z",
      "duration_ms": 25
    },
    "summary": {
      "total_input": 16,
      "new_items": 0,
      "exact_duplicates": 16,
      "updated_items": 0,
      "event_summary": {},
      "sent_to_pixel": 0,
      "pixel_success": 0,
      "pixel_failed": 0,
      "db_inserted": 0,
      "db_updated": 0
    },
    "details": {
      "sent_items": {
        "items": [],
        "total": 0,
        "showing": 0,
        "truncated": false
      },
      "failed_sends": []
    }
  }
]
```

---

## Expected Database Inserts

### Example 1: With New Items
```sql
INSERT INTO scraper_executions (
  script_id,
  execution_mode,
  execution_type,
  workflow_name,
  status,
  items_processed,
  pixel_new,
  pixel_duplicates,
  pixel_updated,
  event_summary,
  full_details,
  created_at
) VALUES (
  '2000',
  'regular',
  'scheduled',
  '[2000] [API] Aircall - PartnerStack Event Tracker',
  'success',
  40,
  1,
  39,
  0,
  '{"lead": 1}',
  '{"execution": {...}, "summary": {...}, "details": {...}}',
  '2025-12-11 15:32:03'
);
```

### Example 2: All Duplicates
```sql
INSERT INTO scraper_executions (
  script_id,
  execution_mode,
  execution_type,
  workflow_name,
  status,
  items_processed,
  pixel_new,
  pixel_duplicates,
  pixel_updated,
  event_summary,
  full_details,
  created_at
) VALUES (
  '2000',
  'regular',
  'manual',
  '[2000] [API] Aircall - PartnerStack Event Tracker',
  'success',
  16,
  0,
  16,
  0,
  '{}',
  '[]',
  '2025-12-11 19:06:55'
);
```

---

## Node Implementation

### Node Properties

```typescript
{
  displayName: 'Ryze Automation Logger',
  name: 'ryzeAutomationLogger',
  icon: 'file:ryzeAutomationLogger.svg',
  group: ['transform'],
  version: 1,
  description: 'Log Ryze workflow execution metrics to MySQL database',
  defaults: {
    name: 'Ryze Automation Logger',
  },
  inputs: ['main'],
  outputs: ['main'],
  credentials: [
    {
      name: 'mySql',
      required: true,
    },
  ],
  properties: [
    // Script ID is auto-detected from Pixel Sender output
    // No manual configuration needed!
  ],
}
```

---

## Node Logic

### 1. Extract Data from Input

```typescript
const items = this.getInputData();
const pixelSenderOutput = items[0].json;

// Extract from Pixel Sender output
const scriptId = pixelSenderOutput.execution.script_id;
const executionMode = pixelSenderOutput.execution.mode;
const totalInput = pixelSenderOutput.summary.total_input;
const newItems = pixelSenderOutput.summary.new_items;
const duplicates = pixelSenderOutput.summary.exact_duplicates;
const updatedItems = pixelSenderOutput.summary.updated_items;
const eventSummary = pixelSenderOutput.summary.event_summary;
const fullDetails = pixelSenderOutput;
```

### 2. Detect Execution Type (Manual vs Scheduled)

```typescript
// Check if workflow was manually triggered or scheduled
const executionData = this.getExecutionData();
const executionType = executionData.mode === 'manual' ? 'manual' : 'scheduled';
```

### 3. Get Workflow Name

```typescript
const workflow = this.getWorkflow();
const workflowName = workflow.name;
```

### 4. Determine Status

```typescript
const status = pixelSenderOutput.summary.pixel_failed > 0 ? 'error' : 'success';
```

### 5. Handle Empty Event Summary

```typescript
// When all duplicates, event_summary is {}
// Store as '{}' in database, not '[]'
const eventSummaryJson = Object.keys(eventSummary).length === 0 
  ? '{}' 
  : JSON.stringify(eventSummary);

// When no new items, full_details.details is []
// Store as '[]' in database
const fullDetailsJson = newItems === 0 && duplicates > 0
  ? '[]'
  : JSON.stringify(fullDetails);
```

### 6. Insert to Database

```typescript
const connection = await mysql.createConnection({
  host: credentials.host,
  port: credentials.port,
  database: credentials.database,
  user: credentials.user,
  password: credentials.password,
});

const query = `
  INSERT INTO scraper_executions (
    script_id,
    execution_mode,
    execution_type,
    workflow_name,
    status,
    items_processed,
    pixel_new,
    pixel_duplicates,
    pixel_updated,
    event_summary,
    full_details
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

await connection.execute(query, [
  scriptId,
  executionMode,
  executionType,
  workflowName,
  status,
  totalInput,
  newItems,
  duplicates,
  updatedItems,
  eventSummaryJson,
  fullDetailsJson,
]);

await connection.end();
```

---

## Node Output

The node should pass through the original Pixel Sender output unchanged:

```typescript
return this.prepareOutputData(items);
```

This allows chaining additional nodes after the logger.

---

## Error Handling

```typescript
try {
  // ... insert logic
  
  return this.prepareOutputData([{
    json: {
      success: true,
      script_id: scriptId,
      execution_type: executionType,
      items_logged: 1,
    }
  }]);
  
} catch (error) {
  // Log error but don't fail the workflow
  this.logger.error('Failed to log execution', { error: error.message });
  
  // Pass through original data
  return this.prepareOutputData(items);
}
```

---

## Usage in Workflows

### Standard Pattern

```
Ryze Pixel Sender
    ↓
Ryze Automation Logger  ← Automatically captures script_id and metrics
    ↓
(Optional: Additional nodes)
```

### Configuration

**Zero configuration required!** The node automatically:
- ✅ Extracts `script_id` from Pixel Sender output
- ✅ Detects if execution is manual or scheduled
- ✅ Gets workflow name from n8n context
- ✅ Parses all metrics from Pixel Sender response

---

## Key Features

1. **Auto-Detection**
   - Script ID from Pixel Sender
   - Execution type (manual/scheduled)
   - Workflow name from n8n

2. **Smart JSON Handling**
   - Empty event_summary → `{}`
   - No new items → `[]` for full_details

3. **Error Resilience**
   - Logs errors but doesn't fail workflow
   - Passes through original data

4. **MySQL Integration**
   - Uses standard n8n MySQL credentials
   - Efficient single INSERT query
   - Proper JSON column handling

---

## Testing

### Test Case 1: Workflow with New Items

**Input**: Pixel Sender output with 1 new item  
**Expected DB Record**:
- `items_processed`: 40
- `pixel_new`: 1
- `pixel_duplicates`: 39
- `event_summary`: `{"lead": 1}`
- `full_details`: Complete JSON object

### Test Case 2: All Duplicates

**Input**: Pixel Sender output with 0 new items  
**Expected DB Record**:
- `items_processed`: 16
- `pixel_new`: 0
- `pixel_duplicates`: 16
- `event_summary`: `{}`
- `full_details`: `[]`

### Test Case 3: Manual Execution

**Action**: Click "Execute" button manually  
**Expected**: `execution_type` = `'manual'`

### Test Case 4: Scheduled Execution

**Action**: Schedule trigger fires  
**Expected**: `execution_type` = `'scheduled'`

---

## Monitoring Queries

### Recent Executions
```sql
SELECT script_id, workflow_name, execution_type, 
       items_processed, pixel_new, pixel_duplicates,
       created_at
FROM scraper_executions
ORDER BY created_at DESC
LIMIT 50;
```

### Success Rate by Script
```sql
SELECT script_id, 
       COUNT(*) as total_executions,
       SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
       ROUND(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as success_rate
FROM scraper_executions
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY script_id
ORDER BY total_executions DESC;
```

### New Items Trend
```sql
SELECT DATE(created_at) as date,
       script_id,
       SUM(pixel_new) as total_new_items,
       SUM(items_processed) as total_processed
FROM scraper_executions
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY DATE(created_at), script_id
ORDER BY date DESC, script_id;
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-11 | Initial release with auto-detection |

---

## Support

**Package Repository**: https://github.com/ohadcohen11/n8n-nodes-ryze-automation-logger  
**Issues**: https://github.com/ohadcohen11/n8n-nodes-ryze-automation-logger/issues  
**Author**: Ohad Cohen <ohad.cohen@ryzebeyond.com>
