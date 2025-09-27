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

async function createTimeSeries(metricType: string, value: number, labels?: { [key: string]: string }) {
  if (!projectId) {
    logger.warn('GCP_PROJECT_ID not set. Custom metrics disabled.');
    return;
  }

  const dataPoint = {
    interval: {
      endTime: {
        seconds: Date.now() / 1000,
      },
    },
    value: {
      int64Value: String(Math.round(value)),
    },
  };

  const timeSeriesData = {
    metric: {
      type: `custom.googleapis.com/xtreamly/${metricType}`,
      labels: labels || {},
    },
    resource: resource,
    points: [dataPoint],
  };

  try {
    const request = {
      name: client.projectPath(projectId),
      timeSeries: [timeSeriesData],
    };
    await client.createTimeSeries(request);
    logger.debug(`Recorded metric '${metricType}' with value ${value}`);
  } catch (err) {
    logger.error(err, `Failed to record metric '${metricType}'`);
  }
}

export async function recordMetric(metricName: string, value: number, labels?: { [key: string]: string }) {
  await createTimeSeries(metricName, value, labels);
}
