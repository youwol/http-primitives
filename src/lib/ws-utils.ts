import { BehaviorSubject, Observable, Subject } from 'rxjs'
import { filter } from 'rxjs/operators'
import { ContextMessage, Label } from './local-youwol'

export type WebSocketResponse$<T, TLabel = Label> = Observable<
    ContextMessage<T, TLabel>
>

export function filterAttributes<T, TLabel = Label>(
    message: ContextMessage<T, TLabel>,
    withAttributes?: {
        [_key: string]: string | ((string) => boolean)
    },
) {
    return (
        message.attributes &&
        Object.entries(withAttributes).reduce((acc, [k, v]) => {
            if (!acc || !message.attributes[k]) {
                return false
            }
            if (typeof v == 'string') {
                return message.attributes[k] == v
            }

            return v(message.attributes[k])
        }, true)
    )
}

export function filterLabels<T, TLabel = Label>(
    message: ContextMessage<T, TLabel>,
    withLabels?: TLabel[],
) {
    return (
        message.labels &&
        withLabels.reduce(
            (acc, label) => acc && message.labels.includes(label),
            true,
        )
    )
}

export function filterData<T, TLabel = Label>(
    message: ContextMessage<T, TLabel>,
    withDataAttributes?: {
        [_key: string]: string | ((string) => boolean)
    },
) {
    return (
        message.data &&
        Object.entries(withDataAttributes).reduce((acc, [k, v]) => {
            if (!acc || !message.data[k]) {
                return false
            }
            if (typeof v == 'function') {
                return v(message.attributes[k])
            }
            return message.attributes[k] == v
        }, true)
    )
}

export function filterCtxMessage<T = unknown, TLabel = Label>({
    withAttributes,
    withDataAttributes,
    withLabels,
}: {
    withAttributes?: {
        [_key: string]: string | ((string) => boolean)
    }
    withDataAttributes?: {
        [_key: string]: string | ((string) => boolean)
    }
    withLabels?: TLabel[]
}): (
    source$: WebSocketResponse$<unknown, TLabel>,
) => WebSocketResponse$<T, TLabel> {
    withAttributes = withAttributes || {}
    withLabels = withLabels || []
    return (source$: Observable<ContextMessage<unknown, TLabel>>) =>
        source$.pipe(
            filter((message: ContextMessage<T, TLabel>) => {
                const attrsOk = filterAttributes<T, TLabel>(
                    message,
                    withAttributes,
                )

                const labelsOk = filterLabels<T, TLabel>(message, withLabels)

                if (!withDataAttributes) {
                    return attrsOk && labelsOk
                }

                const dataAttrsOk = filterData<T, TLabel>(
                    message,
                    withDataAttributes,
                )

                return attrsOk && labelsOk && dataAttrsOk
            }),
        ) as WebSocketResponse$<T, TLabel>
}

export interface WebSocketOptions {
    autoReconnect?: boolean
    autoReconnectDelay?: number
}

const defaultOptions = {
    autoReconnect: false,
    autoReconnectDelay: 1000,
}
export class WebSocketClient<TMessage> {
    public readonly options: Required<WebSocketOptions>
    public readonly message$: Subject<TMessage>
    public readonly connected$ = new BehaviorSubject<boolean>(false)
    public ws: WebSocket

    constructor(
        public readonly path: string,
        options: WebSocketOptions = defaultOptions,
    ) {
        this.options = { ...defaultOptions, ...options }
        this.message$ = new Subject<TMessage>()
    }

    connectWs() {
        if (this.ws) {
            this.ws.close()
        }
        this.ws = new WebSocket(this.path)
        this.ws.onopen = () => {
            this.connected$.next(true)
        }
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                this.message$.next(data)
            } catch (e) {
                console.error('Can not parse data', { error: String(e), event })
            }
        }
        this.ws.onerror = (err) => {
            console.error('Socket encountered error', err)
            this.ws.close()
        }
        this.ws.onclose = () => {
            if (this.options.autoReconnect) {
                this.connected$.next(false)
                console.log(
                    `Websocket on '${this.path}' closed, auto-reconnection will be attempted in 
                        ${this.options.autoReconnectDelay} ms.`,
                )
                setTimeout(() => {
                    this.connectWs()
                }, this.options.autoReconnectDelay)
            }
        }
        return this.message$
    }
}
