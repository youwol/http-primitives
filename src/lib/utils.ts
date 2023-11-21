import { Observable, of, OperatorFunction, ReplaySubject, Subject } from 'rxjs'
import { filter, map, mergeMap, tap } from 'rxjs/operators'

export type Empty = Record<string, never>

export interface JsonMap {
    [member: string]: string | number | boolean | null | JsonArray | JsonMap
}

export type JsonArray = Array<
    string | number | boolean | null | JsonArray | JsonMap
>

export type Json = JsonMap | JsonArray | string | number | boolean | null

export type RequestStep = 'started' | 'transferring' | 'processing' | 'finished'

export type CommandType =
    | 'upload'
    | 'download'
    | 'create'
    | 'update'
    | 'delete'
    | 'query'

export type HTTPResponse$<T> = Observable<T | HTTPError>

export class HTTPError {
    constructor(
        public readonly status: number,
        public readonly body: Json,
    ) {}
}

export function muteHTTPErrors<T>(
    onError?: (HTTPError) => void,
): OperatorFunction<T | HTTPError, T> {
    return (source$: Observable<T | HTTPError>) => {
        return source$.pipe(
            tap((resp) => {
                if (onError && resp instanceof HTTPError) {
                    onError(resp)
                }
            }),
            filter((resp: T | HTTPError) => !(resp instanceof HTTPError)),
            map((d) => d as T),
        )
    }
}

export function raiseHTTPErrors<T>(): OperatorFunction<T | HTTPError, T> {
    return (source$: Observable<T | HTTPError>) => {
        return source$.pipe(
            tap((resp: T | HTTPError) => {
                if (resp instanceof HTTPError) {
                    throw resp
                }
            }),
            map((d) => d as T),
        )
    }
}

export function dispatchHTTPErrors<T>(
    error$: Subject<HTTPError>,
): OperatorFunction<T | HTTPError, T> {
    return (source$: Observable<T | HTTPError>) => {
        return source$.pipe(
            tap((resp: T | HTTPError) => {
                if (resp instanceof HTTPError) {
                    error$.next(resp)
                }
            }),
            filter((resp: T | HTTPError) => !(resp instanceof HTTPError)),
            map((d) => d as T),
        )
    }
}

export function onHTTPErrors<T, V>(
    fct: (error: HTTPError) => V,
): OperatorFunction<T | HTTPError, T | V> {
    return (source$: Observable<T | HTTPError>) => {
        return source$.pipe(
            map((resp: T | HTTPError) => {
                return resp instanceof HTTPError ? fct(resp) : resp
            }),
        )
    }
}

export class RequestFollower {
    public readonly channels$: Array<Subject<RequestEvent>>
    public readonly requestId: string
    public readonly commandType: CommandType

    totalCount: number
    transferredCount: number

    constructor({
        requestId,
        channels$,
        commandType,
    }: {
        requestId: string
        channels$: Subject<RequestEvent> | Array<Subject<RequestEvent>>
        commandType: CommandType
    }) {
        this.requestId = requestId
        this.channels$ = Array.isArray(channels$) ? channels$ : [channels$]
        this.commandType = commandType
    }

    start(totalCount?: number) {
        this.totalCount = totalCount
        this.channels$.forEach((channel$) =>
            channel$.next({
                requestId: this.requestId,
                step: 'started',
                transferredCount: 0,
                totalCount: this.totalCount,
                commandType: this.commandType,
            }),
        )
    }

    progressTo(transferredCount: number, totalCount?: number) {
        this.totalCount = totalCount != undefined ? totalCount : this.totalCount
        this.transferredCount = transferredCount
        this.channels$.forEach((channel$) =>
            channel$.next({
                requestId: this.requestId,
                step:
                    this.totalCount != undefined &&
                    this.transferredCount == this.totalCount
                        ? 'processing'
                        : 'transferring',
                transferredCount: this.transferredCount,
                totalCount: this.totalCount,
                commandType: this.commandType,
            }),
        )
    }

    end() {
        this.transferredCount = this.totalCount
        this.channels$.forEach((channel$) =>
            channel$.next({
                requestId: this.requestId,
                step: 'finished',
                transferredCount: this.transferredCount,
                totalCount: this.totalCount,
                commandType: this.commandType,
            }),
        )
    }
}

export interface RequestEvent {
    readonly requestId: string
    readonly commandType: CommandType
    readonly step: RequestStep
    readonly totalCount: number
    readonly transferredCount: number
}

export interface RequestMonitoring {
    /**
     * Request followers
     */
    channels$?: Subject<RequestEvent> | Array<Subject<RequestEvent>>

    /**
     * request label used in the events emitted in events$
     */
    requestId?: string
}

export interface CallerRequestOptions {
    monitoring?: RequestMonitoring
    headers?: Record<string, string>
}

export interface NativeRequestOptions extends RequestInit {
    json?: unknown
}

function processResponse(response) {
    if (!response.headers.has('content-type')) {
        return response.ok ? {} : new HTTPError(response.status, null)
    }

    const contentType = response.headers.get('content-type')

    if (contentType == 'application/json') {
        return response.json().then((data) => {
            return response.ok
                ? data
                : new HTTPError(response.status, data as Json)
        })
    }
    if (contentType.startsWith('text/')) {
        return response.text().then((data) => {
            return response.ok
                ? data
                : new HTTPError(response.status, { text: data })
        })
    }
    return response.blob().then((data) => {
        return response.ok ? data : new HTTPError(response.status, {})
    })
}

export function request$<T = unknown>(request: Request) {
    return new Observable<T>((observer) => {
        fetch(request)
            .then((response) => {
                return processResponse(response)
            }) // or text() or blob() etc.
            .then((data) => {
                observer.next(data as T)
                observer.complete()
            })
            .catch((err) => observer.error(err))
    })
}

export function send$<T>(
    commandType: CommandType,
    path: string,
    nativeOptions?: NativeRequestOptions,
    monitoring?: RequestMonitoring,
): Observable<T | HTTPError> {
    monitoring = monitoring || {}
    nativeOptions = nativeOptions || {}

    const { requestId, channels$ } = monitoring

    if (nativeOptions.json) {
        nativeOptions.body = JSON.stringify(nativeOptions.json)
        nativeOptions.headers = nativeOptions.headers
            ? { ...nativeOptions.headers, 'content-type': 'application/json' }
            : { 'content-type': 'application/json' }
    }
    const request = new Request(path, nativeOptions)

    if (!channels$) {
        return request$(request)
    }

    const follower = new RequestFollower({
        requestId: requestId || path,
        channels$,
        commandType,
    })

    return of({}).pipe(
        tap(() => follower.start(1)),
        mergeMap(() => request$(request)),
        tap(() => follower.end()),
    ) as Observable<T | HTTPError>
}

export function downloadBlob(
    url: string,
    fileId: string,
    headers: { [_key: string]: string },
    callerOptions?: CallerRequestOptions,
    total?: number,
): Observable<Blob | HTTPError> {
    callerOptions = callerOptions || {}
    const { requestId, channels$ } = callerOptions.monitoring || {}

    const follower =
        channels$ &&
        new RequestFollower({
            requestId: requestId || fileId,
            channels$,
            commandType: 'download',
        })

    const response$ = new ReplaySubject<Blob | HTTPError>(1)
    const xhr = new XMLHttpRequest()

    xhr.open('GET', url)
    const allHeaders = {
        ...headers,
        ...(callerOptions.headers || {}),
    }
    Object.entries(allHeaders).forEach(([key, val]: [string, string]) => {
        xhr.setRequestHeader(key, val)
    })

    xhr.responseType = 'blob'

    xhr.onloadstart = (event) =>
        follower && follower.start(total || event.total)

    xhr.onprogress = (event) => follower && follower.progressTo(event.loaded)

    xhr.onload = () => {
        follower && follower.end()
        if (xhr.status >= 400) {
            response$.next(
                new HTTPError(xhr.status, {
                    statusText: xhr.statusText,
                }),
            )
        }

        response$.next(xhr.response)
    }
    xhr.send()
    return response$
}

function camelCaseToKebabCase(str: string) {
    return str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

function queryParametersToUrlSuffix(queryParameters: { [k: string]: string }) {
    return Object.entries(queryParameters || {})
        .filter(([_, v]) => v != undefined)
        .map(([k, v]) => `${camelCaseToKebabCase(k)}=${v}&`)
        .reduce((acc, e) => `${acc}${e}`, '')
}

function setHeadersXHR(xhr: XMLHttpRequest, headers: { [k: string]: string }) {
    Object.entries(headers).forEach(([key, val]: [string, string]) => {
        xhr.setRequestHeader(key, val)
    })
}

function instrumentXHR(
    xhr: XMLHttpRequest,
    response: Subject<unknown>,
    follower?: RequestFollower,
) {
    follower &&
        (xhr.onloadstart = (event) => follower && follower.start(event.total))

    follower &&
        (xhr.upload.onprogress = (event) => {
            follower && follower.progressTo(event.loaded, event.total)
        })

    xhr.onload = () => {
        if (xhr.readyState === 4) {
            if (xhr.status < 400) {
                follower && follower.end()
                response.next(JSON.parse(xhr.responseText))
            } else {
                response.next(
                    new HTTPError(xhr.status, JSON.parse(xhr.responseText)),
                )
            }
        }
    }
}

export function sendFormData({
    url,
    queryParameters,
    formData,
    method,
    headers,
    callerOptions,
}: {
    url: string
    queryParameters?: { [_k: string]: string }
    formData: FormData
    method: 'PUT' | 'POST'
    headers
    callerOptions: CallerRequestOptions
}) {
    const { channels$ } = callerOptions.monitoring || {}
    const follower =
        channels$ &&
        new RequestFollower({
            requestId: callerOptions.monitoring.requestId,
            channels$,
            commandType: 'upload',
        })

    const xhr = new XMLHttpRequest()
    const response = new ReplaySubject<unknown>(1)

    const params = queryParametersToUrlSuffix(queryParameters || {})
    url = queryParameters ? `${url}?${params}` : url
    xhr.open(method, url, true)
    setHeadersXHR(xhr, {
        ...headers,
        ...(callerOptions.headers || {}),
    })

    instrumentXHR(xhr, response, follower)
    xhr.send(formData)
    return response.pipe(
        map((resp) => {
            if (resp instanceof Error) {
                throw resp
            }
            return resp
        }),
    )
}

export function uploadBlob(
    url: string,
    fileName: string,
    method: 'PUT' | 'POST',
    blob: Blob,
    headers,
    callerOptions: CallerRequestOptions = {},
): Observable<unknown | HTTPError> {
    const file = new File([blob], fileName, { type: blob.type })
    const formData = new FormData()
    formData.append('file', file)
    return sendFormData({ url, formData, method, headers, callerOptions })
}
