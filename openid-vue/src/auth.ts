import * as client from "openid-client";
import {
  Configuration,
  type FetchBody,
  type TokenEndpointResponse,
  type TokenEndpointResponseHelpers
} from "openid-client";
import * as oauth from "oauth4webapi";

let config : client.Configuration
let client_id : string

class LoginOptions {
  prompt?: string; kcAction?: string; extraScope?: string; acr?: string; par?: boolean
}

export async function loginWithPrompt(options : LoginOptions) {
  let nonce!: string | undefined

  let code_verifier!: string | undefined

  let code_challenge_method = 'S256'

  code_verifier = client.randomPKCECodeVerifier()
  sessionStorage.setItem("codeVerifier", code_verifier);
  let code_challenge = await client.calculatePKCECodeChallenge(code_verifier)

  let redirect_uri = new URL(window.location.href)

  // Remove all query parameters left over from a previous auth request as this application doesn't use any query parameters
  let keys = [...redirect_uri.searchParams.keys()]
  for (let key of keys) {
    redirect_uri.searchParams.delete(key)
  }

  // redirect user to as.authorization_endpoint
  let parameters: Record<string, string> = {
    redirect_uri: redirect_uri.href,
    scope: 'openid email',
    code_challenge,
    code_challenge_method
  }

  if (options.extraScope) {
    parameters.scope = parameters.scope + ' ' + options.extraScope;
  }

  if (options.prompt) {
    parameters.prompt = options.prompt;
  }

  if (options.kcAction) {
    parameters.kc_action = options.kcAction;
  }

  if (options.acr) {
    parameters.acr_values = options.acr;
  }

  /**
   * We cannot be sure the AS supports PKCE so we're going to use nonce too. Use
   * of PKCE is backwards compatible even if the AS doesn't support it which is
   * why we're using it regardless.
   */
  if (!config.serverMetadata().supportsPKCE()) {
    nonce = client.randomNonce()
    sessionStorage.setItem("nonce", nonce);
    parameters.nonce = nonce
  } else {
    sessionStorage.removeItem("nonce");
  }

  let redirectTo
  if (options.par && config.serverMetadata().pushed_authorization_request_endpoint) {
    redirectTo = await client.buildAuthorizationUrlWithPAR(config, parameters)
  } else {
    redirectTo = client.buildAuthorizationUrl(config, parameters);
  }

  console.log('redirecting to', redirectTo.href)
  window.location.href = redirectTo.href
}

export async function init(server: URL, clientId: string, onSuccess: () => void) {
  config = await client.discovery(server, clientId, undefined, undefined, {execute: [client.allowInsecureRequests]})
  client_id = clientId;

  let code_challenge_method = 'S256'
  /**
   * The following (code_verifier and potentially nonce) MUST be generated for
   * every redirect to the authorization_endpoint. You must store the
   * code_verifier and nonce in the end-user session such that it can be recovered
   * as the user gets redirected from the authorization server back to your
   * application.
   */
  let nonce!: string | undefined

  let code_verifier!: string | undefined

// Further parsing:
  const params = new URLSearchParams(window.location.search);

  if (params.has('error')) {
    initState(config, null, params.get('error'));
    onSuccess();
  } else if (!params.has('code')) {
    loginWithPrompt({prompt: 'none' });
  } else if (params.has('code')) {
    // one eternity later, the user lands back on the redirect_uri
    // Authorization Code Grant

    code_verifier = sessionStorage.getItem("codeVerifier") || undefined;
    if (code_verifier) {
      sessionStorage.removeItem("codeVerifier")
    } else {
      // code verifier not present, which indicates that the URL is stale,
      // or that a URL for example from email validation has been opened in a new tab.
      // In this case, just restart the login process with prompt none to see if the user is logged in or not.
      loginWithPrompt({prompt: 'none' });
    }

    nonce = sessionStorage.getItem("nonce") || undefined;
    if (nonce) {
      sessionStorage.removeItem("nonce")
    }

    let tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers

    {
      let currentUrl: URL = new URL(window.location.href)
      tokens = await client.authorizationCodeGrant(config, currentUrl, {
        pkceCodeVerifier: code_verifier,
        expectedNonce: nonce,
        idTokenExpected: true
      })

      console.log('Token Endpoint Response', tokens)

    }

    initState(config, tokens);

    onSuccess();

  }
}

let state: { config: Configuration, tokens: TokenEndpointResponse & TokenEndpointResponseHelpers, error?: String}

export function initState(config: Configuration, tokens: TokenEndpointResponse & TokenEndpointResponseHelpers, error?: String) {
  state = { config, tokens, error }
}

async function refreshOnDemand() {
  if (state.tokens.expiresIn() === 0) {
    await refresh();
  }
}

export async function refresh() {
  state.tokens = await client.refreshTokenGrant(state.config, state.tokens.refresh_token!, undefined);
}

export async function fetchUserInfo(): Promise<oauth.UserInfoResponse> {
  await refreshOnDemand();
  return client.fetchUserInfo(state.config, state.tokens.access_token, state.tokens.claims()!.sub);
}

export async function tokenIntrospection(): Promise<oauth.IntrospectionResponse> {
  await refreshOnDemand();
  return client.tokenIntrospection(state.config, state.tokens.access_token);
}

export async function fetchProtectedResource(url: URL, method: string, body?: FetchBody, headers?: Headers): Promise<Response> {
  await refreshOnDemand();
  return client.fetchProtectedResource(state.config, state.tokens.access_token, url, method, body, headers);
}

export function sessionState() {
  return state.tokens?.session_state
}

export function idToken() {
  return state.tokens?.id_token
}

export function checkSessionIframe() {
  return config.serverMetadata().check_session_iframe
}

export function clientId() {
  return client_id;
}

export function logout() {
  let params : Record<string, string> = {
    post_logout_redirect_uri: window.location.href,
  };
  if (state.tokens.id_token) {
    params.id_token_hint = state.tokens.id_token
  }
  window.location.href = client.buildEndSessionUrl(config, params).href;
}

export function isRegistrationSupported() {
  return config.serverMetadata().prompt_values_supported?.includes("create")
}

export function serverMetadata() {
  return config.serverMetadata()
}

