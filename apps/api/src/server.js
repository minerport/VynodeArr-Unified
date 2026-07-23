import { createServer } from 'node:http';
import { defaultApplication } from './app.js';

const port = Number(process.env.PORT || 4310);
await defaultApplication.sync.startup();
defaultApplication.sync.startPolling();
createServer(defaultApplication.handleRequest).listen(port, '0.0.0.0', () => {
  console.log(`VynodeNew is ready at http://localhost:${port}`);
});
