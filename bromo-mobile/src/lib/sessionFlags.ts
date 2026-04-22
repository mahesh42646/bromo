/**
 * Process-lifetime flags (cleared on app hard-kill). Used to avoid duplicate
 * bootstrap network work (theme, etc.) across screens during one session.
 */

let themeContractNetworkFetched = false;

export function hasThemeContractFetchedThisSession(): boolean {
  return themeContractNetworkFetched;
}

export function markThemeContractFetchedThisSession(): void {
  themeContractNetworkFetched = true;
}

export function clearThemeContractSessionFlag(): void {
  themeContractNetworkFetched = false;
}

export function resetSessionBootstrapFlags(): void {
  themeContractNetworkFetched = false;
}
