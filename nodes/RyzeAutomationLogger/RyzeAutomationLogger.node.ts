import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	ICredentialDataDecryptedObject,
	IDataObject,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';
import * as mysql from 'mysql2/promise';

export class RyzeAutomationLogger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Ryze Automation Logger',
		name: 'ryzeAutomationLogger',
		icon: 'file:ryzeAutomationLogger.svg',
		group: ['transform'],
		version: 1,
		description: 'Log Ryze workflow execution metrics to MySQL database',
		defaults: {
			name: 'Ryze Automation Logger',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'mySql',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Table Name',
				name: 'tableName',
				type: 'string',
				default: 'n8n_scraper_logs',
				placeholder: 'n8n_scraper_logs',
				description: 'The name of the MySQL table to store execution logs',
				required: true,
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();

		// Get table name from node parameters
		const tableName = this.getNodeParameter('tableName', 0) as string;

		try {
			// Get the Pixel Sender output from the first item
			const pixelSenderOutput = items[0].json as IDataObject;

			// Extract data from Pixel Sender output
			const execution = pixelSenderOutput.execution as IDataObject;
			const summary = pixelSenderOutput.summary as IDataObject;

			const scriptId = execution.script_id as string;
			const executionMode = execution.mode as string;
			const totalInput = summary.total_input as number;
			const newItems = summary.new_items as number;
			const duplicates = summary.exact_duplicates as number;
			const updatedItems = summary.updated_items as number;
			const eventSummary = summary.event_summary as IDataObject || {};
			const pixelFailed = (summary.pixel_failed as number) || 0;

			// Detect execution type (manual vs scheduled)
			const mode = this.getMode();
			const executionType = mode === 'manual' ? 'manual' : 'scheduled';

			// Get workflow name
			const workflow = this.getWorkflow();
			const workflowName = workflow.name || 'Unknown Workflow';

			// Determine status
			const status = pixelFailed > 0 ? 'error' : 'success';

			// Handle empty event summary and full details
			const eventSummaryJson = Object.keys(eventSummary).length === 0
				? '{}'
				: JSON.stringify(eventSummary);

			const fullDetailsJson = newItems === 0 && duplicates > 0
				? '[]'
				: JSON.stringify(pixelSenderOutput);

			// Get MySQL credentials
			const credentials = await this.getCredentials('mySql') as ICredentialDataDecryptedObject;

			// Create MySQL connection
			const connection = await mysql.createConnection({
				host: credentials.host as string,
				port: credentials.port as number,
				database: credentials.database as string,
				user: credentials.user as string,
				password: credentials.password as string,
			});

			// Insert to database
			const query = `
				INSERT INTO ${tableName} (
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

			await (connection as any).execute(query, [
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

			// Return success output
			return this.prepareOutputData([{
				json: {
					success: true,
					script_id: scriptId,
					execution_type: executionType,
					workflow_name: workflowName,
					status,
					items_logged: 1,
				}
			}]);

		} catch (error) {
			// Log error but don't fail the workflow
			if (this.logger) {
				this.logger.error('Failed to log execution', { error: error.message });
			}

			// Pass through original data on error
			return this.prepareOutputData(items);
		}
	}
}
