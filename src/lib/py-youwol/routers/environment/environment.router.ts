import {
    EnvironmentStatusResponse,
    LoginResponse,
    GetEnvironmentStatusResponse,
} from './interfaces'
import { WsRouter } from '../../py-youwol.client'
import {
    CallerRequestOptions,
    filterCtxMessage,
    HTTPResponse$,
    Router,
    WebSocketResponse$,
} from '../../../../lib'

class WebSocketAPI {
    constructor(public readonly ws: WsRouter) {}

    status$(
        filters: { profile?: string } = {},
    ): WebSocketResponse$<EnvironmentStatusResponse> {
        return this.ws.data$.pipe(
            filterCtxMessage<EnvironmentStatusResponse>({
                withLabels: ['EnvironmentStatusResponse'],
                withAttributes: filters,
            }),
        )
    }
}

export class EnvironmentRouter extends Router {
    public readonly webSocket: WebSocketAPI

    constructor(parent: Router, ws: WsRouter) {
        super(parent.headers, `${parent.basePath}/environment`)
        this.webSocket = new WebSocketAPI(ws)
    }

    /**
     * Login as user
     *
     * @param body
     * @param body.email user's email
     * @param callerOptions
     */
    login$({
        body,
        callerOptions,
    }: {
        body: { email: string }
        callerOptions?: CallerRequestOptions
    }): HTTPResponse$<LoginResponse> {
        return this.send$({
            command: 'upload',
            path: `/login`,
            nativeRequestOptions: {
                json: body,
            },
            callerOptions,
        })
    }

    /**
     * Status
     *
     * @param callerOptions
     */
    getStatus$({
        callerOptions,
    }: {
        callerOptions?: CallerRequestOptions
    } = {}): HTTPResponse$<GetEnvironmentStatusResponse> {
        return this.send$({
            command: 'query',
            path: `/status`,
            callerOptions,
        })
    }
}
