import { defineFunction } from "@aws-amplify/backend";

export const api = defineFunction({ name: "tasks-api", entry: "./handler.ts" });
