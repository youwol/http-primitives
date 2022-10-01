import { PyYouwolClient } from './py-youwol.client'
import { mergeMap } from 'rxjs/operators'
import { RootRouter } from '../../lib'
import 'isomorphic-fetch'

export function resetPyYouwolDbs$(headers: { [k: string]: string } = {}) {
    return new PyYouwolClient(headers).admin.customCommands.doGet$({
        name: 'reset',
    })
}

export function setupLocalYouwol$(
    {
        localOnly,
        email,
        pyYouwolPort,
    }: { localOnly?: boolean; email?: string; pyYouwolPort?: number } = {
        localOnly: true,
        email: 'int_tests_yw-users@test-user',
    },
) {
    RootRouter.HostName = `http://localhost:${pyYouwolPort || 2001}`
    const headers = {
        'py-youwol-local-only': localOnly ? 'true' : 'false',
    }
    RootRouter.Headers = headers

    return PyYouwolClient.startWs$().pipe(
        mergeMap(() =>
            new PyYouwolClient().admin.environment.login$({
                body: { email },
            }),
        ),
        mergeMap(() => {
            return resetPyYouwolDbs$(headers)
        }),
    )
}
