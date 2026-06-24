import jwt from 'jsonwebtoken';
import axios from 'axios';
import { AuthRepository } from './auth.repository';
import { AppError } from '../../shared/errors/AppError';
import { config } from '../../config/env';
import { generateId } from '../../shared/utils/id';
import { hashPassword, verifyPassword, encryptToken } from '../../shared/utils/crypto';
import { User } from '../../shared/types';
import { RegisterInput, LoginInput } from './auth.schemas';

interface AuthTokenPayload {
  userId: string;
  email: string;
}

interface GithubUserData {
  id: number;
  login: string;
  avatar_url: string;
  email: string | null;
}

export class AuthService {
  private readonly repo = new AuthRepository();

  // ─────────────────────────────────────────────
  // REGISTER
  // ─────────────────────────────────────────────

  async register(input: RegisterInput): Promise<{ user: Omit<User, 'passwordHash'>; token: string }> {
    // Check if email already exists
    const existing = await this.repo.findByEmail(input.email);
    if (existing) {
      throw AppError.conflict('An account with this email already exists');
    }

    const passwordHash = await hashPassword(input.password);
    const now = new Date().toISOString();

    const user: User = {
      userId: generateId.user(),
      email: input.email,
      passwordHash,
      createdAt: now,
      updatedAt: now,
      status: 'ACTIVE',
    };

    await this.repo.create(user);

    const token = this.generateToken({ userId: user.userId, email: user.email });

    const { passwordHash: _, ...safeUser } = user;
    return { user: safeUser, token };
  }

  // ─────────────────────────────────────────────
  // LOGIN
  // ─────────────────────────────────────────────

  async login(input: LoginInput): Promise<{ user: Omit<User, 'passwordHash'>; token: string }> {
    const user = await this.repo.findByEmail(input.email);

    // Use the same error for wrong email and wrong password.
    // Separate errors ("email not found" vs "wrong password")
    // help attackers enumerate valid accounts.
    if (!user) {
      throw AppError.unauthorized('Invalid email or password');
    }

    if (user.status === 'SUSPENDED') {
      throw AppError.forbidden('Account suspended');
    }

    const isValid = await verifyPassword(input.password, user.passwordHash);
    if (!isValid) {
      throw AppError.unauthorized('Invalid email or password');
    }

    const token = this.generateToken({ userId: user.userId, email: user.email });

    const { passwordHash: _, ...safeUser } = user;
    return { user: safeUser, token };
  }

  // ─────────────────────────────────────────────
  // GET CURRENT USER
  // ─────────────────────────────────────────────

  async getMe(userId: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.repo.findById(userId);
    if (!user) {
      throw AppError.notFound('User not found');
    }

    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  // ─────────────────────────────────────────────
  // GITHUB OAUTH — Exchange code for token
  // ─────────────────────────────────────────────

  async connectGithub(
    userId: string,
    code: string
  ): Promise<Omit<User, 'passwordHash'>> {
    // Step 1: Exchange the OAuth code for an access token
    const tokenResponse = await axios.post<{ access_token: string }>(
      'https://github.com/login/oauth/access_token',
      {
        client_id: config.githubClientId,
        client_secret: config.githubClientSecret,
        code,
      },
      {
        headers: { Accept: 'application/json' },
      }
    );

    const accessToken = tokenResponse.data.access_token;
    if (!accessToken) {
      throw AppError.badRequest('Failed to exchange GitHub code for access token');
    }

    // Step 2: Use the access token to get the GitHub user's profile
    const userResponse = await axios.get<GithubUserData>(
      'https://api.github.com/user',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    const githubUser = userResponse.data;

    // Step 3: Check if another DevDeploy account has this GitHub account connected
    const existingConnection = await this.repo.findByGithubId(
      String(githubUser.id)
    );
    if (existingConnection && existingConnection.userId !== userId) {
      throw AppError.conflict(
        'This GitHub account is already connected to another DevDeploy account'
      );
    }

    // Step 4: Store encrypted GitHub token
    const encryptedToken = encryptToken(accessToken);

    await this.repo.updateGithubConnection(userId, {
      githubId: String(githubUser.id),
      githubLogin: githubUser.login,
      githubToken: encryptedToken,
      avatarUrl: githubUser.avatar_url,
    });

    const updatedUser = await this.repo.findById(userId);
    if (!updatedUser) throw AppError.notFound('User not found');

    const { passwordHash: _, ...safeUser } = updatedUser;
    return safeUser;
  }

  async disconnectGithub(userId: string): Promise<void> {
    const user = await this.repo.findById(userId);
    if (!user) throw AppError.notFound('User not found');
    if (!user.githubId) throw AppError.badRequest('GitHub is not connected');

    await this.repo.disconnectGithub(userId);
  }

  // ─────────────────────────────────────────────
  // PRIVATE: Generate JWT
  // ─────────────────────────────────────────────

  private generateToken(payload: AuthTokenPayload): string {
    return jwt.sign(payload, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn,
    } as jwt.SignOptions);
  }
}