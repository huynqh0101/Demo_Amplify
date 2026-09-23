import { randomUUID } from "node:crypto";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  DeleteCommand,
  GetCommand,
  PutCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { canReadTask, isAdminGroup } from "./access";

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const sqs = new SQSClient({});
const table = process.env.TABLE_NAME!;
const queueUrl = process.env.QUEUE_URL!;
const reply = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
) => {
  const claims = event.requestContext.authorizer?.jwt?.claims;
  const owner = claims?.sub;
  if (typeof owner !== "string")
    return reply(401, { error: "Unauthenticated" });
  const groups = claims?.["cognito:groups"];
  const isAdmin = isAdminGroup(groups);
  const method = event.requestContext.http.method;
  const path = event.rawPath;

  if (method === "GET" && path === "/me")
    return reply(200, { sub: owner, email: claims?.email, isAdmin });

  if (method === "POST" && path === "/tasks") {
    let input: unknown;
    try {
      input = JSON.parse(event.body || "{}");
    } catch {
      return reply(400, { error: "Invalid JSON" });
    }
    const text = (input as { text?: unknown })?.text;
    if (typeof text !== "string" || !text.trim() || text.length > 1000)
      return reply(400, { error: "text must contain 1 to 1000 characters" });
    const task = {
      id: randomUUID(),
      owner,
      text: text.trim(),
      status: "QUEUED",
      createdAt: new Date().toISOString(),
    };
    await db.send(new PutCommand({ TableName: table, Item: task }));
    try {
      await sqs.send(
        new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify({ id: task.id, text: task.text }),
        }),
      );
    } catch (error) {
      await db.send(
        new DeleteCommand({ TableName: table, Key: { id: task.id } }),
      );
      throw error;
    }
    return reply(202, task);
  }

  if (method === "GET" && path.startsWith("/tasks/")) {
    const id = event.pathParameters?.id;
    if (!id) return reply(400, { error: "Missing task id" });
    const { Item } = await db.send(
      new GetCommand({ TableName: table, Key: { id } }),
    );
    if (!Item || !canReadTask(Item.owner, owner, isAdmin))
      return reply(404, { error: "Task not found" });
    return reply(200, Item);
  }

  if (method === "GET" && path === "/tasks") {
    const result = await db.send(
      new ScanCommand({
        TableName: table,
        Limit: 100,
        FilterExpression: "#owner = :owner",
        ExpressionAttributeNames: { "#owner": "owner" },
        ExpressionAttributeValues: { ":owner": owner },
      }),
    );
    return reply(200, { tasks: result.Items ?? [] });
  }

  if (method === "GET" && path === "/admin/tasks") {
    if (!isAdmin) return reply(403, { error: "Admin only" });
    const result = await db.send(
      new ScanCommand({ TableName: table, Limit: 100 }),
    );
    return reply(200, { tasks: result.Items ?? [] });
  }
  return reply(404, { error: "Not found" });
};
