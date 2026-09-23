export function isAdminGroup(groups: unknown): boolean {
  if (Array.isArray(groups)) return groups.includes('ADMINS');
  if (typeof groups !== 'string') return false;
  return groups.replace(/[\[\]"\s]/g, '').split(',').includes('ADMINS');
}

export function canReadTask(taskOwner: string, currentUser: string, isAdmin: boolean): boolean {
  return taskOwner === currentUser || isAdmin;
}
