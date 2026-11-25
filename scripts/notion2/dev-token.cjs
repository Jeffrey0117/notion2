// Local test login for notion2: signs a 6-hour access token with the app's own secret.
// usage: node scripts/notion2/dev-token.cjs .env <userId> <workspaceId> data/dev-token.txt
const fs = require('fs');
const crypto = require('crypto');
const env = fs.readFileSync(process.argv[2], 'utf8');
const secret = /^APP_SECRET=(.+)$/m.exec(env)[1].trim();
const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const body =
  b({ alg: 'HS256', typ: 'JWT' }) +
  '.' +
  b({
    sub: process.argv[3],
    workspaceId: process.argv[4],
    type: 'access',
    iat: now,
    exp: now + 6 * 3600,
    iss: 'Docmost',
  });
const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
fs.writeFileSync(process.argv[5], body + '.' + sig);
