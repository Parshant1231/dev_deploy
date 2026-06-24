import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { config } from '../config/env';

// The base DynamoDBClient handles the low-level API calls.
// DynamoDBDocumentClient is a higher-level wrapper that
// automatically marshals and unmarshals DynamoDB attribute types.
//
// Without DocumentClient:
//   { userId: { S: "usr_abc123" } }
//
// With DocumentClient:
//   { userId: "usr_abc123" }
//
// Always use DocumentClient for application code.

const dynamoDBClient = new DynamoDBClient({
  region: config.awsRegion,
});

export const docClient = DynamoDBDocumentClient.from(dynamoDBClient, {
  marshallOptions: {
    // Remove undefined values from objects before writing to DynamoDB
    removeUndefinedValues: true,
    // Convert JavaScript Date objects to ISO strings automatically
    convertClassInstanceToMap: false,
  },
  unmarshallOptions: {
    // Return numbers as JavaScript numbers, not BigInt
    wrapNumbers: false,
  },
});

export { dynamoDBClient };