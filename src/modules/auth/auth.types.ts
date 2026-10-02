export type ApiKeyRole = 'admin' | 'member' | 'readonly';

export const API_KEY_ROLES: ApiKeyRole[] = ['admin', 'member', 'readonly'];

export function isApiKeyRole(value: string): value is ApiKeyRole {
  return (API_KEY_ROLES as string[]).includes(value);
}
