/**
 * Socket Authentication Utilities
 * 
 * These utilities provide a clean way to manage socket authentication
 * without polling and ensure proper cleanup on logout.
 */

/**
 * Notify the socket context that a login has occurred
 * Call this after successfully storing a token in localStorage
 */
export const notifySocketLogin = (token?: string) => {
  window.dispatchEvent(new CustomEvent('socket:login', { 
    detail: { token } 
  }));
};

/**
 * Notify the socket context that a logout has occurred
 * Call this after removing the token from localStorage
 */
export const notifySocketLogout = () => {
  window.dispatchEvent(new CustomEvent('socket:logout'));
};

/**
 * Enhanced logout function that handles both localStorage cleanup and socket disconnection
 */
export const logout = (router?: { push: (path: string) => void }, redirectPath = '/') => {
  // Clear authentication data
  localStorage.removeItem('token');
  localStorage.removeItem('selectedWorkspaceId');
  localStorage.removeItem('lastActiveContext');
  
  // Clear all context-specific workspace selections
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('selectedWorkspaceId_')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
  
  // Notify socket to disconnect
  notifySocketLogout();
  
  // Redirect if router is provided
  if (router) {
    router.push(redirectPath);
  }
};

/**
 * Enhanced login function that handles token storage and socket connection
 */
export const login = (token: string, router?: { push: (path: string) => void }, redirectPath = '/dashboard') => {
  // Store the token
  localStorage.setItem('token', token);
  
  // Notify socket to connect
  notifySocketLogin(token);
  
  // Redirect if router is provided
  if (router) {
    router.push(redirectPath);
  }
};
