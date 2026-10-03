import { validateHostedEnvironment } from '@pokopia/security';

const target = process.env.POKOPIA_DEPLOYMENT_TARGET ?? 'development';
if (target !== 'staging' && target !== 'production') {
  process.stdout.write(`PASS: ${target} keeps portable local defaults.\n`);
  process.exit(0);
}

const result = validateHostedEnvironment(process.env, target);
if (!result.valid) {
  process.stderr.write(`${result.errors.map((error) => `- ${error}`).join('\n')}\n`);
  process.exit(1);
}
process.stdout.write(`PASS: ${target} security environment is complete.\n`);
