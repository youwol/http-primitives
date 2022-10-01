import { Observable, Subject } from 'rxjs'
import { filter } from 'rxjs/operators'
import { ContextMessage, Label } from './py-youwol'

export type WebSocketResponse$<T> = Observable<ContextMessage<T>>

export function filterAttributes(
    message: ContextMessage,
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

export function filterLabels(message: ContextMessage, withLabels?: Label[]) {
    return (
        message.labels &&
        withLabels.reduce(
            (acc, label) => acc && message.labels.includes(label),
            true,
        )
    )
}

export function filterData(
    message: ContextMessage,
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

export function filterCtxMessage<T = unknown>({
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
    withLabels?: Label[]
}): (source$: WebSocketResponse$<unknown>) => WebSocketResponse$<T> {
    withAttributes = withAttributes || {}
    withLabels = withLabels || []
    return (source$: Observable<ContextMessage>) =>
        source$.pipe(
            filter((message: ContextMessage) => {
                const attrsOk = filterAttributes(message, withAttributes)

                const labelsOk = filterLabels(message, withLabels)

                if (!withDataAttributes) {
                    return attrsOk && labelsOk
                }

                const dataAttrsOk = filterData(message, withDataAttributes)

                return attrsOk && labelsOk && dataAttrsOk
            }),
        ) as WebSocketResponse$<T>
}

export class WebSocketClient<TMessage> {
    public readonly message$: Subject<TMessage>
    public ws: WebSocket

    constructor(public readonly path: string) {
        this.message$ = new Subject<TMessage>()
    }

    connectWs() {
        if (this.ws) {
            this.ws.close()
        }
        this.ws = new WebSocket(this.path)
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                this.message$.next(data)
            } catch (e) {
                console.error('Can not parse data', { error: String(e), event })
            }
        }
        this.ws.onerror = (err) => {
            console.error(
                'Socket encountered error: ',
                String(err),
                'Closing socket',
            )
            console.log('error', err)
            this.ws.close()
            console.log('Reconnect will be attempted in 1 second.')
            setTimeout(() => {
                this.connectWs()
            }, 1000)
        }
        return this.message$
    }
}
