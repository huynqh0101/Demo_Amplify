import type { SQSHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
export const handler: SQSHandler = async (event) => {
  for (const record of event.Records) {
    const { id, text } = JSON.parse(record.body) as {
      id: string;
      text: string;
    };
    await db.send(
      new UpdateCommand({
        TableName: process.env.TABLE_NAME!,
        Key: { id },
        UpdateExpression:
          "SET #status = :status, #result = :result, completedAt = :completedAt",
        ConditionExpression: "attribute_exists(id)",
        ExpressionAttributeNames: { "#status": "status", "#result": "result" },
        ExpressionAttributeValues: {
          ":status": "DONE",
          ":result": text.toUpperCase(),
          ":completedAt": new Date().toISOString(),
        },
      }),
    );
  }
};
