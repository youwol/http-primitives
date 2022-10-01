import { CustomCommandsRouter } from './custom-commands'
import { EnvironmentRouter } from './environment'
import { WsRouter } from '../py-youwol.client'
import { Router } from '../../../lib'

export class AdminRouter extends Router {
    public readonly customCommands: CustomCommandsRouter
    public readonly environment: EnvironmentRouter

    constructor(parent: Router, ws: WsRouter) {
        super(parent.headers, `${parent.basePath}/admin`)
        this.customCommands = new CustomCommandsRouter(this, ws)
        this.environment = new EnvironmentRouter(this, ws)
    }
}
