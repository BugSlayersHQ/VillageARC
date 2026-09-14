import { S3Client } from '@aws-sdk/client-s3';

const storageEndpoint = process.env.STORAGE_ENDPOINT;

export const s3 = new S3Client({
  region: process.env.STORAGE_REGION,
  ...(storageEndpoint ? { endpoint: storageEndpoint, forcePathStyle: true } : {}),
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY ?? '',
  },
});

export const storageBucket = process.env.STORAGE_BUCKET ?? '';
