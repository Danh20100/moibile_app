const listeners = new Set();

export function currentPath() {
  return window.location.pathname || "/";
}

export function navigate(path, { replace = false } = {}) {
  const next = path.startsWith("/") ? path : `/${path}`;
  if (replace) history.replaceState({}, "", next);
  else history.pushState({}, "", next);
  listeners.forEach((listener) => listener(next));
}

export function onRouteChange(listener) {
  listeners.add(listener);
  const onPop = () => listener(currentPath());
  window.addEventListener("popstate", onPop);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", onPop);
  };
}
