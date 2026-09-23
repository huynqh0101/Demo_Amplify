import { defineBackend } from "@aws-amplify/backend";
import { Duration, Stack } from "aws-cdk-lib";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import {
  CorsHttpMethod,
  HttpApi,
  HttpMethod,
} from "aws-cdk-lib/aws-apigatewayv2";
import { HttpUserPoolAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { auth } from "./auth/resource";
import { api } from "./functions/api/resource";
import { worker } from "./functions/worker/resource";

const backend = defineBackend({ auth, api, worker });
const stack = backend.createStack("tasks");
const table = new Table(stack, "TaskTable", {
  partitionKey: { name: "id", type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
});
const deadLetterQueue = new Queue(stack, "TaskDeadLetterQueue");
const queue = new Queue(stack, "TaskQueue", {
  visibilityTimeout: Duration.seconds(60),
  deadLetterQueue: { queue: deadLetterQueue, maxReceiveCount: 3 },
});
const apiLambda = backend.api.resources.lambda;
const workerLambda = backend.worker.resources.lambda;
table.grantReadWriteData(apiLambda);
table.grantReadWriteData(workerLambda);
queue.grantSendMessages(apiLambda);
queue.grantConsumeMessages(workerLambda);
backend.api.addEnvironment("TABLE_NAME", table.tableName);
backend.api.addEnvironment("QUEUE_URL", queue.queueUrl);
backend.worker.addEnvironment("TABLE_NAME", table.tableName);
workerLambda.addEventSource(new SqsEventSource(queue, { batchSize: 1 }));

const apiStack = backend.createStack("rest-api");
const httpApi = new HttpApi(apiStack, "TasksHttpApi", {
  corsPreflight: {
    allowOrigins: ["http://localhost:5173"],
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST],
  },
});
const authorizer = new HttpUserPoolAuthorizer(
  "CognitoAuthorizer",
  backend.auth.resources.userPool,
  {
    userPoolClients: [backend.auth.resources.userPoolClient],
  },
);
const integration = new HttpLambdaIntegration("TasksIntegration", apiLambda);
for (const [path, methods] of [
  ["/me", [HttpMethod.GET]],
  ["/tasks", [HttpMethod.GET, HttpMethod.POST]],
  ["/tasks/{id}", [HttpMethod.GET]],
  ["/admin/tasks", [HttpMethod.GET]],
] as const) {
  httpApi.addRoutes({ path, methods: [...methods], integration, authorizer });
}
backend.addOutput({
  custom: {
    API: {
      tasks: {
        endpoint: httpApi.url!,
        region: Stack.of(httpApi).region,
        apiName: "tasks",
      },
    },
  },
});
