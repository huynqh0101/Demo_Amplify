import assert from 'node:assert/strict';
import test from 'node:test';
import { canReadTask, isAdminGroup } from '../amplify/functions/api/access.ts';

test('authorization checks exact admin membership and task ownership', () => {
  assert.equal(isAdminGroup('[ADMINS,USERS]'), true);
  assert.equal(isAdminGroup('SUPERADMINS'), false);
  assert.equal(isAdminGroup(['ADMINS']), true);
  assert.equal(canReadTask('alice', 'bob', false), false);
  assert.equal(canReadTask('alice', 'alice', false), true);
  assert.equal(canReadTask('alice', 'bob', true), true);
});
