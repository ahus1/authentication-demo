<script setup lang="ts">
import * as clientWithState from '../auth'
import * as jose from 'jose'
const res = clientWithState.sessionState() ? await clientWithState.fetchUserInfo() : null
const idToken = clientWithState.idToken()
function accountConsole() {
  return 'http://localhost:8080/realms/test/account?referrer=openid-vue&referrer_uri=' + encodeURIComponent(window.location.href)
}
</script>

<template>
  <div v-if="res">
    <details>
      <summary>User Info</summary>
<pre>
{{ JSON.stringify(res, null, 2) }}
</pre>
    </details>
  <div v-if="idToken">
    <details>
      <summary>ID Token</summary>
<pre>
{{ jose.decodeJwt(idToken) }}
</pre>
    </details>
  </div>

  <br>
  <a @click="clientWithState.logout()">log out</a>
    or <a @click="clientWithState.loginWithPrompt('login', undefined)">re-authenticate</a>
  </div>

  <div v-if="res == null">
  Not logged in - <a @click="clientWithState.loginWithPrompt({ prompt: 'login'})">log in</a> or <a @click="clientWithState.loginWithPrompt({ prompt: 'login', par: true })">log in with PAR</a>
    <span v-if="clientWithState.isRegistrationSupported()">
    or <a @click="clientWithState.loginWithPrompt({ prompt: 'create'})">register</a>
    </span>
  </div>

  <div v-if="res && !res.email_verified">
    <!-- Not implemented yet: VERIFY_EMAIL
     https://github.com/keycloak/keycloak/issues/25154 -->
    <!--
    <a @click="clientWithState.loginWithPrompt(undefined, 'VERIFY_EMAIL')">Verify Email</a> -->
  </div>

  <div v-if="res">
    <!-- adding street and country for address plus others -->
    <a @click="clientWithState.loginWithPrompt({ extraScope: 'address'})">Extra scope address</a> or
    <a @click="clientWithState.loginWithPrompt( { extraScope: 'acr', acr: '2'})">ACR 2</a> <br>
    <a :href="accountConsole()" >Account console</a><br>
    <!-- works: UPDATE_PASSWORD, delete_account (if enabled and user has the permissions), -->
    <a @click="clientWithState.loginWithPrompt({ kcAction: 'UPDATE_PROFILE'})">Update profile</a> or
    <a @click="clientWithState.loginWithPrompt({ kcAction: 'UPDATE_PASSWORD'})">Update password</a> or
    <a @click="clientWithState.loginWithPrompt({ kcAction: 'webauthn-register-passwordless'})">Webauthn Register Passwordless</a> (if enabled) or
    <a @click="clientWithState.loginWithPrompt({ kcAction: 'UPDATE_EMAIL'})">Update email</a> (if enabled)
  </div>

</template>
