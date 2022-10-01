import { merge, Observable, OperatorFunction } from 'rxjs'
import { filter, map, mergeMap, shareReplay, take, tap } from 'rxjs/operators'
import {
    CommandType,
    HTTPError,
    HTTPResponse$,
    NativeRequestOptions,
    raiseHTTPErrors,
    RequestMonitoring,
    send$,
} from './utils'

export type ManagedError = 'ManagedError'

export class Shell<T> {
    context: T
    constructor(params: { context?: T; [k: string]: unknown }) {
        Object.assign(this, params)
    }
}

export function wrap<TShell, TResp, _TContext>({
    observable,
    authorizedErrors,
    sideEffects,
    newShell,
}: {
    observable: (shell: TShell) => HTTPResponse$<TResp>
    authorizedErrors?: (resp) => boolean
    sideEffects: (resp: TResp, shell?: TShell) => void
    newShell?: (shell: TShell, resp: TResp) => TShell
}): OperatorFunction<TShell, TShell> {
    authorizedErrors = authorizedErrors || (() => false)
    return (source$: Observable<TShell>) => {
        return source$.pipe(
            mergeMap((shell) => {
                const response$ = observable(shell).pipe(shareReplay(1))
                const error$ = response$.pipe(
                    filter((resp) => {
                        return (
                            resp instanceof HTTPError && !authorizedErrors(resp)
                        )
                    }),
                    raiseHTTPErrors(),
                    map(() => shell),
                )
                const managedError$ = response$.pipe(
                    filter((resp) => {
                        return (
                            resp instanceof HTTPError && authorizedErrors(resp)
                        )
                    }),
                    map(() => shell),
                )
                const success$ = response$.pipe(
                    filter((resp) => {
                        return !(resp instanceof HTTPError)
                    }),
                    map((resp) => resp as TResp),
                    tap((resp) => {
                        sideEffects(resp, shell)
                    }),
                    map((resp) => {
                        if (!newShell) {
                            return shell
                        }
                        return newShell(shell, resp)
                    }),
                )
                return merge(error$, managedError$, success$).pipe(take(1))
            }),
        )
    }
}

export function newShellFromContext<TContext, TResp>(
    shell: Shell<TContext>,
    resp: TResp,
    newContext?: (s: Shell<TContext>, r: TResp) => TContext,
) {
    return newContext
        ? new Shell({ ...shell, context: newContext(shell, resp) })
        : shell
}

export function send<TResp, TContext>({
    inputs,
    authorizedErrors,
    newContext,
    sideEffects,
}: {
    inputs: (shell: Shell<TContext>) => {
        commandType: CommandType
        path: string
        nativeOptions?: NativeRequestOptions
        monitoring?: RequestMonitoring
    }
    authorizedErrors?: (resp: HTTPError) => boolean
    sideEffects?: (resp, shell: Shell<TContext>) => void
    newContext?: (shell: Shell<TContext>, resp: TResp) => TContext
}) {
    return wrap<Shell<TContext>, TResp, TContext>({
        observable: (shell: Shell<TContext>) => {
            const { commandType, path, nativeOptions, monitoring } =
                inputs(shell)
            return send$(commandType, path, nativeOptions, monitoring)
        },
        authorizedErrors,
        sideEffects: (resp, shell) => {
            sideEffects && sideEffects(resp, shell)
        },
        newShell: (shell, resp) => newShellFromContext(shell, resp, newContext),
    })
}
