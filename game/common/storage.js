// localStorage wrapper; storage may be unavailable (private mode, blocked site data).

export function load(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

export function remove(key) {
  try {
    localStorage.removeItem(key)
  } catch {}
}
