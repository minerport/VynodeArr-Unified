import { createServer } from 'node:http';
import { createApplication } from './app.js';
import { createLogger } from '../../../packages/platform/src/logger.js';

const port = Number(process.env.PORT || 4310);
const logger=createLogger({env:process.env,context:{component:'server'}}),application=createApplication({logger});
await application.initialize();
const server=createServer(application.handleRequest);
server.listen(port, '0.0.0.0', () => {
  logger.info('server.ready','VynodeArr is ready',{port});
});
const shutdown=(signal:string)=>{logger.info('server.stopping','VynodeArr is stopping',{signal});application.sync.stopPolling();server.close(error=>{if(error){logger.error('server.stop_failed','VynodeArr could not stop cleanly',{error});process.exitCode=1;}else logger.info('server.stopped','VynodeArr stopped');});};
process.once('SIGTERM',()=>shutdown('SIGTERM'));
process.once('SIGINT',()=>shutdown('SIGINT'));
process.on('uncaughtException',error=>{logger.error('process.uncaught_exception','Unexpected process failure',{error});process.exitCode=1;});
process.on('unhandledRejection',error=>{logger.error('process.unhandled_rejection','Unhandled background failure',{error});process.exitCode=1;});
