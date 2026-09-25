declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: {
        userId: number;
        role: 'ADMIN' | 'USER';
      };
    }
  }
}

export {};
