// eslint-disable-next-line eslint-comments/disable-enable-pair -- to not have problem
/* eslint-disable jest/no-done-callback -- eslint-comment It is required because */

import { PyYouwolClient, setupLocalYouwol$ } from '../lib/py-youwol'
import {
    expectAttributes,
    HTTPError,
    newShellFromContext,
    raiseHTTPErrors,
    Shell,
    wrap,
} from '../lib'
import { combineLatest, of } from 'rxjs'
import { take, tap } from 'rxjs/operators'
import { GetEnvironmentStatusResponse } from '../lib/py-youwol/routers'

let pyYouwol: PyYouwolClient

beforeAll(async (done) => {
    setupLocalYouwol$({
        localOnly: true,
        email: 'int_tests_yw-users@test-user',
    }).subscribe(() => {
        pyYouwol = new PyYouwolClient()
        done()
    })
})

test('pyYouwol.admin.environment.login', (done) => {
    pyYouwol.admin.environment
        .login$({ body: { email: 'int_tests_yw-users_bis@test-user' } })
        .pipe(raiseHTTPErrors())
        .subscribe((resp) => {
            expectAttributes(resp, ['id', 'name', 'email', 'memberOf'])
            expect(resp.name).toBe('int_tests_yw-users_bis@test-user')
            done()
        })
})

function expectEnvironment(resp) {
    expectAttributes(resp, [
        'configuration',
        'users',
        'userInfo',
        'remoteGatewayInfo',
        'remotesInfo',
    ])
    expectAttributes(resp.configuration, [
        'availableProfiles',
        'httpPort',
        'openidHost',
        'commands',
        'userEmail',
        'selectedRemote',
        'pathsBook',
    ])
}

test('pyYouwol.admin.environment.status', (done) => {
    combineLatest([
        pyYouwol.admin.environment.getStatus$().pipe(raiseHTTPErrors()),
        pyYouwol.admin.environment.webSocket.status$(),
    ])
        .pipe(
            take(1),
            tap(([respHttp, respWs]) => {
                expectEnvironment(respHttp)
                expect(respHttp).toEqual(respWs.data)
            }),
        )
        .subscribe(() => {
            done()
        })
})

function getEnvironment<TContext extends { localYouwol: PyYouwolClient }>({
    authorizedErrors,
    newContext,
    sideEffects,
}: {
    authorizedErrors?: (resp: HTTPError) => boolean
    sideEffects?: (resp, shell: Shell<TContext>) => void
    newContext?: (
        shell: Shell<TContext>,
        resp: GetEnvironmentStatusResponse,
    ) => TContext
} = {}) {
    return wrap<Shell<TContext>, GetEnvironmentStatusResponse, TContext>({
        observable: (shell: Shell<TContext>) =>
            shell.context.localYouwol.admin.environment
                .getStatus$()
                .pipe(raiseHTTPErrors()),
        authorizedErrors,
        sideEffects: (resp, shell) => {
            expectEnvironment(resp)
            sideEffects && sideEffects(resp, shell)
        },
        newShell: (shell, resp) => newShellFromContext(shell, resp, newContext),
    })
}

test('pyYouwol.admin.environment.status with shell', (done) => {
    class Context {
        localYouwol = pyYouwol
        done = false
        constructor(params: { localYouwol?; done? } = {}) {
            Object.assign(this, params)
        }
    }
    const shell = new Shell<Context>({ context: new Context() })

    of(shell)
        .pipe(
            getEnvironment({
                newContext: (shell) => {
                    return new Context({ ...shell.context, done: true })
                },
            }),
        )
        .subscribe((shell) => {
            expect(shell.context.localYouwol).toBeTruthy()
            expect(shell.context.done).toBeTruthy()
            done()
        })
})
