import 'dotenv/config';
import app from './app.js';

const exampleJwtSecret = 'replace-with-a-long-random-secret';
if (
  process.env.NODE_ENV === 'production'
  && (!process.env.JWT_SECRET || process.env.JWT_SECRET === exampleJwtSecret)
) {
  throw new Error('JWT_SECRET must be set to a non-example value in production.');
}

const port = Number(process.env.PORT) || 5000;

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});