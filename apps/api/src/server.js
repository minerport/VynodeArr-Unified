import { createServer } from 'node:http';
import { handleRequest } from './app.js';

const port = Number(process.env.PORT || 4310);
createServer(handleRequest).listen(port, () => {
  console.log(`VynodeNew is ready at http://localhost:${port}`);
});
