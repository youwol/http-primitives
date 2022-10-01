import { GetAccessTokenResponse } from './interfaces'
import { CallerRequestOptions, HTTPResponse$, Router } from '../../../../lib'

export class AuthorizationRouter extends Router {
    constructor(parent: Router) {
        super(parent.headers, `${parent.basePath}/authorization`)
    }

    /**
     * Retrieve user's access token of current user (bearer token)
     *
     * @param callerOptions
     */
    getAccessToken$({
        callerOptions,
    }: {
        callerOptions?: CallerRequestOptions
    } = {}): HTTPResponse$<GetAccessTokenResponse> {
        return this.send$({
            command: 'query',
            path: `/access-token`,
            callerOptions,
        })
    }
}
