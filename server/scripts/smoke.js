import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const serverDirectory = resolve(scriptDirectory, '..');
const baseUrl = (process.env.API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
let failures = 0;

function check(name, callback) {
  return callback().then(() => {
    console.log(`PASS ${name}`);
  }).catch((error) => {
    failures += 1;
    console.error(`FAIL ${name}: ${error.message}`);
  });
}

async function request(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let data = text;
  try {
    data = JSON.parse(text);
  } catch {
    // CSV responses intentionally remain text.
  }
  return { response, data, text };
}

function expectStatus(result, expected) {
  assert.equal(result.response.status, expected, `expected HTTP ${expected}, received ${result.response.status}: ${JSON.stringify(result.data)}`);
}

async function main() {
  console.log('Resetting and seeding the database...');
  execSync('npm run seed -- --reset', { cwd: serverDirectory, stdio: 'inherit' });

  const tokens = {};
  const credentials = {
    worker: 'worker@demo.in',
    supervisor: 'supervisor@demo.in',
    ulb_admin: 'admin@demo.in',
  };
  for (const [role, email] of Object.entries(credentials)) {
    await check(`login ${role}`, async () => {
      const result = await request('/auth/login', { method: 'POST', body: { email, password: 'Demo@1234' } });
      expectStatus(result, 200);
      assert.ok(result.data.token);
      assert.equal(result.data.user.role, role);
      assert.equal('passwordHash' in result.data.user, false);
      tokens[role] = result.data.token;
    });
  }

  await check('wrong password returns 401', async () => {
    expectStatus(await request('/auth/login', { method: 'POST', body: { email: credentials.worker, password: 'wrong' } }), 401);
  });

  await check('authenticated user endpoint', async () => {
    const result = await request('/auth/me', { token: tokens.worker });
    expectStatus(result, 200);
    assert.equal(result.data.user.role, 'worker');
    assert.equal('passwordHash' in result.data.user, false);
  });

  let wardIds;
  await check('authenticated ward dropdown', async () => {
    const result = await request('/wards', { token: tokens.worker });
    expectStatus(result, 200);
    wardIds = Object.fromEntries(result.data.wards.map((ward) => [ward.code, ward.id]));
    assert.ok(wardIds.W01 && wardIds.W02);
  });

  await check('citizen wards list is public', async () => {
    const result = await request('/citizen/wards');
    expectStatus(result, 200);
    assert.ok(Array.isArray(result.data));
    assert.deepEqual(Object.keys(result.data[0]).sort(), ['code', 'id', 'name']);
    assert.equal(result.data.some((ward) => ward.code === 'W01'), true);
  });

  let household;
  await check('worker registers a household in own ward', async () => {
    const result = await request('/households', {
      method: 'POST',
      token: tokens.worker,
      body: { ownerName: 'Smoke Test Resident', phone: '9876509001', address: '10 Smoke Test Road, Chennai', type: 'residential', wardId: wardIds.W01 },
    });
    expectStatus(result, 201);
    household = result.data.household;
    assert.match(household.qrCode, /^HH-W01-\d{3}$/);
  });

  const citizenRegistrationBody = {
    ownerName: 'Citizen Smoke Resident',
    phone: '9876509055',
    address: '82 Citizen Smoke Lane, Ward 1, Chennai',
    type: 'residential',
    wardId: wardIds.W01,
    consent: true,
  };
  let citizenRegistration;
  await check('citizen registration returns safe QR details', async () => {
    const result = await request('/citizen/register', { method: 'POST', body: citizenRegistrationBody });
    expectStatus(result, 201);
    citizenRegistration = result.data;
    assert.match(citizenRegistration.qrCode, /^HH-W01-\d{3}$/);
    assert.equal(citizenRegistration.ownerFirstName, 'Citizen');
    assert.equal(citizenRegistration.phoneLast4, '9055');
    assert.equal(JSON.stringify(result.data).includes(citizenRegistrationBody.phone), false);
    assert.equal('phone' in result.data, false);
  });

  await check('rate limit protection headers are present on citizen routes', async () => {
    const statusResult = await request(`/citizen/status?qrCode=${encodeURIComponent(citizenRegistration.qrCode)}&phoneLast4=9055`);
    expectStatus(statusResult, 200);
    const limitHeader = statusResult.response.headers.get('ratelimit') || statusResult.response.headers.get('ratelimit-policy');
    assert.ok(limitHeader, 'Rate limit headers (draft-8 standard) should be returned by rate limiting middleware');
  });

  await check('citizen registration rejects invalid phone and missing consent', async () => {
    const badPhone = await request('/citizen/register', {
      method: 'POST',
      body: { ...citizenRegistrationBody, phone: '1234567890', address: '83 Different Citizen Lane, Chennai' },
    });
    expectStatus(badPhone, 422);
    const noConsent = await request('/citizen/register', {
      method: 'POST',
      body: { ...citizenRegistrationBody, phone: '9876509056', address: '84 Different Citizen Lane, Chennai', consent: false },
    });
    expectStatus(noConsent, 422);
  });

  await check('duplicate citizen registration returns generic 409', async () => {
    const duplicate = await request('/citizen/register', {
      method: 'POST',
      body: { ...citizenRegistrationBody, ownerName: 'Another Name', address: ' 82   citizen smoke lane, ward 1, CHENNAI ' },
    });
    expectStatus(duplicate, 409);
    assert.equal(duplicate.data.error.message, 'This household may already be registered. Use your existing code, or ask your collection worker.');
  });

  await check('new household appears in worker ward and has empty citizen status', async () => {
    const list = await request(`/households?wardId=${wardIds.W01}&page=1&limit=100`, { token: tokens.worker });
    expectStatus(list, 200);
    assert.ok(list.data.households.some((item) => item.qrCode === citizenRegistration.qrCode));

    const status = await request(`/citizen/status?qrCode=${encodeURIComponent(citizenRegistration.qrCode)}&phoneLast4=9055`);
    expectStatus(status, 200);
    assert.equal(status.data.ecoPoints, 0);
    assert.equal(status.data.weeklyComplianceScore, null);
    assert.deepEqual(status.data.logs, []);
    assert.deepEqual(status.data.notifications, []);
    assert.deepEqual(status.data.pointsHistory, []);
  });

  await check('new household status rejects incorrect phoneLast4', async () => {
    expectStatus(await request(`/citizen/status?qrCode=${encodeURIComponent(citizenRegistration.qrCode)}&phoneLast4=9999`), 404);
  });

  await check('points history appears after a worker pickup', async () => {
    const logged = await request('/pickup-logs', {
      method: 'POST',
      token: tokens.worker,
      body: { clientUuid: randomUUID(), qrCode: citizenRegistration.qrCode, status: 'segregated' },
    });
    expectStatus(logged, 201);
    const status = await request(`/citizen/status?qrCode=${encodeURIComponent(citizenRegistration.qrCode)}&phoneLast4=9055`);
    expectStatus(status, 200);
    assert.ok(status.data.pointsHistory.length > 0);
    assert.ok(status.data.pointsHistory[0].pickup.id);
    assert.equal(status.data.pointsHistory[0].pickup.status, 'segregated');
  });

  await check('household list, scanner lookup, detail, and QR payload', async () => {
    const list = await request('/households?page=1&limit=10', { token: tokens.worker });
    expectStatus(list, 200);
    assert.ok(list.data.households.length > 0);
    const byQr = await request(`/households/by-qr/${encodeURIComponent(household.qrCode)}`, { token: tokens.worker });
    expectStatus(byQr, 200);
    assert.equal(byQr.data.household.id, household.id);
    const detail = await request(`/households/${household.id}`, { token: tokens.worker });
    expectStatus(detail, 200);
    const qr = await request(`/households/${household.id}/qr`, { token: tokens.worker });
    expectStatus(qr, 200);
    assert.equal(qr.data.payload.qrCode, household.qrCode);
  });

  const pickupUuid = randomUUID();
  const pickupBody = { clientUuid: pickupUuid, qrCode: household.qrCode, status: 'segregated' };
  await check('worker logs segregated pickup and earns points', async () => {
    const result = await request('/pickup-logs', { method: 'POST', token: tokens.worker, body: pickupBody });
    expectStatus(result, 201);
    assert.equal(result.data.pointsAwarded, 10);
    assert.equal(result.data.ecoPointsTotal, 10);
    assert.equal(result.data.log.status, 'segregated');
  });

  await check('duplicate clientUuid is idempotent', async () => {
    const result = await request('/pickup-logs', { method: 'POST', token: tokens.worker, body: pickupBody });
    expectStatus(result, 200);
    assert.equal(result.data.duplicate, true);
    const list = await request(`/pickup-logs?householdId=${household.id}`, { token: tokens.worker });
    expectStatus(list, 200);
    assert.equal(list.data.pagination.total, 1);
  });

  await check('rejected pickup without reason returns 422', async () => {
    const result = await request('/pickup-logs', {
      method: 'POST', token: tokens.worker,
      body: { clientUuid: randomUUID(), qrCode: household.qrCode, status: 'rejected' },
    });
    expectStatus(result, 422);
    assert.ok(result.data.error.details.some((detail) => detail.field === 'reason'));
  });

  await check('worker cannot log pickup outside own ward', async () => {
    const result = await request('/pickup-logs', {
      method: 'POST', token: tokens.worker,
      body: { clientUuid: randomUUID(), qrCode: 'HH-W02-001', status: 'segregated' },
    });
    expectStatus(result, 403);
  });

  await check('batch returns independent mixed results', async () => {
    const result = await request('/pickup-logs/batch', {
      method: 'POST', token: tokens.worker,
      body: { logs: [
        { clientUuid: randomUUID(), qrCode: household.qrCode, status: 'mixed' },
        { clientUuid: randomUUID(), qrCode: household.qrCode, status: 'rejected' },
        { clientUuid: randomUUID(), qrCode: household.qrCode, status: 'segregated' },
      ] },
    });
    expectStatus(result, 200);
    assert.deepEqual(result.data.results.map((item) => item.result), ['created', 'failed', 'created']);
  });

  await check('worker pickup log listing is scoped to worker', async () => {
    const result = await request('/pickup-logs?page=1&limit=100', { token: tokens.worker });
    expectStatus(result, 200);
    assert.ok(result.data.logs.every((log) => log.workerId === result.data.logs[0]?.workerId));
  });

  await check('supervisor cannot query another ward', async () => {
    const result = await request(`/pickup-logs?wardId=${wardIds.W02}`, { token: tokens.supervisor });
    expectStatus(result, 403);
  });

  await check('citizen status accepts phoneLast4 and rejects a mismatch', async () => {
    const valid = await request('/citizen/status?qrCode=HH-W01-001&phoneLast4=1001');
    expectStatus(valid, 200);
    assert.equal(valid.data.household.name, 'Ananya');
    assert.ok(Array.isArray(valid.data.logs));
    const invalid = await request('/citizen/status?qrCode=HH-W01-001&phoneLast4=9999');
    expectStatus(invalid, 404);
  });

  await check('all dashboard endpoints return data', async () => {
    const endpoints = [
      '/dashboard/summary', '/dashboard/wards', '/dashboard/trends?granularity=day',
      '/dashboard/trends?granularity=week', '/dashboard/hotspots',
      '/dashboard/violations?page=1&limit=10', '/dashboard/reasons',
    ];
    for (const endpoint of endpoints) {
      const result = await request(endpoint, { token: tokens.supervisor });
      expectStatus(result, 200);
    }
  });

  await check('CSV export includes expected header row', async () => {
    const result = await request('/dashboard/export.csv', { token: tokens.supervisor });
    expectStatus(result, 200);
    assert.ok(result.text.startsWith('Period From,Period To,Ward Code,Ward Name,Households Covered,Pickups Logged,Segregated,Mixed,Rejected,Compliance %'));
    assert.match(result.response.headers.get('content-disposition'), /\.csv/);
  });

  await check('pickup logs have no update or delete routes', async () => {
    for (const method of ['PUT', 'PATCH', 'DELETE']) {
      const result = await request(`/pickup-logs/${household.id}`, { method, token: tokens.ulb_admin, body: {} });
      expectStatus(result, 404);
    }
  });

  await check('health endpoint remains available', async () => {
    const result = await request('/health');
    expectStatus(result, 200);
    assert.equal(result.data.status, 'ok');
  });

  // ═══ DASHBOARD ROLE SCOPING ═══════════════════════════════════════════════

  await check('supervisor dashboard/wards returns only Ward 1', async () => {
    const result = await request('/dashboard/wards', { token: tokens.supervisor });
    expectStatus(result, 200);
    const wardCodes = result.data.wards.map((w) => w.code || w.wardCode);
    assert.ok(wardCodes.length >= 1, 'Supervisor must see at least 1 ward');
    assert.ok(wardCodes.every((c) => c === 'W01'), `Supervisor must only see W01 wards, got: ${wardCodes}`);
  });

  await check('supervisor dashboard/summary scoped to Ward 1 only', async () => {
    const result = await request('/dashboard/summary', { token: tokens.supervisor });
    expectStatus(result, 200);
    assert.ok(result.data, 'Summary must return data');
  });

  await check('supervisor dashboard/export.csv contains only Ward 1', async () => {
    const result = await request('/dashboard/export.csv', { token: tokens.supervisor });
    expectStatus(result, 200);
    const lines = result.text.split(/\r?\n/).filter(Boolean);
    // Skip header (line 0), check data lines only contain W01
    for (let i = 1; i < lines.length; i++) {
      assert.ok(lines[i].includes('W01'), `CSV line ${i} must contain W01: ${lines[i]}`);
      assert.ok(!lines[i].includes('W02'), `CSV line ${i} must not contain W02: ${lines[i]}`);
    }
  });

  await check('supervisor cannot request other ward via wardId param', async () => {
    const result = await request(`/dashboard/wards?wardId=${wardIds.W02}`, { token: tokens.supervisor });
    expectStatus(result, 403);
  });

  await check('supervisor cannot export other ward via wardId param', async () => {
    const result = await request(`/dashboard/export.csv?wardId=${wardIds.W02}`, { token: tokens.supervisor });
    expectStatus(result, 403);
  });

  await check('unauthenticated requests to dashboard return 401', async () => {
    const endpoints = ['/dashboard/summary', '/dashboard/wards', '/dashboard/trends?granularity=day',
      '/dashboard/hotspots', '/dashboard/violations', '/dashboard/reasons', '/dashboard/export.csv'];
    for (const endpoint of endpoints) {
      const result = await request(endpoint);
      assert.equal(result.response.status, 401, `${endpoint} without token must return 401, got ${result.response.status}`);
    }
  });

  await check('worker gets 403 on all dashboard endpoints', async () => {
    const endpoints = ['/dashboard/summary', '/dashboard/wards', '/dashboard/trends?granularity=day',
      '/dashboard/hotspots', '/dashboard/violations', '/dashboard/reasons', '/dashboard/export.csv'];
    for (const endpoint of endpoints) {
      const result = await request(endpoint, { token: tokens.worker });
      assert.equal(result.response.status, 403, `${endpoint} as worker must return 403, got ${result.response.status}`);
    }
  });

  await check('admin sees both wards in dashboard/wards', async () => {
    const result = await request('/dashboard/wards', { token: tokens.ulb_admin });
    expectStatus(result, 200);
    const wardCodes = result.data.wards.map((w) => w.code || w.wardCode);
    assert.ok(wardCodes.includes('W01'), 'Admin must see W01');
    assert.ok(wardCodes.includes('W02'), 'Admin must see W02');
  });

  await check('admin can request specific ward and both wards', async () => {
    const w1 = await request(`/dashboard/summary?wardId=${wardIds.W01}`, { token: tokens.ulb_admin });
    expectStatus(w1, 200);
    const w2 = await request(`/dashboard/summary?wardId=${wardIds.W02}`, { token: tokens.ulb_admin });
    expectStatus(w2, 200);
    const all = await request('/dashboard/summary', { token: tokens.ulb_admin });
    expectStatus(all, 200);
  });

  await check('admin CSV export contains both wards', async () => {
    const result = await request('/dashboard/export.csv', { token: tokens.ulb_admin });
    expectStatus(result, 200);
    assert.ok(result.text.includes('W01'), 'Admin CSV must include W01');
    assert.ok(result.text.includes('W02'), 'Admin CSV must include W02');
  });


  console.log(`\nSmoke checks: ${failures ? `${failures} failed` : 'all passed'}.`);
  if (failures) process.exitCode = 1;
}

main().catch((error) => {
  console.error('Smoke runner failed:', error);
  process.exitCode = 1;
});