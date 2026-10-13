/**
 * Role home destinations:
 * worker -> /worker
 * supervisor -> /dashboard
 * ulb_admin -> /dashboard
 */
export function getRoleHome(role) {
  if (role === 'worker') return '/worker';
  if (role === 'supervisor' || role === 'ulb_admin') return '/dashboard';
  return '/';
}

/**
 * Checks if a given pathname is accessible for the given role.
 * - Public paths ('/', '/citizen') are accessible to everyone.
 * - '/login' is a public login screen, not a return destination.
 * - '/worker' and '/worker/*' are only accessible to 'worker'.
 * - '/dashboard' and '/dashboard/*' are only accessible to 'supervisor' and 'ulb_admin'.
 */
export function isPathAllowedForRole(pathname, role) {
  if (!pathname || pathname === '/' || pathname === '/citizen') {
    return true;
  }
  if (pathname === '/login') {
    return false;
  }
  if (pathname === '/worker' || pathname.startsWith('/worker/')) {
    return role === 'worker';
  }
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    return role === 'supervisor' || role === 'ulb_admin';
  }
  return false;
}

/**
 * Determines where to redirect after login:
 * - If from a protected returnTo path and allowed for this role: return there.
 * - Otherwise: redirect to the role's home page.
 */
export function getPostLoginRedirect(returnToPath, role) {
  const roleHome = getRoleHome(role);
  if (returnToPath && isPathAllowedForRole(returnToPath, role) && returnToPath !== '/' && returnToPath !== '/login') {
    return returnToPath;
  }
  return roleHome;
}
