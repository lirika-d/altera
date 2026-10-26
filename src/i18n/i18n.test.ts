import * as ts from 'typescript'
import { describe, expect, it } from 'vitest'
import ru from './ru.json'
import en from './en.json'
import insightsRu from './insights.ru.json'
import insightsEn from './insights.en.json'
import ruUiText from './ui-text.ru.json'
import enUiText from './ui-text.en.json'

const sourceFiles = import.meta.glob('../**/*.{ts,tsx}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

function flatten(value: unknown, prefix = '', result: Record<string, string> = {}): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof child === 'string') result[path] = child
    else flatten(child, path, result)
  }
  return result
}

function getPath(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, part) => {
    return current && typeof current === 'object' ? (current as Record<string, unknown>)[part] : undefined
  }, value)
}

function placeholderNames(value: string): string[] {
  return [...value.matchAll(/{{\s*([\w.]+)\s*}}/g)].map(match => match[1]).sort()
}

describe('localization dictionaries and source references', () => {
  it('keeps Russian and English dictionaries structurally in parity, including lazy insights', () => {
    for (const [name, left, right] of [
      ['main', ru, en],
      ['insights', insightsRu, insightsEn],
    ] as const) {
      const leftLeaves = flatten(left)
      const rightLeaves = flatten(right)
      expect(Object.keys(leftLeaves).sort(), `${name}: Russian keys`).toEqual(Object.keys(rightLeaves).sort())
      for (const key of Object.keys(leftLeaves)) {
        expect(leftLeaves[key].trim(), `${name}.${key}: Russian value`).not.toBe('')
        expect(rightLeaves[key].trim(), `${name}.${key}: English value`).not.toBe('')
        expect(placeholderNames(leftLeaves[key]), `${name}.${key}: placeholder parity`).toEqual(placeholderNames(rightLeaves[key]))
      }
    }
  })

  it('keeps explicit static-UI translations complete and English overrides paired', () => {
    const enKeys = new Set([...Object.values(flatten(en)), ...Object.values(flatten(insightsEn))])
    const ruKeys = new Set(Object.keys(ruUiText))
    for (const [key, value] of Object.entries(ruUiText)) {
      expect(value.trim(), `ui-text.ru: ${key}`).not.toBe('')
    }
    for (const [key, value] of Object.entries(enUiText)) {
      expect(ruKeys.has(key), `ui-text.en has no Russian entry for ${key}`).toBe(true)
      expect(value.trim(), `ui-text.en: ${key}`).not.toBe('')
    }

    const unresolved: string[] = []
    const nonEnglishOverrides: string[] = []
    const rawVisibleLiterals: string[] = []
    const untranslatedConfiguredCopy: string[] = []
    const nonTranslatableCodeLabels = new Set([
      'TypeScript', 'JavaScript', 'Python', 'HTML', 'CSS', 'JSON', 'SQL', 'Rust', 'Go', 'YAML',
      'Markdown', 'C#', 'C++', 'Java', 'PHP', 'Ruby', 'Swift', 'Kotlin',
    ])
    const visibleAttributes = new Set([
      'actionLabel', 'aria-description', 'aria-label', 'data-placeholder', 'description', 'label', 'placeholder', 'title',
    ])
    const knownNonTranslatableUiLiterals = new Set([
      'ALTERA', 'Alex Morgan', 'Алекс Морган', 'Ctrl+B', 'Ctrl+I', 'Ctrl+S', 'EN', 'ESC', 'H1', 'H2', 'ID', 'RU', 'esc', '&gt;', '&rdquo;',
    ])
    for (const [file, text] of Object.entries(sourceFiles)) {
      if (/\.(?:test|spec)\.(?:ts|tsx)$/.test(file) || file.endsWith('.d.ts')) continue
      const scriptKind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
      const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind)
      const visit = (node: ts.Node) => {
        if (ts.isJsxText(node)) {
          const literal = node.text.replace(/\s+/g, ' ').trim()
          if (/[A-Za-zА-Яа-яЁё]{2}/.test(literal) && !knownNonTranslatableUiLiterals.has(literal)) {
            rawVisibleLiterals.push(`${file}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1} JSX ${JSON.stringify(literal)}`)
          }
        }
        if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)
          && visibleAttributes.has(node.name.getText(source))) {
          const literal = node.initializer.text
          const isExample = (node.name.getText(source) === 'placeholder' && (/^https?:\/\//.test(literal) || /^ALT-\d/.test(literal)))
            || (node.name.getText(source) === 'title' && /^H[1-6]$/.test(literal))
          if (!isExample && !knownNonTranslatableUiLiterals.has(literal)) {
            rawVisibleLiterals.push(`${file}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1} ${node.name.getText(source)} ${JSON.stringify(literal)}`)
          }
        }
        if (ts.isPropertyAssignment(node) && ts.isStringLiteral(node.initializer)
          && ['label', 'title', 'description'].includes(node.name.getText(source))
          && (file.startsWith('../components/') || file.startsWith('../pages/'))) {
          const literal = node.initializer.text
          if (!knownNonTranslatableUiLiterals.has(literal)
            && !nonTranslatableCodeLabels.has(literal)
            && !literal.startsWith('--')
            && !enKeys.has(literal)
            && !Object.hasOwn(ruUiText, literal)) {
            untranslatedConfiguredCopy.push(
              file + ':' + (source.getLineAndCharacterOfPosition(node.getStart()).line + 1)
                + ' ' + node.name.getText(source) + ' ' + JSON.stringify(literal)
            )
          }
        }
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)
          && (node.expression.text === 't' || node.expression.text === 'tx')
          && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
          const key = node.arguments[0].text
          if (node.expression.text === 'tx') {
            const hasRussian = ruKeys.has(key) || enKeys.has(key)
            if (!hasRussian) unresolved.push(`${file}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1} tx(${JSON.stringify(key)})`)
            if (/[А-Яа-яЁё]/.test(key) && !Object.hasOwn(enUiText, key)) nonEnglishOverrides.push(key)
          } else {
            const russian = key.startsWith('insights.') ? getPath({ insights: insightsRu }, key) : getPath(ru, key)
            const english = key.startsWith('insights.') ? getPath({ insights: insightsEn }, key) : getPath(en, key)
            if (typeof russian !== 'string' || typeof english !== 'string') {
              unresolved.push(`${file}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1} t(${JSON.stringify(key)})`)
            }
          }
        }
        ts.forEachChild(node, visit)
      }
      visit(source)
    }
    expect(unresolved).toEqual([])
    expect(nonEnglishOverrides).toEqual([])
    expect(rawVisibleLiterals).toEqual([])
    expect(untranslatedConfiguredCopy).toEqual([])
  })
})
