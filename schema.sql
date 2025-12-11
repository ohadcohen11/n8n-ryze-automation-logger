-- Database schema for Ryze Automation Logger
-- Default table name: n8n_scraper_logs
-- (Table name is configurable in the node settings)

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
