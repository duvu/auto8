import { hostname } from 'os';

interface TransportTarget {
  target: string;
  options: Record<string, unknown>;
  level: string;
}

interface SingleTransport {
  target: string;
  options: Record<string, unknown>;
}

interface MultiTransport {
  targets: TransportTarget[];
}

function warn(msg: string): void {
  process.stderr.write(`[logging] WARN: ${msg}\n`);
}

export function buildLogTransports(): SingleTransport | MultiTransport {
  if (process.env['NODE_ENV'] !== 'production') {
    return { target: 'pino-pretty', options: { colorize: true } };
  }

  const targets: TransportTarget[] = [
    { target: 'pino/file', options: { destination: 1 }, level: 'info' },
  ];

  // CloudWatch
  if (process.env['CLOUDWATCH_ENABLED'] === 'true') {
    const accessKeyId = process.env['AWS_ACCESS_KEY_ID'];
    const secretAccessKey = process.env['AWS_SECRET_ACCESS_KEY'];
    const region = process.env['AWS_REGION'];
    const logGroupName = process.env['CLOUDWATCH_LOG_GROUP'];

    if (accessKeyId && secretAccessKey && region && logGroupName) {
      targets.push({
        target: '@serdnam/pino-cloudwatch-transport',
        options: {
          accessKeyId,
          secretAccessKey,
          region,
          logGroupName,
          logStreamName: process.env['CLOUDWATCH_LOG_STREAM'] ?? hostname(),
          createLogGroup: true,
          createLogStream: true,
        },
        level: 'info',
      });
    } else {
      warn(
        'CLOUDWATCH_ENABLED=true but required vars missing (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, CLOUDWATCH_LOG_GROUP). CloudWatch transport skipped.',
      );
    }
  }

  // Datadog
  if (process.env['DATADOG_ENABLED'] === 'true') {
    const ddApiKey = process.env['DD_API_KEY'];
    if (ddApiKey) {
      targets.push({
        target: 'pino-datadog-transport',
        options: {
          apiKey: ddApiKey,
          ddtags: `service:${process.env['DD_SERVICE'] ?? 'auto8'},env:${process.env['DD_ENV'] ?? 'production'}`,
        },
        level: 'info',
      });
    } else {
      warn('DATADOG_ENABLED=true but DD_API_KEY is not set. Datadog transport skipped.');
    }
  }

  // Loki
  if (process.env['LOKI_ENABLED'] === 'true') {
    const lokiHost = process.env['LOKI_HOST'];
    if (lokiHost) {
      const lokiUsername = process.env['LOKI_USERNAME'];
      const lokiPassword = process.env['LOKI_PASSWORD'];
      targets.push({
        target: 'pino-loki',
        options: {
          host: lokiHost,
          basicAuth:
            lokiUsername && lokiPassword
              ? { username: lokiUsername, password: lokiPassword }
              : undefined,
          labels: { app: 'auto8' },
        },
        level: 'info',
      });
    } else {
      warn('LOKI_ENABLED=true but LOKI_HOST is not set. Loki transport skipped.');
    }
  }

  // New Relic
  if (process.env['NEW_RELIC_ENABLED'] === 'true') {
    const licenseKey = process.env['NEW_RELIC_LICENSE_KEY'];
    if (licenseKey) {
      targets.push({
        target: 'pino-new-relic',
        options: {
          licenseKey,
          appName: process.env['NEW_RELIC_APP_NAME'] ?? 'auto8',
        },
        level: 'info',
      });
    } else {
      warn(
        'NEW_RELIC_ENABLED=true but NEW_RELIC_LICENSE_KEY is not set. New Relic transport skipped.',
      );
    }
  }

  if (targets.length === 1) {
    return targets[0] as SingleTransport;
  }

  return { targets };
}
