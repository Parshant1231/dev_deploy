import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { docClient } from '../../aws/dynamodb';
import { config } from '../../config/env';
import { User } from '../../shared/types';

export class AuthRepository {
  private readonly tableName = config.tables.users;

  async findByEmail(email: string): Promise<User | null> {
    const result = await docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'email-index',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: {
          ':email': email,
        },
        Limit: 1,
      })
    );

    if (!result.Items || result.Items.length === 0) {
      return null;
    }

    return result.Items[0] as User;
  }

  async findById(userId: string): Promise<User | null> {
    const result = await docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { userId },
      })
    );

    return (result.Item as User) ?? null;
  }

  async findByGithubId(githubId: string): Promise<User | null> {
    const result = await docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'githubId-index',
        KeyConditionExpression: 'githubId = :githubId',
        ExpressionAttributeValues: {
          ':githubId': githubId,
        },
        Limit: 1,
      })
    );

    if (!result.Items || result.Items.length === 0) {
      return null;
    }

    return result.Items[0] as User;
  }

  async create(user: User): Promise<User> {
    await docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: user,
        // Prevent overwriting an existing user with the same userId
        ConditionExpression: 'attribute_not_exists(userId)',
      })
    );
    return user;
  }

  async updateGithubConnection(
    userId: string,
    githubData: {
      githubId: string;
      githubLogin: string;
      githubToken: string;
      avatarUrl: string;
    }
  ): Promise<void> {
    await docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { userId },
        UpdateExpression:
          'SET githubId = :githubId, githubLogin = :githubLogin, ' +
          'githubToken = :githubToken, avatarUrl = :avatarUrl, ' +
          'updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':githubId': githubData.githubId,
          ':githubLogin': githubData.githubLogin,
          ':githubToken': githubData.githubToken,
          ':avatarUrl': githubData.avatarUrl,
          ':updatedAt': new Date().toISOString(),
        },
      })
    );
  }

  async disconnectGithub(userId: string): Promise<void> {
    await docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { userId },
        UpdateExpression:
          'REMOVE githubId, githubLogin, githubToken, avatarUrl ' +
          'SET updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':updatedAt': new Date().toISOString(),
        },
      })
    );
  }
}