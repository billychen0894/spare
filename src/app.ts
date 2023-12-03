import { LOG_FORMAT, NODE_ENV, PORT } from '@config';
import { stream } from '@utils/logger';
import express from 'express';
import morgan from 'morgan';

export class App {
  public app: express.Application;
  public env: string;
  public port: string | number;

  constructor() {
    this.app = express();
    this.env = NODE_ENV || 'development';
    this.port = PORT || 4040;

    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares() {
    this.app.use(morgan(LOG_FORMAT!, { stream }));
  }
  private initializeRoutes() {}
  private initializeErrorHandling() {}
  public listen() {}
}
