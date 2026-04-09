declare module "express-serve-static-core" {
  interface Request {
    authenticatedUserId?: string;
  }
}

export {};
