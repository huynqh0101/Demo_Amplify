import { defineFunction } from '@aws-amplify/backend';

export const worker = defineFunction({ name: 'tasks-worker', entry: './handler.ts', timeoutSeconds: 30 });
