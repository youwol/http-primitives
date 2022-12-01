import { Client } from './client'
import { mergeMap } from 'rxjs/operators'
import { RootRouter } from '../../lib'
import 'isomorphic-fetch'

export function resetPyYouwolDbs$(headers: { [k: string]: string } = {}) {
    return new Client(headers).admin.customCommands.doGet$({
        name: 'reset',
    })
}

export function setup$(
    {
        localOnly,
        authId,
        envId,
        pyYouwolPort,
    }: {
        localOnly?: boolean
        authId?: string
        envId?: string
        pyYouwolPort?: number
    } = {
        localOnly: true,
        authId: 'int_tests_yw-users@test-user',
        envId: 'prod',
    },
) {
    RootRouter.HostName = `http://localhost:${pyYouwolPort || 2001}`
    const headers = {
        'py-youwol-local-only': localOnly ? 'true' : 'false',
    }
    RootRouter.Headers = headers

    return Client.startWs$().pipe(
        mergeMap(() =>
            new Client().admin.environment.login$({
                body: {
                    authId: authId || 'int_tests_yw-users@test-user',
                    envId: envId || 'prod',
                },
            }),
        ),
        mergeMap(() => {
            return resetPyYouwolDbs$(headers)
        }),
    )
}
