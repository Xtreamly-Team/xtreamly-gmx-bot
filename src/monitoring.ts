/*
 * GCP Monitoring and Metrics Module for Cloud Run (Node.js)
 */
import { MetricServiceClient } from '@google-cloud/monitoring';
import logger from './logger';

// --- Cloud Run Specific Configuration ---
const client = new MetricServiceClient();
const projectId = process.env.GCP_PROJECT_ID;
const serviceName = process.env.K_SERVICE || 'unknown';
const revisionName = process.env.K_REVISION || 'unknown';
const location = process.env.GCP_REGION || 'unknown';

const resource = {
  type: 'generic_task',
  labels: {
    project_id: projectId,
    location: location,
    namespace: serviceName,
    job: serviceName,
    task_id: revisionName,
  },
};
