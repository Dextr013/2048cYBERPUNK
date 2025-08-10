const dictionaries = {}
let current = 'en'

function fetchWithTimeout(resource, options = {}) {
  const { timeout = 1200 } = options
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('timeout')), timeout)
    fetch(resource)
      .then((res) => { clearTimeout(id); resolve(res) })
      .catch((err) => { clearTimeout(id); reject(err) })
  })
}

export async function loadI18n(locales) {
  await Promise.all(
    locales.map(async (loc) => {
      const url = `src/i18n/${loc}.json`
      try {
        const res = await fetchWithTimeout(url, { timeout: 1200 })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        dictionaries[loc] = await res.json()
      } catch (e) {
        console.warn('i18n load failed for', loc, e)
        dictionaries[loc] = {}
      }
    })
  )
}

export function setLanguage(locale) {
  current = locale
  try { document.documentElement.setAttribute('lang', locale) } catch {}
}

export function t(key, params) {
  const dict = dictionaries[current] || {}
  const raw = dict[key] || key
  if (!params) return raw
  return raw.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ''))
}

export function populateLanguageSelect(select) {
  const options = [
    { value: 'en', label: 'English' },
    { value: 'ru', label: 'Русский' },
  ]
  select.innerHTML = ''
  for (const opt of options) {
    const o = document.createElement('option')
    o.value = opt.value
    o.textContent = opt.label
    o.selected = opt.value === current
    select.appendChild(o)
  }
}