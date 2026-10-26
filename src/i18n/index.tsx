import * as React from 'react'
import ru from './ru.json'
import en from './en.json'
import type insightsRu from './insights.ru.json'
import ruUiText from './ui-text.ru.json'
import enUiText from './ui-text.en.json'

export type Language = 'ru' | 'en'

type TranslationPaths<T> = {
  [Key in keyof T & string]: T[Key] extends string
    ? Key
    : T[Key] extends Record<string, unknown>
      ? `${Key}.${TranslationPaths<T[Key]>}`
      : never
}[keyof T & string]

export type TranslationKey = TranslationPaths<typeof ru> | `insights.${TranslationPaths<typeof insightsRu>}`
export type TranslationNamespace = 'insights'

export const LANG_STORAGE_KEY = 'altera_language'

const translations: Record<Language, typeof ru> = {
  ru,
  en,
}

function collectEnglishText(source: unknown, target: unknown, result: Map<string, string> = new Map()): Map<string, string> {
  if (!source || !target || typeof source !== 'object' || typeof target !== 'object') return result
  for (const [key, sourceValue] of Object.entries(source)) {
    const targetValue = (target as Record<string, unknown>)[key]
    if (typeof sourceValue === 'string' && typeof targetValue === 'string' && !result.has(sourceValue)) {
      result.set(sourceValue, targetValue)
    } else if (sourceValue && typeof sourceValue === 'object') {
      collectEnglishText(sourceValue, targetValue, result)
    }
  }
  return result
}

const existingUiTranslations = collectEnglishText(en, ru)
const explicitUiTranslations = ruUiText as Record<string, string>
const explicitEnglishUiTranslations = enUiText as Record<string, string>
function translateUiText(source: string, language: Language): string {
  if (language === 'en') return explicitEnglishUiTranslations[source] ?? source
  return explicitUiTranslations[source] ?? existingUiTranslations.get(source) ?? source
}

interface I18nContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
  tx: (source: string) => string
  loadNamespace: (namespace: TranslationNamespace) => Promise<void>
}

const I18nContext = React.createContext<I18nContextType | null>(null)
const namespacePromises = new Map<string, Promise<Record<string, unknown>>>()

function loadNamespaceData(namespace: TranslationNamespace, language: Language): Promise<Record<string, unknown>> {
  const cacheKey = `${namespace}:${language}`
  const existing = namespacePromises.get(cacheKey)
  if (existing) return existing

  const promise = namespace === 'insights'
    ? (language === 'ru' ? import('./insights.ru.json') : import('./insights.en.json'))
      .then(dictionary => ({ insights: dictionary.default as unknown as Record<string, unknown> }))
    : Promise.resolve({})
  namespacePromises.set(cacheKey, promise)
  promise.catch(() => namespacePromises.delete(cacheKey))
  return promise
}

function getNestedValue(obj: unknown, path: TranslationKey): string | undefined {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part]
    } else {
      return undefined
    }
  }
  return typeof current === 'string' ? current : undefined
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = React.useState<Language>(() => {
    try {
      const saved = localStorage.getItem(LANG_STORAGE_KEY)
      if (saved === 'ru' || saved === 'en') return saved
    } catch {
      // fallback
    }
    return 'ru'
  })
  const [extraTranslations, setExtraTranslations] = React.useState<Partial<Record<Language, Record<string, unknown>>>>({})

  const setLanguage = React.useCallback((lang: Language) => {
    setLanguageState(lang)
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang)
      document.documentElement.lang = lang
    } catch {
      // ignore
    }
  }, [])

  const loadNamespace = React.useCallback(async (namespace: TranslationNamespace) => {
    const dictionary = await loadNamespaceData(namespace, language)
    setExtraTranslations(previous => {
      const current = previous[language] ?? {}
      if (current[namespace]) return previous
      return { ...previous, [language]: { ...current, ...dictionary } }
    })
  }, [language])

  React.useEffect(() => {
    try {
      document.documentElement.lang = language
    } catch {
      // ignore
    }
  }, [language])

  const t = React.useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      // 1. Look up in current language
      const currentDictionary = { ...translations[language], ...(extraTranslations[language] ?? {}) }
      let text = getNestedValue(currentDictionary, key)
      // 2. Fallback to 'ru' if missing in 'en'
      if (!text && language !== 'ru') {
        const fallbackDictionary = { ...translations.ru, ...(extraTranslations.ru ?? {}) }
        text = getNestedValue(fallbackDictionary, key)
      }
      // 3. Fallback to key itself
      if (!text) {
        return key
      }
      // 4. Interpolate {{variable}}
      if (params) {
        Object.entries(params).forEach(([pKey, pVal]) => {
          text = text!.replace(new RegExp(`{{\\s*${pKey}\\s*}}`, 'g'), String(pVal))
        })
      }
      return text
    },
    [language, extraTranslations]
  )

  const tx = React.useCallback((source: string) => translateUiText(source, language), [language])

  const value = React.useMemo(
    () => ({
      language,
      setLanguage,
      t,
      tx,
      loadNamespace,
    }),
    [language, setLanguage, t, tx, loadNamespace]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

/** Hook modeled identically to react-i18next for easy usage */
export function useTranslation(namespace?: TranslationNamespace) {
  const ctx = React.useContext(I18nContext)
  const loadNamespace = ctx?.loadNamespace
  const requestKey = namespace && ctx ? `${namespace}:${ctx.language}` : ''
  const [namespaceState, setNamespaceState] = React.useState({ key: '', ready: true })

  React.useEffect(() => {
    if (!namespace || !loadNamespace) return
    let active = true
    loadNamespace(namespace)
      .then(() => { if (active) setNamespaceState({ key: requestKey, ready: true }) })
      .catch(() => { if (active) setNamespaceState({ key: requestKey, ready: true }) })
    return () => { active = false }
  }, [namespace, requestKey, loadNamespace])

  const translationReady = !namespace || !ctx || (namespaceState.key === requestKey && namespaceState.ready)
  if (!ctx) {
    // Graceful fallback outside provider
    const t = (key: TranslationKey, params?: Record<string, string | number>) => {
      let text = getNestedValue(translations.ru, key) || key
      if (params) {
        Object.entries(params).forEach(([pKey, pVal]) => {
          text = text.replace(new RegExp(`{{\\s*${pKey}\\s*}}`, 'g'), String(pVal))
        })
      }
      return text
    }
    return {
      t,
      tx: (source: string) => translateUiText(source, 'ru'),
      i18n: {
        language: 'ru' as Language,
        changeLanguage: () => {},
      },
      translationReady,
    }
  }

  return {
    t: ctx.t,
    tx: ctx.tx,
    i18n: {
      language: ctx.language,
      changeLanguage: ctx.setLanguage,
    },
    translationReady,
  }
}

export default {
  useTranslation,
  I18nProvider,
}
