const LAB_UNITS =
  '(?:mEq\\/L|mg\\/dL|mg\\/dl|g\\/dL|g\\/dl|U\\/L|mm\\s*Hg|mm\\s*(?:H2O|H20|Hp|HP)|mm\\s*\\/\\s*h|mmol\\/L|sec(?:\\s*\\(INR\\s*=\\s*[\\d.\\s]+\\))?|%|\\/mm\\s*3|\\/mm³|million\\s*\\/mm\\s*3|million\\s*\\/mm³|\\/hpf|\\/lpf|\\/min|ng\\/mL|ng\\/ml|µg\\/dL|µg\\/dl|μg\\/dL|µU\\/ml|μU\\/ml|µU\\/mL|pg\\/ml|pmol\\/L|µm³|μm³|µm\\s*3|mg\\/24\\s*h)'

const VALUE_FRAGMENT_SOURCE = `(?:<?[\\d.,]+\\s*${LAB_UNITS}(?:\\s*\\(N\\s*=\\s*[^)]+\\))?(?:\\s+with a normal differential)?|\\d+(?:\\.\\d+)?\\s*million\\s*\\/mm(?:\\s*3|³)|\\d+\\s*-\\s*\\d+\\s*\\/(?:hpf|lpf)|\\d+\\s*\\/(?:hpf|lpf)|[1-4]\\s*\\+|wbc\\s*[1-4]\\s*\\+|[5-8]\\.\\d{1,3}|1\\.0\\d{2}|negative|positive|trace|none|nonreactive|reactive|few granular|coarse granular)`
const VALUE_FRAGMENT = new RegExp(VALUE_FRAGMENT_SOURCE, 'i')
const VALUE_START = new RegExp(`^(${VALUE_FRAGMENT_SOURCE})`, 'i')

const LAB_SHOW =
  /(?:(?:fasting\s+)?(?:serum|laboratory|blood|urine|plasma|csf)\s+studies\s+show|(?:results of\s+(?:serum|laboratory|blood)\s+studies(?:\s+show)?|laboratory findings(?:\s+show)?)|(?:arterial\s+blood\s+gas[\s\S]{0,90})\s+shows?|urinalysis\s+shows?|hemoglobin electrophoresis\s+shows?|(?:cerebrospinal fluid|csf|synovial fluid|pleural fluid|peritoneal fluid)(?:\s+analysis)?\s+shows?)\s*:/i

const LAB_HEADER_LINE =
  /^(serum|urine|plasma|csf|cerebrospinal fluid|complete blood count|pleural fluid|synovial fluid|peritoneal fluid|urinalysis|arterial blood gas analysis(?: on room air)?(?: shows?:?)?|hemoglobin electrophoresis(?: shows?:?)?|on admission|now)$/i

export const LAB_STOP_LINE =
  /^(which of the following|intravenous (?:infusion|administration)|an x-ray|a ct|an ecg|echocardiography|ultrasonography|venous duplex|microscopic examination|abdominal ultrasonography|examination shows|the remainder|the patient asks|supplementation with|blood cultures|a gram stain of|a blood smear|toxicology screening|0\s*[A-JQ]\)|[A-J]\))/i

const KNOWN_NAMES = [
  'Fractional excretion of Na+',
  'Fingerstick blood glucose',
  'Partial thromboplastin time',
  'Prothrombin time',
  'Mean corpuscular volume',
  'Erythrocyte sedimentation rate',
  'Parathyroid hormone-related protein',
  'Parathyroid hormone, intact',
  'Transferrin saturation',
  'Hemoglobin electrophoresis',
  'Lactate dehydrogenase',
  'Alkaline phosphatase',
  'Cholesterol, total',
  'HDL-cholesterol',
  'LDL-cholesterol',
  'HDL cholesterol',
  'LDL cholesterol',
  'Triglycerides',
  'Total cholesterol',
  'Bilirubin (total)',
  'Bilirubin, total',
  'Total bilirubin',
  'Serum creatinine',
  'Serum amylase',
  'Serum glucose',
  'Leukocyte count',
  'Platelet count',
  'Reticulocyte count',
  'Red cell distribution width',
  'CD4+ T-lymphocyte count',
  'Thyroid-stimulating hormone',
  'Thyroxine (T4)',
  'Free T4',
  'γ-Glutamyltransferase',
  'y-Glutamyltransferase',
  'Serum creatine kinase',
  'Segmented neutrophils',
  'RBC casts',
  'Pigmented granular casts',
  'Specific gravity',
  'Urea nitrogen',
  'Blood alcohol',
  'Creatine kinase',
  'Urine protein',
  'Urine pH',
  'O2 saturation',
  'Opening pressure',
  'Erythrocyte count',
  'Hemoglobin A1c',
  'Hemoglobin A2',
  'Hemoglobin F',
  'Hemoglobin S',
  'Hemoglobin C',
  'Hemoglobin A',
  'Gram stain',
  'Organisms',
  'Nitrites',
  'Nitrite',
  'Glucose, fasting',
  'Total protein',
  'Uric acid',
  'Hemoglobin',
  'Hematocrit',
  'Lymphocytes',
  'Monocytes',
  'Eosinophils',
  'Basophils',
  'Creatinine',
  'Albumin',
  'Globulin',
  'Phosphorus',
  'Total iron-binding capacity',
  'Iron-binding capacity',
  'TIBC',
  'Postvoid residual volume',
  'Leukocyte esterase',
  'Ferritin',
  'Amylase',
  'Lipase',
  'Neutrophils',
  'Thyroxine',
  'Cholesterol',
  'IgA',
  'IgG',
  'IgM',
  'GGT',
  'RDW',
  'TSH',
  'Glucose',
  'Protein',
  'Ketones',
  'Direct',
  'Total',
  'Bands',
  'Casts',
  'HBsAg',
  'Anti-HBs',
  'Anti-HBc',
  'Anti-HCV',
  'ALT',
  'AST',
  'Pco2',
  'Po2',
  'RBC',
  'WBC',
  'HCO3-',
  'Na+',
  'K+',
  'Cl-',
  'Ca2+',
  'pH',
  'Iron',
  'Blood'
]

const NAME_SPLIT = new RegExp(`^(${KNOWN_NAMES.map(escapeReg).join('|')})(?=\\s|$|\\d)`, 'i')

function escapeReg(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function normalizeLabToken(line: string): string {
  return line
    .replace(/\u00a0/g, ' ')
    .replace(/\bRSC\b/g, 'RBC')
    .replace(/\bNa\*/gi, 'Na+')
    .replace(/\bK[+|•·*]I?\b/g, 'K+')
    .replace(/\bK•I\b/g, 'K+')
    .replace(/\bcI\s*-/gi, 'Cl-')
    .replace(/\bCI\s*-/g, 'Cl-')
    .replace(/\bc\s*1\s*-/gi, 'Cl-')
    .replace(/\bCl\s*[·•]\s*/g, 'Cl-')
    .replace(/\bCl\s+-/g, 'Cl-')
    .replace(/\bHCO\s*[,\s]*-+(?=\s|$)/gi, 'HCO3-')
    .replace(/\bHCO\s*-?\s*3\s*-?/gi, 'HCO3-')
    .replace(/\bHco\s*-/gi, 'HCO3-')
    .replace(/\bHC0?3-/gi, 'HCO3-')
    .replace(/\bPco\s*2/gi, 'Pco2')
    .replace(/\bPo\s*2/gi, 'Po2')
    .replace(/\b0\s*2 saturation/gi, 'O2 saturation')
    .replace(/\bCa\s*2\+/gi, 'Ca2+')
    .replace(/\bHemoglobin A\s*1c\b/gi, 'Hemoglobin A1c')
    .replace(/\bHemoglobin A\s*2\b/gi, 'Hemoglobin A2')
    .replace(/\bThyroxine\s*\(\s*T\s*4\s*\)/gi, 'Thyroxine (T4)')
    .replace(/\bDay(\d+)\b/gi, 'Day $1')
    .replace(/\blg([AGM])\b/g, 'Ig$1')
    .replace(/\by-Glutamyltransferase/gi, 'γ-Glutamyltransferase')
    .replace(/\bF102\b/gi, 'FiO2')
    .replace(/\bcm\s*Hp\b/gi, 'cm H2O')
    .replace(/\bmm\s*H[pP]\b/g, 'mm H2O')
    .replace(/\bmm\s*H20\b/g, 'mm H2O')
    .replace(/\bmEa\/LI?\b/gi, 'mEq/L')
    .replace(/(\d),(\s*(?:mEq|mg|g|U|mm|ng|µg|μg))/gi, '$1$2')
    .replace(/\|/g, ' ')
    .replace(/\bHDL\s*-?\s*cholesterol\b/gi, 'HDL-cholesterol')
    .replace(/\bLDL\s*-?\s*cholesterol\b/gi, 'LDL-cholesterol')
    .replace(/\bCholesterol,\s*total\b/gi, 'Cholesterol, total')
    .replace(/\/mm\s*3\b/gi, '/mm³')
    .replace(/\/mm3\b/gi, '/mm³')
    .replace(/(\d(?:\.\d+)?)\s*million\s*\/mm(?:\s*3|³)?/gi, '$1 million/mm³')
    .replace(/µm\s*3\b/g, 'µm³')
    .replace(/μm\s*3\b/g, 'µm³')
    .replace(/N=0o\/o/gi, 'N=0%')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isLabValueLine(line: string): boolean {
  const t = normalizeLabToken(line)
  if (!t || LAB_STOP_LINE.test(t) || /which of the following/i.test(t)) return false
  if (new RegExp(`^${VALUE_FRAGMENT_SOURCE}$`, 'i').test(t)) return true
  if (/^\d+\s*sec(?:\s*\(INR\s*=\s*[\d.]+\))?$/i.test(t)) return true
  if (/^\d+\/(?:hpf|lpf)$/i.test(t)) return true
  if (/^(?:few|coarse)\s+granular$/i.test(t)) return true
  if (/^[\d.,]+\s*million\/mm³$/i.test(t)) return true
  if (/^340 mm H2O$|^[\d.,]+\s*mm H2O$/i.test(t)) return true
  return false
}

export function isLabSection(line: string): boolean {
  return LAB_HEADER_LINE.test(normalizeLabToken(line).replace(/:$/, ''))
}

export function isLabNameLine(line: string): boolean {
  const t = normalizeLabToken(line)
  if (!t || isLabValueLine(t) || isLabSection(t) || LAB_STOP_LINE.test(t)) return false
  if (/^[O0Q]$/i.test(t) || /[?]/.test(t) || t.length > 56) return false
  const known = t.match(NAME_SPLIT)
  if (known && known[0].length === t.length) return true
  if (/\b(is|are|of|the|and|with|for|to)\b/i.test(t)) return false
  if (
    /count|time|rate|saturation|gravity|nitrogen|kinase|phosphatase|bilirubin|cholesterol|triglyceride|globulin|albumin|creatinine|hemoglobin|hematocrit|neutrophils|lymphocytes|platelet|ferritin|amylase|lipase|cast|excretion|nitrite|opening pressure|erythrocyte|thyroxine|thyroid|glutamyl|distribution width/i.test(
      t
    ) &&
    t.split(' ').length <= 6
  ) {
    return true
  }
  return /^(Na\+|K\+|Cl-|HCO3-|Ca2\+|pH|RBC|WBC|ALT|AST|Po2|Pco2|Bands|Ketones|Direct|Total|Iron|Blood)$/i.test(t)
}

function canonicalLabName(token: string): string {
  const compact = token.replace(/[\s-]+/g, '').toLowerCase()
  for (const name of KNOWN_NAMES) {
    if (name.replace(/[\s-]+/g, '').toLowerCase() === compact) return name
  }
  return token
}

export function explodeLabLine(line: string): string[] {
  return tokenizeLabStream(line)
}

function tokenizeLabStream(text: string): string[] {
  let rest = normalizeLabToken(text)
  const cut = rest.search(/which of the following|intravenous infusion of which/i)
  if (cut >= 0) rest = rest.slice(0, cut).trim()
  if (!rest || /^[O0Q]$/i.test(rest)) return []

  const out: string[] = []
  let guard = 0
  while (rest && guard++ < 80) {
    rest = rest.replace(/^[,;:/]+/, '').replace(/\s*\((?:mg\/dl|g\/dl|\/hpf)\s*\)\s*/gi, ' ').trim()
    if (!rest) break
    if (LAB_STOP_LINE.test(rest)) break
    const leadingZero = rest.match(/^0+(?=\s|$)/)
    if (leadingZero) {
      rest = rest.slice(leadingZero[0].length).trim()
      continue
    }
    if (isLabSection(rest)) {
      out.push(rest.replace(/:$/, ''))
      break
    }

    const known = rest.match(NAME_SPLIT)
    if (known) {
      const after = rest.slice(known[0].length).trim()
      if (
        !after ||
        NAME_SPLIT.test(after) ||
        VALUE_START.test(after) ||
        isLabSection(after) ||
        /^\d/.test(after) ||
        isLabNameLine(after.split(/\s+/).slice(0, 4).join(' '))
      ) {
        out.push(canonicalLabName(normalizeLabToken(known[0])))
        rest = after
        continue
      }
    }

    const header = rest.match(/^(serum|urine|plasma|csf|complete blood count)\b/i)
    if (header) {
      const after = rest.slice(header[0].length).trim()
      if (!after || isLabSection(after) || VALUE_START.test(after)) {
        out.push(normalizeLabToken(header[0]))
        rest = after
        continue
      }
    }

    const value = rest.match(VALUE_START)
    if (value && isLabValueLine(value[1] ?? value[0])) {
      out.push(normalizeLabToken(value[1] ?? value[0]))
      rest = rest.slice((value[1] ?? value[0]).length).trim()
      continue
    }

    const bareNumber = rest.match(/^\d+(?:\.\d+)?(?=\s|$)/)
    if (bareNumber) {
      out.push(bareNumber[0])
      rest = rest.slice(bareNumber[0].length).trim()
      continue
    }

    const words = rest.split(/\s+/)
    let took = false
    for (let count = Math.min(4, words.length); count >= 1; count--) {
      const phrase = words.slice(0, count).join(' ').replace(/\s*\((?:mg\/dl|g\/dl|\/hpf)\s*\)\s*$/i, '')
      if (!isLabNameLine(phrase)) continue
      out.push(canonicalLabName(normalizeLabToken(phrase)))
      rest = words.slice(count).join(' ')
      took = true
      break
    }
    if (took) continue
    rest = words.slice(1).join(' ')
  }
  return out.filter(Boolean)
}

function findLabBlockStart(text: string): number {
  const specific = text.search(LAB_SHOW)
  if (specific >= 0) return specific
  const generic = text.matchAll(/([^\n]{2,90}shows?:)\s*(?:\n|$)/gi)
  for (const match of generic) {
    const index = match.index ?? 0
    if (/examination shows|x-ray of|ultrasonography|gram stain|culture/i.test(match[1]) && !/urinalysis|laboratory|serum|blood gas/i.test(match[1])) {
      continue
    }
    const after = text.slice(index + match[0].length)
    const next = after.split('\n').map((line) => line.trim()).find(Boolean)
    if (next && (isLabValueLine(next) || isLabNameLine(next) || isLabSection(next))) return index
  }
  return -1
}

function isColumnHeader(token: string): boolean {
  return /^(on admission|now|day\s*\d+)$/i.test(normalizeLabToken(token))
}

function columnHeaderLabel(token: string): string {
  const normalized = normalizeLabToken(token)
  if (/^now$/i.test(normalized)) return 'Now'
  if (/on admission/i.test(normalized)) return 'On Admission'
  const day = normalized.match(/day\s*(\d+)/i)
  return day ? `Day ${day[1]}` : normalized
}

function pairTwoColumn(tokens: string[]): string[] | null {
  const headers: number[] = []
  tokens.forEach((token, index) => {
    if (isColumnHeader(token)) headers.push(index)
  })
  if (headers.length < 2) return null
  const admission = headers[0]
  const now = headers[1]
  const names = tokens.slice(0, admission)
  const first = tokens.slice(admission + 1, now).filter((token) => !isColumnHeader(token))
  const second = tokens.slice(now + 1).filter((token) => !isColumnHeader(token))
  if (first.length < 2 || second.length < 2) return null
  const named = names.filter((name) => !isLabSection(name) && !/shows?:?$/i.test(name))
  if (named.length < 2) return null

  const out = [`\t${columnHeaderLabel(tokens[admission])}\t${columnHeaderLabel(tokens[now])}`]
  let a = 0
  let b = 0
  for (const name of names) {
    if (isLabSection(name) || /shows?:?$/i.test(name)) {
      out.push(name.replace(/:$/, ''))
      continue
    }
    const left = first[a++] ?? ''
    const right = second[b++] ?? ''
    out.push(`${name}\t${left}\t${right}`.replace(/\t+$/, ''))
  }
  return out
}

function labelBareAbg(tokens: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    const first = tokens[i]
    const second = tokens[i + 1]
    const third = tokens[i + 2]
    if (
      isLabValueLine(first) &&
      /^[6-8]\.\d+/.test(first) &&
      second &&
      /mm Hg/i.test(second) &&
      third &&
      /mm Hg/i.test(third) &&
      !/^pH$/i.test(out[out.length - 1] ?? '')
    ) {
      out.push('pH', first, 'Pco2', second, 'Po2', third)
      i += 2
      continue
    }
    out.push(first)
  }
  return out
}

function valueUnitFamily(value: string): string | null {
  if (/%/.test(value) && !/mm/.test(value)) return 'percent'
  if (/µm³|um\s*3|μm³|fL\b/i.test(value)) return 'volume'
  if (/ng\/m[lL]/i.test(value)) return 'ferritin'
  if (/pg\/(?:m[lL]|d[lL])/i.test(value)) return 'pg'
  if (/µg\/d[lL]|mcg\/d[lL]|μg\/d[lL]/i.test(value)) return 'iron'
  if (/mm\s*\/\s*h/i.test(value)) return 'esr'
  if (/mEq\/L|mmol\/L/i.test(value)) return 'electrolyte'
  if (/mg\/d[lL]|mg\/24\s*h/i.test(value)) return 'chem'
  if (/g\/d[lL]/i.test(value)) return 'protein'
  if (/U\/L/i.test(value)) return 'enzyme'
  if (/\/mm³|\/mm3|million\/mm/i.test(value)) return 'count'
  if (/µU\/m[lL]|μU\/m[lL]/i.test(value)) return 'tsh'
  if (/mm\s*H2O|cm\s*H2O/i.test(value)) return 'pressure'
  if (/mm Hg/i.test(value)) return 'gas'
  if (/^1\.\d{3}/.test(value)) return 'sg'
  if (/^(?:positive|negative|nonreactive|reactive|trace|none)$/i.test(value)) return null
  return null
}

function nameUnitFamily(name: string): string | null {
  if (/mean corpuscular volume|^mcv$/i.test(name)) return 'volume'
  if (
    /hematocrit|hemoglobin\s*a1c|hba1c|hemoglobin\s*a2|hemoglobin\s*[afsc]|reticulocyte|transferrin saturation|fractional excretion/i.test(
      name
    )
  ) {
    return 'percent'
  }
  if (/hemoglobin(?! electrophoresis)/i.test(name)) return 'protein'
  if (/ferritin/i.test(name)) return 'ferritin'
  if (/iron-binding|^tibc$|^(?:serum )?iron$/i.test(name)) return 'iron'
  if (/sedimentation/i.test(name)) return 'esr'
  if (/residual volume/i.test(name)) return 'volume'
  if (/opening pressure/i.test(name)) return 'pressure'
  if (/thyroid-stimulating|^tsh$/i.test(name)) return 'tsh'
  if (/leukocyte count|erythrocyte count|platelet count|cd4/i.test(name)) return 'count'
  if (/urea nitrogen|creatinine|bilirubin|cholesterol|triglyceride|hdl-cholesterol|ldl-cholesterol|calcium|urine protein|^(?:serum )?glucose$/i.test(name)) {
    return 'chem'
  }
  if (/^(?:na\+|k\+|cl-|hco3-|bicarbonate)$/i.test(name)) return 'electrolyte'
  if (/specific gravity/i.test(name)) return 'sg'
  if (/albumin|total protein/i.test(name)) return 'protein'
  if (/alkaline phosphatase|\bast\b|\balt\b/i.test(name)) return 'enzyme'
  if (/hbsag|anti-hbs|anti-hbc|anti-hcv/i.test(name)) return 'sero'
  return null
}

function compatibleLabPair(name: string, value: string): boolean {
  if (/^pH$/i.test(name) && /^1\.0/.test(value)) return false
  if (/specific gravity/i.test(name) && /^[6-8]\.\d/.test(value)) return false
  const nameFamily = nameUnitFamily(name)
  const valueFamily = valueUnitFamily(value)
  if (nameFamily && valueFamily && nameFamily !== valueFamily) return false
  return true
}

function pairLabTokens(tokens: string[]): string[] {
  const columns = pairTwoColumn(tokens)
  if (columns) return columns

  type Item = { type: 'name' | 'header'; text: string }
  const pending: Item[] = []
  const out: string[] = []
  const pair = (name: string, value: string) => `${name}\t${value}`

  const emitWithValues = (values: string[]) => {
    let index = 0
    for (const item of pending) {
      if (item.type === 'header') {
        out.push(item.text)
        continue
      }
      const match = values.findIndex((value, valueIndex) => valueIndex >= index && compatibleLabPair(item.text, value))
      if (match >= 0) {
        values.slice(index, match).forEach(() => undefined)
        out.push(pair(item.text, values[match]))
        index = match + 1
      } else {
        out.push(item.text)
      }
    }
    pending.length = 0
  }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    const next = tokens[i + 1] ?? ''
    if (
      isLabSection(token) ||
      /shows?:?$/i.test(token) ||
      (/^protein$/i.test(token) && /^(total|albumin)$/i.test(next))
    ) {
      pending.push({ type: 'header', text: token.replace(/:$/, '') })
      continue
    }
    if (isLabValueLine(token)) {
      const values = [token]
      while (i + 1 < tokens.length && isLabValueLine(tokens[i + 1])) {
        i += 1
        values.push(tokens[i])
      }
      const names = pending.filter((item) => item.type === 'name')
      if (names.length >= 2 && values.length >= 2) {
        const aligned =
          names.length === values.length && names.every((name, index) => compatibleLabPair(name.text, values[index] ?? ''))
        if (aligned) {
          for (const item of pending) {
            if (item.type === 'header') out.push(item.text)
            else out.push(pair(item.text, values.shift() ?? ''))
          }
          pending.length = 0
        } else {
          emitWithValues(values)
        }
        continue
      }
      for (const value of values) {
        while (pending[0]?.type === 'header') out.push(pending.shift()!.text)
        const matchIndex = pending.findIndex((item) => item.type === 'name' && compatibleLabPair(item.text, value))
        const name = matchIndex >= 0 ? pending.splice(matchIndex, 1)[0] : pending.shift()
        out.push(name && compatibleLabPair(name.text, value) ? pair(name.text, value) : value)
        if (name && !compatibleLabPair(name.text, value)) pending.unshift(name)
      }
      continue
    }
    if (isLabNameLine(token)) pending.push({ type: 'name', text: token })
  }
  emitWithValues([])
  return out
}

function expandPackedLabValues(token: string): string[] {
  if (!token) return []
  if (isLabSection(token)) return [token]
  const parts = tokenizeLabStream(token)
  return parts.length > 0 ? parts : [token]
}

function collectLabTokens(text: string): string[] {
  const tokens: string[] = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (/^(previous|next|help|pause|lab values)/i.test(trimmed)) continue
    if (/which of the following|intravenous infusion of which/i.test(trimmed)) {
      const before = trimmed.split(/which of the following|intravenous infusion of which/i)[0]
      if (before.trim()) tokens.push(...tokenizeLabStream(before))
      return tokens
    }
    if (LAB_STOP_LINE.test(normalizeLabToken(trimmed)) && !isLabValueLine(trimmed) && !isLabNameLine(trimmed)) {
      return tokens
    }
    tokens.push(...tokenizeLabStream(trimmed))
  }
  return tokens
}

function leftoverProse(body: string): string {
  const lines = body.split('\n')
  const kept: string[] = []
  let inLabs = true
  for (const line of lines) {
    const token = normalizeLabToken(line)
    if (!token) continue
    if (inLabs && (LAB_STOP_LINE.test(token) || token.length > 90) && !isLabValueLine(token) && !isLabNameLine(token) && !isLabSection(token)) {
      inLabs = false
    }
    if (!inLabs) kept.push(token)
  }
  return kept.join(' ').replace(/\s+/g, ' ').trim()
}

function tidyLeftover(text: string): string {
  const cleaned = text
    .replace(/\s+/g, ' ')
    .replace(/\s*(immediate discontinuation of|supplementation with)$/i, '')
    .trim()
  if (!cleaned) return ''
  if (cleaned.length < 90 && !/[.!]/.test(cleaned) && /with$|of$|shown\.?$/i.test(cleaned)) return ''
  return cleaned
}

function promptLine(after: string): string {
  return (after.match(/((?:intravenous infusion of )?(?:which of the following)[\s\S]*?\?)/i)?.[1] ?? '')
    .replace(/\s+/g, ' ')
    .replace(/^which/, 'Which')
    .trim()
}

export function splitLabCluster(token: string): string[] {
  if (!token) return []
  return token
    .split(/\n/)
    .flatMap((line) => explodeLabLine(line))
    .flatMap((part) =>
      part.split(new RegExp(`(?<=${LAB_UNITS})\\s+`, 'i')).flatMap((piece) => piece.split(/\s+(?=\d)/))
    )
    .map(normalizeLabToken)
    .filter(Boolean)
}

export function peelLabTail(text: string): { text: string; tokens: string[] } {
  let working = text.trim()
  const named: string[] = []
  working = working.replace(
    /\s((?:Protein|WBC|RBC|Hematocrit|Leukocyte count|Na\+|K\+|Cl-|HCO3-|Casts|Specific gravity)(?:\s+(?:Protein|WBC|RBC|Casts|Na\+|K\+|Cl-|HCO3-))*)(?=\s+[\d.]|\s+[1-4]\+|$)/i,
    (_all, names: string) => {
      named.push(...names.split(/\s+/).map(normalizeLabToken))
      return ''
    }
  )
  const start = working.search(
    /\s(?:[\d.,]+\s*(?:mEq\/L|mg\/dL|mg\/dl|g\/dL|g\/dl|U\/L|mm\s*Hg|\/mm\s*3|\/mm³|\/hpf|\/lpf|ng\/mL|µm³)|(?:\d+\s*-\s*\d+\s*\/(?:hpf|lpf))|(?:[1-4]\+\s+(?:[1-4]\+|trace|negative|none))|(?:trace|none)\s+(?:trace|none|[1-4]\+))/i
  )
  if (start < 0) return { text: working.trim(), tokens: named }
  const head = working.slice(0, start).trim()
  const blob = working.slice(start).trim()
  const tokens = splitLabCluster(blob).filter(
    (token) => isLabValueLine(token) || isLabNameLine(token) || isLabSection(token)
  )
  const all = [...named, ...tokens]
  if (all.filter(isLabValueLine).length < 1 && named.length === 0) {
    return { text: text.trim(), tokens: [] }
  }
  return { text: head, tokens: all }
}

function isSeriesValue(token: string): boolean {
  const t = token.trim().replace(/[()]/g, '')
  if (!t) return false
  if (isLabValueLine(t)) return true
  if (/^\d+(?:\.\d+)?$/.test(t)) return true
  if (/^\d{2,3}\/\d{2,3}$/.test(t)) return true
  return false
}

function looksLikeSeriesName(name: string): boolean {
  return /months ago|weeks ago|days ago|hours ago|blood pressure|temperature|time\s*\(/i.test(name)
}

function peelSeriesFromLine(line: string): string[] {
  if (line.includes('\t')) return []
  const tokens = line.trim().split(/\s+/).filter(Boolean)
  const rows: { name: string; values: string[] }[] = []
  let offset = 0
  while (offset < tokens.length) {
    let firstValue = -1
    for (let index = offset; index < tokens.length; index++) {
      if (isSeriesValue(tokens[index])) {
        firstValue = index
        break
      }
    }
    if (firstValue < offset + 1) break
    let end = firstValue
    while (end < tokens.length && isSeriesValue(tokens[end])) end += 1
    if (end - firstValue < 3) break
    const name = tokens.slice(offset, firstValue).join(' ')
    rows.push({ name, values: tokens.slice(firstValue, end) })
    offset = end
  }
  if (rows.length < 2) return []
  if (!rows.some((row) => looksLikeSeriesName(row.name))) return []
  return rows.map((row) => [row.name, ...row.values].join('\t'))
}

function splitSeriesRow(line: string): { name: string; values: string[] } | null {
  if (line.includes('\t')) return null
  const tokens = line.trim().split(/\s+/).filter(Boolean)
  if (tokens.length < 4) return null
  let firstValue = -1
  for (let index = 0; index < tokens.length; index++) {
    if (isSeriesValue(tokens[index])) {
      firstValue = index
      break
    }
  }
  if (firstValue < 1 || tokens.length - firstValue < 3) return null
  const name = tokens.slice(0, firstValue).join(' ')
  const values = tokens.slice(firstValue)
  if (!values.every(isSeriesValue)) return null
  if (/which of the following|^[A-P][).]/i.test(name)) return null
  if (!looksLikeSeriesName(name) && name.split(' ').length < 2) return null
  return { name, values }
}

function formatDataTables(text: string): string {
  const lines = text.split('\n')
  const out: string[] = []
  for (let index = 0; index < lines.length; index++) {
    const peeled = peelSeriesFromLine(lines[index])
    if (peeled.length >= 2) {
      out.push(...peeled)
      continue
    }
    const current = splitSeriesRow(lines[index])
    const next = splitSeriesRow(lines[index + 1] ?? '')
    if (
      current &&
      next &&
      Math.abs(current.values.length - next.values.length) <= 1 &&
      (looksLikeSeriesName(current.name) || looksLikeSeriesName(next.name))
    ) {
      const rows = [current]
      let cursor = index + 1
      while (cursor < lines.length) {
        const row = splitSeriesRow(lines[cursor])
        if (!row || Math.abs(row.values.length - current.values.length) > 1) break
        rows.push(row)
        cursor += 1
      }
      if (rows.length >= 2) {
        for (const row of rows) out.push([row.name, ...row.values].join('\t'))
        index = cursor - 1
        continue
      }
    }
    out.push(lines[index])
  }
  return out.join('\n')
}

export function formatEmbeddedLabs(text: string, extraTokens: string[] = []): string {
  const marker = findLabBlockStart(text)
  if (marker < 0) return formatDataTables(text)

  const prefix = text.slice(0, marker).trimEnd()
  const rest = text.slice(marker)
  const headerMatch = rest.match(LAB_SHOW) ?? rest.match(/^[\s\S]*?shows?:\s*/i)
  const header = (headerMatch ? headerMatch[0] : rest).replace(/\s+/g, ' ').trim()
  let body = headerMatch ? rest.slice(headerMatch[0].length) : ''

  const which = body.search(/intravenous infusion of which of the following|which of the following/i)
  let after = ''
  if (which >= 0) {
    after = body.slice(which)
    body = body.slice(0, which)
  } else {
    const whichInRest = rest.search(/intravenous infusion of which of the following|which of the following/i)
    if (whichInRest >= 0) after = rest.slice(whichInRest)
  }

  const tokens = collectLabTokens(body)
  for (const extra of extraTokens) tokens.push(...explodeLabLine(extra))

  const whichLine = promptLine(after)
  let lastChoicePercent = ''
  for (const line of after.split('\n')) {
    const rawLine = line.trim()
    const isChoice = /^(?:[O0○●□■Q]\s*)?[A-J][\)\.]/.test(rawLine)
    if (/^which of the following|intravenous infusion of which/i.test(rawLine)) continue
    if (isChoice) {
      const stripped = rawLine.replace(/^(?:[O0○●□■Q]\s*)?[A-J][\)\.]\s*/, '')
      tokens.push(...peelLabTail(stripped).tokens)
      const nameTail = stripped.match(
        /\s((?:Protein|WBC|RBC|Hematocrit|Leukocyte count|Na\+|K\+|Cl-|HCO3-|Casts|Specific gravity)(?:\s+(?:Protein|WBC|RBC|Casts|Na\+|K\+|Cl-|HCO3-))*)$/i
      )
      if (nameTail) tokens.push(...nameTail[1].split(/\s+/).map(normalizeLabToken))
      const percent = stripped.match(/^(.*?)\s+([\d.,]+\s*%)$/)
      if (percent && !/0\.9\s*%/.test(percent[2])) lastChoicePercent = percent[2]
      continue
    }
    for (const token of explodeLabLine(rawLine)) {
      if (isLabValueLine(token) || isLabSection(token) || (isLabNameLine(token) && token.split(' ').length <= 5)) {
        tokens.push(token)
      }
    }
  }
  if (lastChoicePercent && tokens.some((token) => /\/mm³|\/hpf|mEq\/L/i.test(token))) {
    const firstValue = tokens.findIndex((token) => isLabValueLine(token))
    if (firstValue >= 0) tokens.splice(firstValue, 0, lastChoicePercent)
    else tokens.push(lastChoicePercent)
  }

  const labeled = labelBareAbg(tokens)
  const paired = pairLabTokens(labeled)
  const leftover = tidyLeftover(leftoverProse(body))
  const formatted = formatDataTables([prefix, header, ...paired, leftover].filter(Boolean).join('\n'))
  if (!whichLine) return formatted
  return `${formatted.replace(/\s+$/, '')}\n\n${whichLine}`
}

export type LabTableRow =
  | { type: 'section'; label: string }
  | { type: 'header'; values: string[] }
  | { type: 'row'; name: string; values: string[] }

export type StemSegment =
  | { type: 'text'; text: string; start: number }
  | { type: 'labs'; rows: LabTableRow[]; start: number }

export function joinBrokenLabUnits(text: string): string {
  return text
    .replace(/\/mm\s*\n\s*3\b/gi, '/mm³')
    .replace(/µm\s*\n\s*3\b/g, 'µm³')
    .replace(/μm\s*\n\s*3\b/g, 'µm³')
}

function isLabClusterLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  if (/which of the following|intravenous infusion of which/i.test(trimmed) && !trimmed.includes('\t')) return false
  if (trimmed.includes('\t')) return true
  if (isLabSection(trimmed) || isLabNameLine(trimmed) || isLabValueLine(trimmed)) return true
  if (trimmed.length < 90 && /(?:mEq\/L|mg\/dL|g\/dL|\/mm³|\/hpf|mm Hg|µm³)/i.test(trimmed)) return true
  return false
}

function clusterIsTable(lines: string[], start: number): boolean {
  let tabs = 0
  let count = 0
  for (let index = start; index < lines.length && isLabClusterLine(lines[index]); index++) {
    count += 1
    if (lines[index].includes('\t')) tabs += 1
  }
  return tabs >= 1 || count >= 2
}

function parseLabRow(line: string): LabTableRow {
  const withoutPrompt = line.replace(/\s+(?:intravenous infusion of )?which of the following[\s\S]*$/i, '').trim()
  if (withoutPrompt.includes('\t')) {
    const cells = withoutPrompt.split('\t').map((cell) => cell.trim())
    if (!cells[0] && cells.slice(1).some(Boolean)) return { type: 'header', values: cells.slice(1) }
    return { type: 'row', name: cells[0] ?? '', values: cells.slice(1) }
  }
  const trimmed = withoutPrompt.trim()
  if (isLabSection(trimmed)) return { type: 'section', label: trimmed }
  if (isLabValueLine(trimmed)) return { type: 'row', name: '', values: [trimmed] }
  return { type: 'row', name: trimmed, values: [] }
}

export function splitStemSegments(stem: string): StemSegment[] {
  const lines = stem.split('\n').flatMap((line) => {
    const match = line.match(/^(.*?)(?:\s+)((?:intravenous infusion of )?which of the following[\s\S]*)$/i)
    if (match?.[1]?.trim() && (match[1].includes('\t') || isLabNameLine(match[1]) || isLabValueLine(match[1]))) {
      return [match[1].trim(), match[2].trim()]
    }
    return [line]
  })
  const segments: StemSegment[] = []
  let offset = 0
  let index = 0
  while (index < lines.length) {
    if (isLabClusterLine(lines[index]) && clusterIsTable(lines, index)) {
      const start = offset
      const rows: LabTableRow[] = []
      while (index < lines.length && isLabClusterLine(lines[index])) {
        rows.push(parseLabRow(lines[index]))
        offset += lines[index].length + 1
        index += 1
      }
      segments.push({ type: 'labs', rows, start })
      continue
    }
    const start = offset
    const prose: string[] = []
    while (index < lines.length && !(isLabClusterLine(lines[index]) && clusterIsTable(lines, index))) {
      prose.push(lines[index])
      offset += lines[index].length + 1
      index += 1
    }
    const text = prose.join('\n')
    if (text.length > 0) segments.push({ type: 'text', text, start })
  }
  return segments
}
