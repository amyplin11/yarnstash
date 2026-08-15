/**
 * Where a signed-in user belongs: the sidebar's "Home" destination, and the
 * landing spot for every post-authentication redirect — sign-in, sign-up, and
 * the password reset that ends holding a live recovery session. Kept in one
 * place so those cannot drift apart, which is how they all ended up pointing at
 * `/stash` while the nav's Home pointed somewhere else.
 */
export const APP_HOME = '/dashboard'
