import path from 'path';

function resolveWritablePath(envValue: string | undefined, fallbackRelativePath: string) {
  const rawPath = envValue?.trim() || fallbackRelativePath;
  return path.isAbsolute(rawPath) ? rawPath : path.join(/* turbopackIgnore: true */ process.cwd(), rawPath);
}

export function getUploadRoot() {
  return resolveWritablePath(process.env.UPLOAD_DIR, path.join('public', 'uploads'));
}

export function getProductUploadDir() {
  return path.join(getUploadRoot(), 'products');
}

export function getAppUploadDir() {
  return path.join(getUploadRoot(), 'app');
}

export function getCompanyUploadDir() {
  return path.join(getUploadRoot(), 'company');
}

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production' && (!secret || secret === 'zation-pos-secret-key-change-this')) {
    throw new Error('JWT_SECRET must be set to a strong random value in production');
  }
  return secret || 'zation-pos-secret-key-change-this';
}

export function ensureChildPath(baseDir: string, requestedPath: string) {
  const normalizedBase = path.resolve(baseDir);
  const resolvedPath = path.resolve(normalizedBase, requestedPath);
  const relative = path.relative(normalizedBase, resolvedPath);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Invalid file path');
  }

  return resolvedPath;
}
