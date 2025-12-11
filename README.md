# n8n-nodes-ryze-automation-logger

![n8n.io - Workflow Automation](https://raw.githubusercontent.com/n8n-io/n8n/master/assets/n8n-logo.png)

A custom n8n node for logging Ryze workflow execution metrics to MySQL database. This node captures execution data from Ryze Pixel Sender and stores comprehensive metrics for monitoring and analysis.

## Installation

### Community Nodes (Recommended)

1. Go to **Settings > Community Nodes** in your n8n instance
2. Click **Install a community node**
3. Enter `n8n-nodes-ryze-automation-logger`
4. Click **Install**

### Manual Installation

```bash
npm install n8n-nodes-ryze-automation-logger
```

## Prerequisites

- n8n instance (self-hosted or cloud)
- MySQL database (5.7+ or 8.0+)
- Node.js v22 or higher

## Database Setup

Create the required table in your MySQL database:

```sql
CREATE TABLE IF NOT EXISTS n8n_scraper_logs (
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

You can use a custom table name by changing the **Table Name** parameter in the node settings.

## Configuration

### 1. Add MySQL Credentials

1. Go to **Credentials** in n8n
2. Click **Add Credential**
3. Select **MySQL**
4. Fill in your database connection details:
   - Host
   - Port (default: 3306)
   - Database name
   - User
   - Password

### 2. Add Node to Workflow

1. In your workflow, add the **Ryze Automation Logger** node after your **Ryze Pixel Sender** node
2. Select your MySQL credentials
3. (Optional) Change the **Table Name** (defaults to `n8n_scraper_logs`)

## Usage

### Workflow Pattern

```
Ryze Pixel Sender
    ↓
Ryze Automation Logger  ← Automatically logs metrics to MySQL
    ↓
(Optional: Additional nodes)
```

### What Gets Logged

The node automatically extracts and logs:

- **script_id** - From Pixel Sender output
- **execution_mode** - 'regular' or 'monthly'
- **execution_type** - Auto-detected ('manual' or 'scheduled')
- **workflow_name** - From n8n workflow context
- **status** - 'success' or 'error' (based on pixel failures)
- **items_processed** - Total input items
- **pixel_new** - New items sent to pixel
- **pixel_duplicates** - Duplicate items skipped
- **pixel_updated** - Updated items
- **event_summary** - JSON of event types (e.g., `{"lead": 1, "sale": 5}`)
- **full_details** - Complete Pixel Sender output

### Example Input (from Pixel Sender)

```json
{
  "execution": {
    "mode": "regular",
    "script_id": "2000",
    "timestamp": "2025-12-11T13:32:03.613Z"
  },
  "summary": {
    "total_input": 40,
    "new_items": 1,
    "exact_duplicates": 39,
    "updated_items": 0,
    "event_summary": {
      "lead": 1
    },
    "pixel_success": 1,
    "pixel_failed": 0
  }
}
```

### Example Output

The node returns success information:

```json
{
  "success": true,
  "script_id": "2000",
  "execution_type": "scheduled",
  "workflow_name": "[2000] [API] Aircall - PartnerStack Event Tracker",
  "status": "success",
  "items_logged": 1
}
```

## Features

✅ **Zero Configuration** - Auto-extracts all data from Pixel Sender
✅ **Configurable Table Name** - Use any table name you prefer
✅ **Auto-Detection** - Automatically detects manual vs scheduled execution
✅ **Error Resilient** - Logs errors but doesn't fail the workflow
✅ **Pass-through** - Passes original data to next nodes on success or error
✅ **Smart JSON Handling** - Properly handles empty event summaries and edge cases

## Monitoring Queries

### Recent Executions

```sql
SELECT script_id, workflow_name, execution_type,
       items_processed, pixel_new, pixel_duplicates,
       created_at
FROM n8n_scraper_logs
ORDER BY created_at DESC
LIMIT 50;
```

### Success Rate by Script (Last 7 Days)

```sql
SELECT script_id,
       COUNT(*) as total_executions,
       SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
       ROUND(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as success_rate
FROM n8n_scraper_logs
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY script_id
ORDER BY total_executions DESC;
```

### New Items Trend (Last 30 Days)

```sql
SELECT DATE(created_at) as date,
       script_id,
       SUM(pixel_new) as total_new_items,
       SUM(items_processed) as total_processed
FROM n8n_scraper_logs
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY DATE(created_at), script_id
ORDER BY date DESC, script_id;
```

## Development

### Setup

```bash
git clone https://github.com/ohadcohen11/n8n-ryze-automation-logger.git
cd n8n-ryze-automation-logger
npm install
```

### Build

```bash
npm run build
```

### Link for Local Development

```bash
npm link
cd /path/to/n8n
npm link n8n-nodes-ryze-automation-logger
```

## Compatibility

- **n8n version**: 1.0.0+
- **Node.js version**: 22.0+
- **MySQL version**: 5.7+ or 8.0+

## License

[MIT](LICENSE.md)

## Author

**Ohad Cohen**
Email: ohad.cohen@ryzebeyond.com
GitHub: [@ohadcohen11](https://github.com/ohadcohen11)

## Support

- **Issues**: [GitHub Issues](https://github.com/ohadcohen11/n8n-ryze-automation-logger/issues)
- **Repository**: [GitHub](https://github.com/ohadcohen11/n8n-ryze-automation-logger)

## Version History

### 1.0.0 (2025-12-11)
- Initial release
- Auto-detection of script_id, execution type, and workflow name
- Configurable table name
- Comprehensive error handling
- MySQL integration with standard n8n credentials
